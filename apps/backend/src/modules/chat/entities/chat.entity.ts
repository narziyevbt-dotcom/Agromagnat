import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Listing } from '../../listings/entities/listing.entity';
import { User } from '../../users/entities/user.entity';
import { Message } from './message.entity';

/** Exactly one conversation per (listing, buyer) pair. */
@Entity('chats')
@Index('idx_chats_listing_buyer', ['listingId', 'buyerId'], { unique: true })
@Index('idx_chats_buyer', ['buyerId', 'lastMessageAt'])
@Index('idx_chats_seller', ['sellerId', 'lastMessageAt'])
export class Chat extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'listing_id', type: 'uuid' })
  listingId: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing: Listing;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'buyer_id', type: 'uuid' })
  buyerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @ApiProperty({ format: 'uuid', description: 'Denormalised from the listing for cheap list queries' })
  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @ApiProperty({ nullable: true })
  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @ApiProperty({ nullable: true, description: 'Preview text for the chat list' })
  @Column({ name: 'last_message_text', type: 'varchar', length: 300, nullable: true })
  lastMessageText: string | null;

  @ApiProperty({ description: 'Unread messages for the buyer' })
  @Column({ name: 'buyer_unread_count', type: 'int', default: 0 })
  buyerUnreadCount: number;

  @ApiProperty({ description: 'Unread messages for the seller' })
  @Column({ name: 'seller_unread_count', type: 'int', default: 0 })
  sellerUnreadCount: number;

  @OneToMany(() => Message, (message) => message.chat)
  messages: Message[];
}
