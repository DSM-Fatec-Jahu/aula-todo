import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Actor } from '../common/actor.js';
import { SharePermission } from '../generated/prisma/enums.js';
import { ProjectsService } from '../projects/projects.service.js';
import { CurrentShare } from '../shares/current-share.decorator.js';
import { ShareTokenGuard } from '../shares/share-token.guard.js';
import type { ResolvedShare } from '../shares/shares.service.js';
import { CreateTaskDto, UpdateTaskDto } from '../tasks/dto/task.dto.js';
import { TasksService } from '../tasks/tasks.service.js';

// Rotas sem login: o acesso e dado pelo token do link (guard) e limitado por IP (throttler).
@ApiTags('public')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@UseGuards(ShareTokenGuard)
@Controller('public/shares/:token')
export class PublicController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
  ) {}

  @Get()
  async view(@CurrentShare() share: ResolvedShare) {
    const board = await this.projects.getBoard(share.projectId);
    return { permission: share.permission, ...board };
  }

  @Post('tasks')
  createTask(@CurrentShare() share: ResolvedShare, @Body() dto: CreateTaskDto) {
    this.requireEdit(share);
    return this.tasks.create(share.projectId, dto, this.actorOf(share));
  }

  @Patch('tasks/:taskId')
  updateTask(
    @CurrentShare() share: ResolvedShare,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    this.requireEdit(share);
    return this.tasks.update(share.projectId, taskId, dto, this.actorOf(share));
  }

  private requireEdit(share: ResolvedShare) {
    if (share.permission !== SharePermission.EDIT) {
      throw new ForbiddenException('Este link e somente leitura');
    }
  }

  private actorOf(share: ResolvedShare): Actor {
    return { type: 'anonymous', id: share.shareId, label: share.label ?? 'visitante' };
  }
}
