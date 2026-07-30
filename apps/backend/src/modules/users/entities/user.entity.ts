import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/base.entity';
import { District } from '../../geo/entities/district.entity';
import { Region } from '../../geo/entities/region.entity';

export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
}

export enum UserLanguage {
  UZ = 'uz',
  RU = 'ru',
}

@Entity('users')
export class User extends SoftDeletableEntity {
  @ApiProperty({ example: '+998901234567' })
  @Index('idx_users_phone', { unique: true })
  @Column({ length: 20 })
  phone: string;

  @ApiProperty({ example: 'Anvar aka' })
  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @ApiProperty({ description: 'Avatar object URL in S3' })
  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ enum: UserRole })
  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @ApiProperty({ enum: UserLanguage })
  @Column({ type: 'enum', enum: UserLanguage, default: UserLanguage.UZ })
  language: UserLanguage;

  @ApiProperty({ description: 'Turquoise check badge — set by an admin after manual review' })
  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @ApiProperty()
  @Column({ name: 'is_blocked', type: 'boolean', default: false })
  isBlocked: boolean;

  @ApiProperty({ example: 4.7, description: 'Denormalised average of received reviews' })
  @Column({ name: 'rating_avg', type: 'numeric', precision: 3, scale: 2, default: 0 })
  ratingAvg: string;

  @ApiProperty()
  @Column({ name: 'rating_count', type: 'int', default: 0 })
  ratingCount: number;

  @ApiProperty({ description: 'Listings this user has marked sold' })
  @Column({ name: 'sales_count', type: 'int', default: 0 })
  salesCount: number;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ name: 'region_id', type: 'uuid', nullable: true })
  regionId: string | null;

  @ManyToOne(() => Region, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'region_id' })
  region: Region | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ name: 'district_id', type: 'uuid', nullable: true })
  districtId: string | null;

  @ManyToOne(() => District, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'district_id' })
  district: District | null;

  @ApiProperty({ description: 'FCM registration token for push' })
  @Column({ name: 'push_token', type: 'varchar', length: 300, nullable: true })
  pushToken: string | null;

  @ApiProperty()
  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;
}
