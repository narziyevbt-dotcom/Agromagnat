import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TooManyRequestsException } from '../../common/exceptions/too-many-requests.exception';
import { User, UserRole } from '../users/entities/user.entity';
import { AuthTokensDto, RequestOtpResponseDto } from './dto/auth.dto';
import { OtpService, OtpVerifyResult } from './otp.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

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

    switch (verdict) {
      case OtpVerifyResult.EXPIRED:
        throw new UnauthorizedException("Kod muddati tugagan. Yangi kod so'rang");
      case OtpVerifyResult.TOO_MANY_ATTEMPTS:
        throw new TooManyRequestsException("Juda ko'p noto'g'ri urinish. Yangi kod so'rang");
      case OtpVerifyResult.INVALID:
        throw new UnauthorizedException("Kod noto'g'ri");
      case OtpVerifyResult.VALID:
        break;
    }

    let user = await this.users.findOne({ where: { phone } });
    const isNewUser = user === null;

    if (!user) {
      user = await this.users.save(
        this.users.create({ phone, name: name ?? null, role: UserRole.USER }),
      );
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
