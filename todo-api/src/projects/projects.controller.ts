import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityService } from '../activity/activity.service.js';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto.js';
import { ProjectsService } from './projects.service.js';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.id, dto, { type: 'user', id: user.id, label: user.email });
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.projects.listByOwner(user.id);
  }

  @Get(':projectId')
  async board(@CurrentUser() user: AuthUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    await this.projects.assertOwner(projectId, user.id);
    return this.projects.getBoard(projectId);
  }

  @Patch(':projectId')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    await this.projects.assertOwner(projectId, user.id);
    return this.projects.update(projectId, dto, { type: 'user', id: user.id, label: user.email });
  }

  @HttpCode(204)
  @Delete(':projectId')
  async remove(@CurrentUser() user: AuthUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    await this.projects.assertOwner(projectId, user.id);
    await this.projects.remove(projectId, { type: 'user', id: user.id, label: user.email });
  }

  @Get(':projectId/activity')
  async history(@CurrentUser() user: AuthUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    await this.projects.assertOwner(projectId, user.id);
    return this.activity.list(projectId);
  }
}
