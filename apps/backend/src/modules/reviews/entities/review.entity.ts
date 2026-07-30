import { ApiProperty } from '@nestjs/swagger';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Listing } from '../../listings/entities/listing.entity';
import { User } from '../../users/entities/user.entity';

/** A buyer rates a seller once per completed (sold) listing. */
@Entity('reviews')
@Index('idx_reviews_listing_author', ['listingId', 'authorId'], { unique: true })
@Index('idx_reviews_seller', ['sellerId', 'createdAt'])
@Check('chk_reviews_rating', 'rating BETWEEN 1 AND 5')
export class Review extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'listing_id', type: 'uuid' })
  listingId: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing: Listing;

  @ApiProperty({ format: 'uuid', description: 'The buyer writing the review' })
  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @ApiProperty({ format: 'uuid', description: 'The seller being reviewed' })
  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Column({ type: 'smallint' })
  rating: number;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @ApiProperty({ description: 'Hidden by a moderator' })
  @Column({ name: 'is_hidden', type: 'boolean', default: false })
  isHidden: boolean;
}
