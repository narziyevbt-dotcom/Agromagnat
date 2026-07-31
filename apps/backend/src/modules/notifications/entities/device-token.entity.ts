import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum DevicePlatform {
  ANDROID = 'android',
  IOS = 'ios',
  WEB = 'web',
}

/**
 * One row per installation, not per user.
 *
 * A farmer who reinstalls the app gets a fresh FCM registration token while the
 * old one keeps resolving for days; a single column on `users` would either lose
 * the new device or keep pushing into the dead one. Rows are pruned when FCM
 * reports a token as unregistered — see NotificationsService.
 */
@Entity('device_tokens')
@Index('idx_device_tokens_user', ['userId'])
export class DeviceToken extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ description: 'FCM registration token' })
  @Index('idx_device_tokens_token', { unique: true })
  @Column({ type: 'varchar', length: 400 })
  token: string;

  @ApiProperty({ enum: DevicePlatform })
  @Column({ type: 'enum', enum: DevicePlatform, default: DevicePlatform.ANDROID })
  platform: DevicePlatform;

  @ApiProperty({ nullable: true, description: 'Last successful delivery through this token' })
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;
}
