import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service.js';
import type { Actor } from '../common/actor.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { CreateTaskDto, UpdateTaskDto } from './dto/task.dto.js';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  async create(projectId: string, dto: CreateTaskDto, actor: Actor) {
    const task = await this.prisma.task.create({
      data: {
        projectId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        status: dto.status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
    await this.activity.record({
      projectId,
      actor,
      action: 'task.created',
      targetType: 'task',
      targetId: task.id,
      meta: { title: task.title },
    });
    return task;
  }

  async update(projectId: string, taskId: string, dto: UpdateTaskDto, actor: Actor) {
    const current = await this.findInProject(projectId, taskId);
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && { description: dto.description.trim() || null }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
      },
    });
    await this.activity.record({
      projectId,
      actor,
      action: 'task.updated',
      targetType: 'task',
      targetId: taskId,
      meta: {
        title: task.title,
        ...(dto.status !== undefined && dto.status !== current.status && {
          statusFrom: current.status,
          statusTo: dto.status,
        }),
      },
    });
    return task;
  }

  async remove(projectId: string, taskId: string, actor: Actor) {
    const task = await this.findInProject(projectId, taskId);
    const attachments = await this.prisma.attachment.findMany({
      where: { taskId },
      select: { objectName: true },
    });
    await this.prisma.task.delete({ where: { id: taskId } });
    await Promise.all(attachments.map((item) => this.storage.remove(item.objectName)));
    await this.activity.record({
      projectId,
      actor,
      action: 'task.deleted',
      targetType: 'task',
      targetId: taskId,
      meta: { title: task.title },
    });
  }

  async findInProject(projectId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!task) throw new NotFoundException('Tarefa nao encontrada');
    return task;
  }
}
