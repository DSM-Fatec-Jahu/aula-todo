import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CreateShareDto } from './dto/share.dto.js';
import { SharesService } from './shares.service.js';

@ApiTags('shares')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/shares')
export class SharesController {
  constructor(
    private readonly shares: SharesService,
    private readonly projects: ProjectsService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateShareDto,
  ) {
    await this.projects.assertOwner(projectId, user.id);
    return this.shares.create(projectId, dto, { type: 'user', id: user.id, label: user.email });
  }

  @Get()
  async list(@CurrentUser() user: AuthUser, @Param('projectId', ParseUUIDPipe) projectId: string) {
    await this.projects.assertOwner(projectId, user.id);
    return this.shares.list(projectId);
  }

  @HttpCode(204)
  @Delete(':shareId')
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('shareId', ParseUUIDPipe) shareId: string,
  ) {
    await this.projects.assertOwner(projectId, user.id);
    await this.shares.revoke(projectId, shareId, { type: 'user', id: user.id, label: user.email });
  }
}
