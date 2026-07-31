import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PriceUnit, QuantityUnit } from '../../catalog/units';
import { Listing } from '../../listings/entities/listing.entity';
import { User } from '../../users/entities/user.entity';
import { Chat } from './chat.entity';

export enum OfferStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  /** Superseded — another offer on the same listing was accepted. */
  EXPIRED = 'expired',
}

/** Which side of the conversation made the offer. */
export enum OfferRole {
  BUYER = 'buyer',
  SELLER = 'seller',
}

/**
 * A price proposed inside a conversation.
 *
 * The negotiation on a classifieds board normally happens on the phone, which
 * means the platform learns nothing from it — not the agreed price, not
 * whether a sale happened at all. Putting it here turns the single most
 * valuable event in the marketplace into data: an accepted offer both closes
 * the listing and records what it actually cleared at.
 */
@Entity('offers')
@Index('idx_offers_chat_created', ['chatId', 'createdAt'])
export class Offer extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'chat_id', type: 'uuid' })
  chatId: string;

  @ManyToOne(() => Chat, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat: Chat;

  @ApiProperty({ format: 'uuid', description: 'Denormalised so pending offers can be swept by listing' })
  @Column({ name: 'listing_id', type: 'uuid' })
  listingId: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing: Listing;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @ApiProperty({ enum: OfferRole })
  @Column({ name: 'from_role', type: 'enum', enum: OfferRole })
  fromRole: OfferRole;

  @ApiProperty({ example: '12000.00', description: "Proposed price in so'm per priceUnit" })
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount: string;

  @ApiProperty({ enum: PriceUnit })
  @Column({ name: 'price_unit', type: 'enum', enum: PriceUnit })
  priceUnit: PriceUnit;

  @ApiPropertyOptional({ description: 'Volume the offer covers; defaults to the whole listing' })
  @Column({ type: 'numeric', precision: 14, scale: 3, nullable: true })
  quantity: string | null;

  @ApiPropertyOptional({ enum: QuantityUnit })
  @Column({ name: 'quantity_unit', type: 'enum', enum: QuantityUnit, nullable: true })
  quantityUnit: QuantityUnit | null;

  @ApiPropertyOptional({ description: 'One line of context, e.g. "o‘zim olib ketaman"' })
  @Column({ type: 'varchar', length: 300, nullable: true })
  note: string | null;

  @ApiProperty({ enum: OfferStatus })
  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.PENDING })
  status: OfferStatus;

  @ApiPropertyOptional()
  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt: Date | null;
}
