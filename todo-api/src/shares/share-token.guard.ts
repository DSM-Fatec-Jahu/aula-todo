import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { SHARE_TOKEN_PATTERN } from './share-token.js';
import { SharesService, type ResolvedShare } from './shares.service.js';

export interface ShareRequest extends Request {
  share: ResolvedShare;
}

@Injectable()
export class ShareTokenGuard implements CanActivate {
  constructor(private readonly shares: SharesService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ShareRequest>();
    const token = String(request.params.token ?? '');
    // Sempre 404: nao diferencia token inexistente, expirado ou revogado.
    if (!SHARE_TOKEN_PATTERN.test(token)) throw new NotFoundException('Link invalido');
    const share = await this.shares.resolve(token);
    if (!share) throw new NotFoundException('Link invalido');
    request.share = share;
    return true;
  }
}
