import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TooManyRequestsException } from '../../common/exceptions/too-many-requests.exception';
import { District } from '../geo/entities/district.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { AuthTokensDto, RequestOtpResponseDto, TelegramTicketDto } from './dto/auth.dto';
import { AuthIdentity, AuthProvider } from './entities/auth-identity.entity';
import { GoogleVerifierService } from './google/google-verifier.service';
import { OtpService, OtpVerifyResult } from './otp.service';
import { TelegramLinkService } from './telegram-link/telegram-link.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthIdentity)
    private readonly identities: Repository<AuthIdentity>,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly google: GoogleVerifierService,
    private readonly telegramLink: TelegramLinkService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------- google

  /**
   * Sign in with Google. No phone, no SMS, no cost — the person can browse the
   * whole marketplace from here and is only asked for a number when they try
   * to do something that reaches somebody else.
   *
   * The Google subject is the join key, never the email: people change emails,
   * and matching on one would hand an account to whoever inherited the address.
   */
  async googleSignIn(idToken: string): Promise<AuthTokensDto> {
    const profile = await this.google.verify(idToken);

    const existing = await this.identities.findOne({
      where: { provider: AuthProvider.GOOGLE, providerUserId: profile.sub },
      relations: { user: true },
    });

    if (existing) {
      if (existing.user.isBlocked) {
        throw new UnauthorizedException(
          "Hisobingiz bloklangan. Yordam bo'limiga murojaat qiling",
        );
      }
      await this.identities.update(existing.id, { lastLoginAt: new Date() });
      existing.user.lastSeenAt = new Date();
      await this.users.save(existing.user);

      const pair = await this.tokens.issuePair(existing.user);
      return { ...pair, isNewUser: false };
    }

    // A first Google sign-in with an email we already know belongs to somebody
    // is deliberately NOT merged. Automatic account linking on an email is a
    // well-known takeover route, and the safe join — proving both — is the
    // phone verification this account will be asked for anyway.
    const user = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(User, {
          name: profile.name,
          email: profile.email,
          avatarUrl: profile.picture,
          role: UserRole.USER,
          lastSeenAt: new Date(),
        }),
      );
      await manager.save(
        manager.create(AuthIdentity, {
          userId: created.id,
          provider: AuthProvider.GOOGLE,
          providerUserId: profile.sub,
          email: profile.email,
          lastLoginAt: new Date(),
        }),
      );
      return created;
    });

    this.logger.log(`New user via Google: ${profile.sub}`);
    const pair = await this.tokens.issuePair(user);
    return { ...pair, isNewUser: true };
  }

  // -------------------------------------------------- phone verification

  /**
   * Sends a code to a phone the signed-in person wants to attach.
   *
   * Separate from `requestOtp` because the recipient is known here: if they
   * have already started the Telegram bot the code goes there for nothing,
   * where the anonymous sign-in path has no account to look that up on.
   */
  async requestPhoneVerification(
    userId: string,
    phone: string,
  ): Promise<RequestOtpResponseDto> {
    if (await this.otp.isRateLimited(phone)) {
      throw new TooManyRequestsException(
        "Juda ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring",
      );
    }

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    const result = await this.otp.request(phone, {
      phone,
      telegramChatId: user.telegramChatId,
    });
    if (!result.sent) {
      throw new ServiceUnavailableException(
        "Kod yuborilmadi. Biroz kutib, qayta urinib ko'ring",
      );
    }
    return result;
  }

  /**
   * Attaches and verifies a phone on an account that already exists — the
   * Google path. Distinct from `verifyOtp`, which both authenticates and
   * registers; here the person is already who they say they are and is adding
   * a second, stronger proof.
   */
  async verifyPhone(userId: string, phone: string, code: string): Promise<AuthTokensDto> {
    const verdict = await this.otp.verify(phone, code);
    this.assertOtpValid(verdict);

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    // The number may already belong to an account created by the SMS path.
    // Merging the two automatically would move listings between accounts, so
    // it is refused and the person is told to sign in the other way.
    const taken = await this.users.findOne({ where: { phone } });
    if (taken && taken.id !== userId) {
      throw new BadRequestException(
        "Bu raqam boshqa hisobga biriktirilgan. O'sha hisobga kiring",
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, userId, { phone, phoneVerifiedAt: new Date() });
      await manager.save(
        manager.create(AuthIdentity, {
          userId,
          provider: AuthProvider.PHONE,
          providerUserId: phone,
          lastLoginAt: new Date(),
        }),
      );
    });

    // Reissued rather than reused: the old access token still says
    // phoneVerified=false, and the person expects the button they just
    // unblocked to work immediately rather than after the next refresh.
    const fresh = await this.users.findOneOrFail({ where: { id: userId } });
    const pair = await this.tokens.issuePair(fresh);
    return { ...pair, isNewUser: false };
  }

  /** Signs every device out. The "logout all devices" the settings screen offers. */
  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeAll(userId);
    this.logger.log(`All sessions revoked for ${userId}`);
  }

  private assertOtpValid(verdict: OtpVerifyResult): void {
    switch (verdict) {
      case OtpVerifyResult.EXPIRED:
        throw new UnauthorizedException("Kod muddati tugagan. Yangi kod so'rang");
      case OtpVerifyResult.TOO_MANY_ATTEMPTS:
        throw new TooManyRequestsException(
          "Juda ko'p noto'g'ri urinish. Yangi kod so'rang",
        );
      case OtpVerifyResult.INVALID:
        throw new UnauthorizedException("Kod noto'g'ri");
      case OtpVerifyResult.VALID:
        break;
    }
  }

  async requestOtp(phone: string): Promise<RequestOtpResponseDto> {
    if (await this.otp.isRateLimited(phone)) {
      throw new TooManyRequestsException(
        "Juda ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring",
      );
    }

    const result = await this.otp.request(phone);
    if (!result.sent) {
      throw new ServiceUnavailableException(
        "SMS yuborilmadi. Biroz kutib, qayta urinib ko'ring",
      );
    }
    return result;
  }

  async verifyOtp(phone: string, code: string, name?: string): Promise<AuthTokensDto> {
    const verdict = await this.otp.verify(phone, code);
    this.assertOtpValid(verdict);

    let user = await this.users.findOne({ where: { phone } });
    const isNewUser = user === null;

    if (!user) {
      user = await this.dataSource.transaction(async (manager) => {
        const created = await manager.save(
          manager.create(User, {
            phone,
            phoneVerifiedAt: new Date(),
            name: name ?? null,
            role: UserRole.USER,
          }),
        );
        await manager.save(
          manager.create(AuthIdentity, {
            userId: created.id,
            provider: AuthProvider.PHONE,
            providerUserId: phone,
            lastLoginAt: new Date(),
          }),
        );
        return created;
      });
      this.logger.log(`New user registered: ${phone}`);
    } else if (user.isBlocked) {
      throw new UnauthorizedException("Hisobingiz bloklangan. Yordam bo'limiga murojaat qiling");
    } else if (name && !user.name) {
      // Only fills a blank name — a later login must not silently rename someone.
      user.name = name;
      await this.users.save(user);
    }

    user.lastSeenAt = new Date();
    await this.users.save(user);

    const pair = await this.tokens.issuePair(user);
    return { ...pair, isNewUser };
  }

  /** What the sign-in screen should offer. Cheap enough to call on every render. */
  availableMethods(): { telegram: boolean; google: boolean } {
    return {
      telegram: this.telegramLink.isConfigured,
      google: this.google.isConfigured,
    };
  }

  /** Hands the browser a ticket and the link that will prove the number. */
  async startTelegramSignIn(): Promise<TelegramTicketDto> {
    if (!this.telegramLink.isConfigured) {
      throw new ServiceUnavailableException('Telegram orqali kirish sozlanmagan');
    }
    return this.telegramLink.issue();
  }

  /**
   * Polled by the browser. Null while the person is still in Telegram.
   *
   * The ticket is spent by `collect`, so the session can be claimed once and
   * a ticket that leaks after the fact is worth nothing.
   */
  async collectTelegramSignIn(ticket: string): Promise<AuthTokensDto | null> {
    const result = await this.telegramLink.collect(ticket);
    return result ? this.telegramSignIn(result) : null;
  }

  /**
   * Signing in on a number Telegram has already verified.
   *
   * The same account handling as the OTP path, minus the code — there is
   * nothing to check, because the proof arrived with the contact card. The chat
   * id is kept as well, so this person's future codes can go over Telegram for
   * nothing even when they sign in from somewhere else.
   */
  async telegramSignIn(result: {
    phone: string;
    telegramChatId: string;
    name: string | null;
  }): Promise<AuthTokensDto> {
    const { phone, telegramChatId, name } = result;

    let user = await this.users.findOne({ where: { phone } });
    const isNewUser = user === null;

    if (!user) {
      user = await this.dataSource.transaction(async (manager) => {
        const created = await manager.save(
          manager.create(User, {
            phone,
            phoneVerifiedAt: new Date(),
            name,
            telegramChatId,
            role: UserRole.USER,
          }),
        );
        await manager.save(
          manager.create(AuthIdentity, {
            userId: created.id,
            provider: AuthProvider.TELEGRAM,
            providerUserId: telegramChatId,
            lastLoginAt: new Date(),
          }),
        );
        return created;
      });
      this.logger.log(`New user registered over Telegram: ${phone}`);
    } else if (user.isBlocked) {
      throw new UnauthorizedException("Hisobingiz bloklangan. Yordam bo'limiga murojaat qiling");
    } else {
      // The chat may have moved to a new device or account; the newest binding
      // wins, and the column is unique so the old one is cleared first.
      if (user.telegramChatId !== telegramChatId) {
        await this.users.update({ telegramChatId }, { telegramChatId: null });
        user.telegramChatId = telegramChatId;
      }
      // Only fills a blank name — signing in must not silently rename somebody
      // who has already chosen what buyers call them.
      if (name && !user.name) {
        user.name = name;
      }
      // An account that existed without a verified phone — a Google sign-in —
      // has one now, and this is the moment it earns the gate.
      user.phoneVerifiedAt ??= new Date();
    }

    user.lastSeenAt = new Date();
    await this.users.save(user);

    const pair = await this.tokens.issuePair(user);
    return { ...pair, isNewUser };
  }

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const pair = await this.tokens.rotate(refreshToken, async (id) => {
      const user = await this.users.findOne({ where: { id } });
      return user && !user.isBlocked ? user : null;
    });
    return { ...pair, isNewUser: false };
  }

  async logout(refreshToken: string, accessToken?: string): Promise<void> {
    await this.tokens.revoke(refreshToken, accessToken);
  }

  /**
   * Profile edit. When a district is given it must belong to the resolved
   * region — a listing filtered by "Samarqand · Chilonzor" would be nonsense
   * data no later validation could repair.
   */
  async updateProfile(
    userId: string,
    changes: { name?: string; regionId?: string; districtId?: string },
  ): Promise<User> {
    const user = await this.me(userId);

    const regionId = changes.regionId ?? user.regionId ?? null;
    let districtId = changes.districtId ?? null;

    if (changes.districtId) {
      const district = await this.users.manager.findOne(District, {
        where: { id: changes.districtId },
      });
      if (!district || (regionId && district.regionId !== regionId)) {
        throw new BadRequestException('Tuman tanlangan viloyatga tegishli emas');
      }
    } else if (changes.regionId && changes.regionId !== user.regionId) {
      // Region changed without a district — the old district no longer applies.
      districtId = null;
    } else {
      districtId = user.districtId;
    }

    await this.users.update(userId, {
      ...(changes.name !== undefined ? { name: changes.name.trim() } : {}),
      regionId,
      districtId,
    });

    return this.me(userId);
  }

  async me(userId: string): Promise<User> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { region: true, district: true },
    });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    return user;
  }
}
