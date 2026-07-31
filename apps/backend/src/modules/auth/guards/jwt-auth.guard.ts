import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtConfig } from '../../../config/configuration';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AccessTokenPayload, TokenService } from '../token.service';

/**
 * Registered globally. Verifies the access token, rejects blacklisted ones
 * (logout), and attaches the payload to the request.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (isPublic) {
      // Still decode when a token is present: endpoints like the public feed
      // want to mark a listing as favorited when the caller happens to be
      // logged in, without demanding authentication.
      if (token) {
        await this.attachIfValid(request, token);
      }
      return true;
    }

    if (!token) {
      throw new UnauthorizedException('Avtorizatsiya talab qilinadi');
    }

    const payload = await this.verify(token);
    (request as Request & { user: AccessTokenPayload }).user = payload;
    return true;
  }

  private async attachIfValid(request: Request, token: string): Promise<void> {
    try {
      (request as Request & { user: AccessTokenPayload }).user = await this.verify(token);
    } catch {
      // A bad token on a public route is simply an anonymous caller.
    }
  }

  private async verify(token: string): Promise<AccessTokenPayload> {
    if (await this.tokens.isAccessBlacklisted(token)) {
      throw new UnauthorizedException('Sessiya tugatilgan, qaytadan kiring');
    }
    try {
      const { accessSecret } = this.config.getOrThrow<JwtConfig>('jwt');
      return await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: accessSecret });
    } catch {
      throw new UnauthorizedException('Sessiya muddati tugagan, qaytadan kiring');
    }
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) {
      return undefined;
    }
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
  }
}
