import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Listing } from '../../listings/entities/listing.entity';
import { User } from '../../users/entities/user.entity';

export enum ReportReason {
  SCAM = 'scam',
  WRONG_CATEGORY = 'wrong_category',
  WRONG_PRICE = 'wrong_price',
  ALREADY_SOLD = 'already_sold',
  PROHIBITED = 'prohibited',
  SPAM = 'spam',
  OTHER = 'other',
}

export enum ReportStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

/** A user complaint about a listing — feeds the admin reports queue. */
@Entity('reports')
@Index('idx_reports_status_created', ['status', 'createdAt'])
@Index('idx_reports_listing', ['listingId'])
@Index('idx_reports_reporter_listing', ['reporterId', 'listingId'], { unique: true })
export class Report extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'listing_id', type: 'uuid' })
  listingId: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing: Listing;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'reporter_id', type: 'uuid' })
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @ApiProperty({ enum: ReportReason })
  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @ApiProperty({ enum: ReportStatus })
  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.OPEN })
  status: ReportStatus;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ name: 'resolved_by_id', type: 'uuid', nullable: true })
  resolvedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolved_by_id' })
  resolvedBy: User | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote: string | null;
}
