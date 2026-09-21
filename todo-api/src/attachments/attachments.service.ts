import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ActivityService } from '../activity/activity.service.js';
import type { Actor } from '../common/actor.js';
import { isImage, sanitizeFileName } from '../common/attachments.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { TasksService } from '../tasks/tasks.service.js';
import type { RequestUploadDto } from './dto/attachment.dto.js';

@Injectable()
export class AttachmentsService {
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
    private readonly tasks: TasksService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxBytes = config.getOrThrow<number>('MAX_UPLOAD_BYTES');
  }

  // Passo 1: o cliente pede permissao; a API registra o anexo como PENDING e devolve a signed URL.
  async requestUpload(projectId: string, taskId: string, dto: RequestUploadDto, actor: Actor) {
    await this.tasks.findInProject(projectId, taskId);
    if (dto.sizeBytes > this.maxBytes) {
      throw new BadRequestException(`Arquivo maior que o limite de ${this.maxBytes} bytes`);
    }

    const id = randomUUID();
    const objectName = `projects/${projectId}/tasks/${taskId}/${id}-${sanitizeFileName(dto.fileName)}`;
    const attachment = await this.prisma.attachment.create({
      data: {
        id,
        taskId,
        objectName,
        fileName: dto.fileName.trim(),
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
      },
    });
    const upload = await this.storage.createUploadTarget({
      objectName,
      contentType: dto.contentType,
      maxBytes: this.maxBytes,
    });
    await this.activity.record({
      projectId,
      actor,
      action: 'attachment.requested',
      targetType: 'attachment',
      targetId: id,
      meta: { fileName: attachment.fileName },
    });
    return { attachmentId: attachment.id, upload };
  }

  // Passo 3: depois do PUT direto no bucket, o cliente confirma e a API confere o objeto.
  async confirm(projectId: string, taskId: string, attachmentId: string, actor: Actor) {
    const attachment = await this.findInTask(projectId, taskId, attachmentId);
    const object = await this.storage.stat(attachment.objectName);
    if (!object) throw new ConflictException('O arquivo ainda nao foi enviado ao storage');

    if (object.sizeBytes > this.maxBytes) {
      await this.storage.remove(attachment.objectName);
      await this.prisma.attachment.delete({ where: { id: attachmentId } });
      throw new BadRequestException('Arquivo maior que o permitido');
    }

    const ready = await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: { status: 'READY', sizeBytes: object.sizeBytes },
    });
    await this.activity.record({
      projectId,
      actor,
      action: 'attachment.added',
      targetType: 'attachment',
      targetId: attachmentId,
      meta: { fileName: ready.fileName, sizeBytes: ready.sizeBytes },
    });
    return {
      id: ready.id,
      fileName: ready.fileName,
      contentType: ready.contentType,
      sizeBytes: ready.sizeBytes,
      isImage: isImage(ready.contentType),
      downloadUrl: await this.storage.createDownloadUrl({
        objectName: ready.objectName,
        fileName: ready.fileName,
        contentType: ready.contentType,
      }),
    };
  }

  async remove(projectId: string, taskId: string, attachmentId: string, actor: Actor) {
    const attachment = await this.findInTask(projectId, taskId, attachmentId);
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    await this.storage.remove(attachment.objectName);
    await this.activity.record({
      projectId,
      actor,
      action: 'attachment.removed',
      targetType: 'attachment',
      targetId: attachmentId,
      meta: { fileName: attachment.fileName },
    });
  }

  private async findInTask(projectId: string, taskId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, taskId, task: { projectId } },
    });
    if (!attachment) throw new NotFoundException('Anexo nao encontrado');
    return attachment;
  }
}
