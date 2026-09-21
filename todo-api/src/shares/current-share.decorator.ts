import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ShareRequest } from './share-token.guard.js';

export const CurrentShare = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<ShareRequest>().share;
});
