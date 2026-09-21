import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service.js';
import type { Actor } from '../common/actor.js';
import { SharePermission } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateShareDto } from './dto/share.dto.js';
import { generateShareToken, hashShareToken } from './share-token.js';

export interface ResolvedShare {
  shareId: string;
  projectId: string;
  permission: SharePermission;
  label: string | null;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async create(projectId: string, dto: CreateShareDto, actor: Actor) {
    const token = generateShareToken();
    const share = await this.prisma.shareLink.create({
      data: {
        projectId,
        tokenHash: hashShareToken(token),
        permission: dto.permission ?? SharePermission.READ,
        label: dto.label?.trim() || null,
        expiresAt: dto.expiresInDays ? new Date(Date.now() + dto.expiresInDays * DAY_IN_MS) : null,
      },
    });
    await this.activity.record({
      projectId,
      actor,
      action: 'share.created',
      targetType: 'share',
      targetId: share.id,
      meta: { permission: share.permission, label: share.label },
    });
    // O token em texto puro so existe nesta resposta; depois disso nao ha como recupera-lo.
    return { ...this.toView(share), token };
  }

  async list(projectId: string) {
    const shares = await this.prisma.shareLink.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return shares.map((share) => this.toView(share));
  }

  async revoke(projectId: string, shareId: string, actor: Actor) {
    const share = await this.prisma.shareLink.findFirst({ where: { id: shareId, projectId } });
    if (!share) throw new NotFoundException('Link nao encontrado');
    await this.prisma.shareLink.update({
      where: { id: shareId },
      data: { revokedAt: share.revokedAt ?? new Date() },
    });
    await this.activity.record({
      projectId,
      actor,
      action: 'share.revoked',
      targetType: 'share',
      targetId: shareId,
    });
  }

  async resolve(token: string): Promise<ResolvedShare | null> {
    const share = await this.prisma.shareLink.findUnique({
      where: { tokenHash: hashShareToken(token) },
    });
    if (!share || share.revokedAt) return null;
    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;
    return {
      shareId: share.id,
      projectId: share.projectId,
      permission: share.permission,
      label: share.label,
    };
  }

  private toView(share: {
    id: string;
    permission: SharePermission;
    label: string | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }) {
    const expired = share.expiresAt !== null && share.expiresAt.getTime() < Date.now();
    return {
      id: share.id,
      permission: share.permission,
      label: share.label,
      expiresAt: share.expiresAt,
      revokedAt: share.revokedAt,
      createdAt: share.createdAt,
      active: !share.revokedAt && !expired,
    };
  }
}
