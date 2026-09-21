import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ProjectsService } from '../projects/projects.service.js';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto.js';
import { TasksService } from './tasks.service.js';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly projects: ProjectsService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    await this.projects.assertOwner(projectId, user.id);
    return this.tasks.create(projectId, dto, { type: 'user', id: user.id, label: user.email });
  }

  @Patch(':taskId')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    await this.projects.assertOwner(projectId, user.id);
    return this.tasks.update(projectId, taskId, dto, { type: 'user', id: user.id, label: user.email });
  }

  @HttpCode(204)
  @Delete(':taskId')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    await this.projects.assertOwner(projectId, user.id);
    await this.tasks.remove(projectId, taskId, { type: 'user', id: user.id, label: user.email });
  }
}
