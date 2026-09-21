import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Activity, ActivitySchema } from './activity.schema.js';
import { ActivityService } from './activity.service.js';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Activity.name, schema: ActivitySchema }])],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
