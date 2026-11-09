import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Connection } from 'mongoose';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Descreve o destino de uma URI de conexao SEM a senha (para registrar em log).
function describeTarget(uri: string): string {
  try {
    const u = new URL(uri);
    const params = [...u.searchParams.keys()].join(',') || '-';
    return `${u.protocol}//${u.username || '?'}:***@${u.host || '(sem host)'}${u.pathname} (parametros: ${params})`;
  } catch {
    // Ex.: socket do Cloud SQL (`postgresql://user:senha@/db?host=/cloudsql/...`) ou senha com caracteres sem escape.
    const masked = uri.replace(/^([a-z+]+:\/\/[^:/@]*):.*@/i, '$1:***@');
    return masked === uri
      ? '(formato de URI nao reconhecido)'
      : `${masked} (URI fora do padrao WHATWG)`;
  }
}

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectConnection() private readonly mongo: Connection,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  // Liveness: o processo esta de pe (nao consulta bancos).
  @Get()
  live() {
    return { status: 'ok' };
  }

  // Readiness: confere o Postgres e o Mongo. Em caso de falha, o motivo vai para o log
  // (nunca para a resposta, que e publica) junto com o destino tentado, sem senha.
  @Get('ready')
  async ready() {
    const [postgres, mongo] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(
        () => 'up',
        (error: unknown) =>
          this.down('postgres', this.config.getOrThrow('DATABASE_URL'), error),
      ),
      this.mongo
        .db!.admin()
        .ping()
        .then(
          () => 'up',
          (error: unknown) =>
            this.down('mongo', this.config.getOrThrow('MONGODB_URI'), error),
        ),
    ]);
    const body = {
      status: postgres === 'up' && mongo === 'up' ? 'ok' : 'degraded',
      postgres,
      mongo,
    };
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }

  private down(name: string, uri: string, error: unknown): 'down' {
    const e = error as {
      code?: string;
      message?: string;
      cause?: { code?: string; message?: string };
    };
    const code = e.code ?? e.cause?.code ?? '-';
    const message = e.message ?? e.cause?.message ?? String(error);
    this.logger.error(
      `[health] ${name} DOWN | destino: ${describeTarget(uri)} | codigo: ${code} | erro: ${message}`,
    );
    return 'down';
  }
}
