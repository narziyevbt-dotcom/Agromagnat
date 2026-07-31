import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

/** How a person can prove who they are. Adding one is a row, not a migration. */
export enum AuthProvider {
  GOOGLE = 'google',
  PHONE = 'phone',
  TELEGRAM = 'telegram',
}

/**
 * One proof of identity. A person may hold several — Google today, a phone
 * tomorrow — and they resolve to the same account rather than to two.
 *
 * `providerUserId` is whatever that provider calls the subject: Google's `sub`,
 * or the E.164 number for a phone. It is never the email, which people change
 * and which would hand an account to whoever inherited the address.
 */
@Entity('auth_identities')
@Index('idx_auth_identities_provider_subject', ['provider', 'providerUserId'], { unique: true })
@Index('idx_auth_identities_user_provider', ['userId', 'provider'], { unique: true })
export class AuthIdentity extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ enum: AuthProvider })
  @Column({ type: 'enum', enum: AuthProvider })
  provider: AuthProvider;

  @ApiProperty({ description: "The provider's own stable id for this person" })
  @Column({ name: 'provider_user_id', length: 255 })
  providerUserId: string;

  @ApiPropertyOptional({ description: 'Informational only — people change emails' })
  @Column({ type: 'varchar', length: 320, nullable: true })
  email: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;
}
