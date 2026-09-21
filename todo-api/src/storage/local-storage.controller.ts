import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createReadStream, createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { LocalStorageService } from './local-storage.service.js';
import { StorageService } from './storage.service.js';

@ApiExcludeController()
@Controller('local-storage')
export class LocalStorageController {
  constructor(private readonly storage: StorageService) {}

  private get local() {
    if (!(this.storage instanceof LocalStorageService)) throw new NotFoundException();
    return this.storage;
  }

  @Put('upload')
  async upload(@Query() query: Record<string, string>, @Req() req: Request) {
    const claims = this.local.verify(query, 'upload');
    if (!claims) throw new ForbiddenException('URL invalida ou expirada');
    if (req.headers['content-type'] !== claims.ct) {
      throw new ForbiddenException('Content-Type diferente do assinado');
    }

    const path = await this.local.prepareFile(claims.object);
    let received = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        if (received > claims.max) {
          callback(new ForbiddenException('Arquivo maior que o permitido'));
          return;
        }
        callback(null, chunk);
      },
    });

    try {
      await pipeline(req, limiter, createWriteStream(path));
    } catch (error) {
      await this.local.remove(claims.object);
      throw error;
    }
  }

  @Get('download')
  async download(@Query() query: Record<string, string>, @Res() res: Response) {
    const claims = this.local.verify(query, 'download');
    if (!claims) throw new ForbiddenException('URL invalida ou expirada');
    if (!(await this.local.stat(claims.object))) throw new NotFoundException();

    res.setHeader('Content-Type', claims.ct);
    res.setHeader('Content-Disposition', this.local.dispositionFor(claims));
    createReadStream(this.local.pathFor(claims.object)).pipe(res);
  }
}
