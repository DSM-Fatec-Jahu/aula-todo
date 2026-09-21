import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Connection } from 'mongoose';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectConnection() private readonly mongo: Connection,
  ) {}

  // Liveness: o processo esta de pe (nao consulta bancos).
  @Get()
  live() {
    return { status: 'ok' };
  }

  // Readiness: confere o Postgres e o Mongo.
  @Get('ready')
  async ready() {
    const [postgres, mongo] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(
        () => 'up',
        () => 'down',
      ),
      this.mongo.db!.admin().ping().then(
        () => 'up',
        () => 'down',
      ),
    ]);
    const body = { status: postgres === 'up' && mongo === 'up' ? 'ok' : 'degraded', postgres, mongo };
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }
}
