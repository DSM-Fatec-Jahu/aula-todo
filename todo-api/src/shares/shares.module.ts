import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { ShareTokenGuard } from './share-token.guard.js';
import { SharesController } from './shares.controller.js';
import { SharesService } from './shares.service.js';

@Module({
  imports: [ProjectsModule],
  controllers: [SharesController],
  providers: [SharesService, ShareTokenGuard],
  exports: [SharesService, ShareTokenGuard],
})
export class SharesModule {}
