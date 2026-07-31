import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AccessTokenPayload } from '../token.service';

/** Injects the verified JWT payload attached by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (data: keyof AccessTokenPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    const user = request.user;
    if (!user) {
      return undefined;
    }
    return data ? user[data] : user;
  },
);
