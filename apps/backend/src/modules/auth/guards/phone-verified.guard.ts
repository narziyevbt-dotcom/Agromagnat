import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_PHONE_KEY } from '../decorators/requires-phone.decorator';

/**
 * The gate between browsing and participating.
 *
 * Reads the flag off the access token rather than the database. The token is
 * short-lived, so a freshly verified phone is reflected within one refresh —
 * and the alternative, a query on every guarded request, would put a database
 * round trip in front of every message send for a check that is almost always
 * true.
 *
 * Returns 403 with a machine-readable code, not a bare message: the client has
 * to be able to tell "you need to verify your phone" apart from "you are not
 * allowed to touch this listing" and open the verification sheet for one and
 * not the other.
 */
@Injectable()
export class PhoneVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRES_PHONE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    if (request.user?.phoneVerified) {
      return true;
    }

    throw new ForbiddenException({
      statusCode: 403,
      error: 'PHONE_VERIFICATION_REQUIRED',
      message: "Buning uchun telefon raqamingizni tasdiqlang",
    });
  }
}
