import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

const NINETY_DAYS_IN_SECONDS = 60 * 60 * 24 * 90;

@Schema({
  collection: 'activities',
  versionKey: false,
  timestamps: { createdAt: true, updatedAt: false },
})
export class Activity {
  @Prop({ type: String, required: true })
  projectId!: string;

  @Prop({ type: String, required: true, enum: ['user', 'anonymous'] })
  actorType!: 'user' | 'anonymous';

  @Prop({ type: String, required: true })
  actorId!: string;

  @Prop({ type: String })
  actorLabel?: string;

  @Prop({ type: String, required: true })
  action!: string;

  @Prop({ type: String })
  targetType?: string;

  @Prop({ type: String })
  targetId?: string;

  // Documento livre: cada acao guarda os campos que fizerem sentido para ela.
  @Prop({ type: Object })
  meta?: Record<string, unknown>;

  createdAt!: Date;
}

export type ActivityDocument = HydratedDocument<Activity>;
export const ActivitySchema = SchemaFactory.createForClass(Activity);

ActivitySchema.index({ projectId: 1, createdAt: -1 });
// TTL: o Mongo apaga sozinho os registros com mais de 90 dias (o M0 tem apenas 512 MB).
ActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: NINETY_DAYS_IN_SECONDS });
