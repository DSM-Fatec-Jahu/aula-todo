import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service.js';
import type { Actor } from '../common/actor.js';
import { isImage } from '../common/attachments.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { CreateProjectDto, UpdateProjectDto } from './dto/project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  async create(ownerId: string, dto: CreateProjectDto, actor: Actor) {
    const project = await this.prisma.project.create({
      data: { ownerId, name: dto.name.trim(), description: dto.description?.trim() || null },
    });
    await this.activity.record({
      projectId: project.id,
      actor,
      action: 'project.created',
      targetType: 'project',
      targetId: project.id,
      meta: { name: project.name },
    });
    return project;
  }

  async listByOwner(ownerId: string) {
    const projects = await this.prisma.project.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: { tasks: { select: { status: true } } },
    });
    return projects.map(({ tasks, ...project }) => ({
      ...project,
      taskCount: tasks.length,
      doneCount: tasks.filter((task) => task.status === 'DONE').length,
    }));
  }

  // Devolve 404 (e nao 403) para nao revelar a existencia de projetos de outros usuarios.
  async assertOwner(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, ownerId: userId } });
    if (!project) throw new NotFoundException('Projeto nao encontrado');
    return project;
  }

  async update(projectId: string, dto: UpdateProjectDto, actor: Actor) {
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description.trim() || null }),
      },
    });
    await this.activity.record({
      projectId,
      actor,
      action: 'project.updated',
      targetType: 'project',
      targetId: projectId,
    });
    return project;
  }

  async remove(projectId: string, actor: Actor) {
    const attachments = await this.prisma.attachment.findMany({
      where: { task: { projectId } },
      select: { objectName: true },
    });
    await this.prisma.project.delete({ where: { id: projectId } });
    await Promise.all(attachments.map((item) => this.storage.remove(item.objectName)));
    await this.activity.record({
      projectId,
      actor,
      action: 'project.deleted',
      targetType: 'project',
      targetId: projectId,
    });
  }

  async getBoard(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          orderBy: { createdAt: 'asc' },
          include: {
            attachments: { where: { status: 'READY' }, orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
    if (!project) throw new NotFoundException('Projeto nao encontrado');

    const tasks = await Promise.all(
      project.tasks.map(async (task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        attachments: await Promise.all(
          task.attachments.map(async (attachment) => ({
            id: attachment.id,
            fileName: attachment.fileName,
            contentType: attachment.contentType,
            sizeBytes: attachment.sizeBytes,
            isImage: isImage(attachment.contentType),
            downloadUrl: await this.storage.createDownloadUrl({
              objectName: attachment.objectName,
              fileName: attachment.fileName,
              contentType: attachment.contentType,
            }),
          })),
        ),
      })),
    );

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      tasks,
    };
  }
}
