import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Listing } from './listing.entity';

/** Up to 5 per listing; the first (sortOrder 0) is the cover. */
@Entity('listing_photos')
@Index('idx_listing_photos_listing', ['listingId', 'sortOrder'])
export class ListingPhoto extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'listing_id', type: 'uuid' })
  listingId: string;

  @ManyToOne(() => Listing, (listing) => listing.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing: Listing;

  @ApiProperty({ description: 'Object key in the S3 bucket' })
  @Column({ name: 'object_key', length: 500 })
  objectKey: string;

  @ApiProperty({ description: 'Publicly reachable URL, resized to 1280px on the long side' })
  @Column({ length: 700 })
  url: string;

  @ApiProperty({ nullable: true })
  @Column({ name: 'thumb_url', type: 'varchar', length: 700, nullable: true })
  thumbUrl: string | null;

  @ApiProperty()
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ApiProperty({ nullable: true })
  @Column({ name: 'width', type: 'int', nullable: true })
  width: number | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'height', type: 'int', nullable: true })
  height: number | null;

  @ApiProperty({ nullable: true, description: 'Bytes' })
  @Column({ name: 'size_bytes', type: 'int', nullable: true })
  sizeBytes: number | null;
}
