import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ProjectsService } from '../projects/projects.service.js';
import { AttachmentsService } from './attachments.service.js';
import { RequestUploadDto } from './dto/attachment.dto.js';

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/tasks/:taskId/attachments')
export class AttachmentsController {
  constructor(
    private readonly attachments: AttachmentsService,
    private readonly projects: ProjectsService,
  ) {}

  @Post()
  async requestUpload(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: RequestUploadDto,
  ) {
    await this.projects.assertOwner(projectId, user.id);
    return this.attachments.requestUpload(projectId, taskId, dto, {
      type: 'user',
      id: user.id,
      label: user.email,
    });
  }

  @HttpCode(200)
  @Post(':attachmentId/confirm')
  async confirm(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    await this.projects.assertOwner(projectId, user.id);
    return this.attachments.confirm(projectId, taskId, attachmentId, {
      type: 'user',
      id: user.id,
      label: user.email,
    });
  }

  @HttpCode(204)
  @Delete(':attachmentId')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    await this.projects.assertOwner(projectId, user.id);
    await this.attachments.remove(projectId, taskId, attachmentId, {
      type: 'user',
      id: user.id,
      label: user.email,
    });
  }
}
