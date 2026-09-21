import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { SharesModule } from '../shares/shares.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { PublicController } from './public.controller.js';

@Module({
  imports: [ProjectsModule, SharesModule, TasksModule],
  controllers: [PublicController],
})
export class PublicModule {}
