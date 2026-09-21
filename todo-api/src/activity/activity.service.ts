import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Actor } from '../common/actor.js';
import { Activity } from './activity.schema.js';

export interface ActivityInput {
  projectId: string;
  actor: Actor;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(@InjectModel(Activity.name) private readonly model: Model<Activity>) {}

  // O historico e secundario: uma falha no Mongo nao pode derrubar a acao do usuario.
  async record(input: ActivityInput) {
    try {
      await this.model.create({
        projectId: input.projectId,
        actorType: input.actor.type,
        actorId: input.actor.id,
        actorLabel: input.actor.label,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        meta: input.meta,
      });
    } catch (error) {
      this.logger.warn(`Nao foi possivel registrar atividade ${input.action}: ${String(error)}`);
    }
  }

  async list(projectId: string, limit = 50) {
    const items = await this.model
      .find({ projectId })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 200))
      .lean();
    return items.map((item) => ({
      id: String(item._id),
      actorType: item.actorType,
      actorLabel: item.actorLabel ?? null,
      action: item.action,
      targetType: item.targetType ?? null,
      targetId: item.targetId ?? null,
      meta: item.meta ?? {},
      createdAt: item.createdAt,
    }));
  }
}
