import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/base.entity';
import { Category } from '../../catalog/entities/category.entity';
import { PriceUnit, QuantityUnit } from '../../catalog/units';
import { District } from '../../geo/entities/district.entity';
import { Region } from '../../geo/entities/region.entity';
import { User } from '../../users/entities/user.entity';
import { ListingPhoto } from './listing-photo.entity';

export enum ListingStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  ACTIVE = 'active',
  SOLD = 'sold',
  EXPIRED = 'expired',
  BLOCKED = 'blocked',
}

export { PriceUnit, QuantityUnit };

export enum DeliveryOption {
  NONE = 'none',
  PICKUP = 'pickup',
  DELIVERY = 'delivery',
  BOTH = 'both',
}

/**
 * A harvest offer. Category, quantity+unit, price+unit, region and district are
 * mandatory — that mandatory volume field is what separates Agromagnat from a
 * generic classifieds board.
 */
@Entity('listings')
// Primary feed/filter path: active listings in a region, in a category.
@Index('idx_listings_status_region_category', ['status', 'regionId', 'categoryId'])
@Index('idx_listings_created_at', ['createdAt'])
@Index('idx_listings_seller', ['sellerId'])
@Index('idx_listings_expires_at', ['expiresAt'])
@Index('idx_listings_promoted', ['isPromoted', 'promotedUntil'])
export class Listing extends SoftDeletableEntity {
  @ApiProperty({ example: "Urgut pomidori, 12 tonna" })
  @Column({ length: 160 })
  title: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ description: 'Auto-translated RU title', nullable: true })
  @Column({ name: 'title_ru', type: 'varchar', length: 160, nullable: true })
  titleRu: string | null;

  @ApiProperty({ description: 'Auto-translated RU description', nullable: true })
  @Column({ name: 'description_ru', type: 'text', nullable: true })
  descriptionRu: string | null;

  @ApiProperty({ enum: ListingStatus })
  @Column({ type: 'enum', enum: ListingStatus, default: ListingStatus.ACTIVE })
  status: ListingStatus;

  // ---- Seller ----

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  // ---- Category ----

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  // ---- Volume and price (both mandatory) ----

  @ApiProperty({ example: '12.000', description: 'Available volume' })
  @Column({ type: 'numeric', precision: 14, scale: 3 })
  quantity: string;

  @ApiProperty({ enum: QuantityUnit })
  @Column({ name: 'quantity_unit', type: 'enum', enum: QuantityUnit })
  quantityUnit: QuantityUnit;

  @ApiProperty({ example: '14000.00', description: "Price in so'm per price_unit" })
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  price: string;

  @ApiProperty({ enum: PriceUnit })
  @Column({ name: 'price_unit', type: 'enum', enum: PriceUnit })
  priceUnit: PriceUnit;

  @ApiProperty({ nullable: true, description: 'Minimum wholesale lot, same unit as quantity' })
  @Column({ name: 'min_order', type: 'numeric', precision: 14, scale: 3, nullable: true })
  minOrder: string | null;

  @ApiProperty({ nullable: true, description: 'Discounted price for buyers taking min_order or more' })
  @Column({ name: 'wholesale_price', type: 'numeric', precision: 14, scale: 2, nullable: true })
  wholesalePrice: string | null;

  // ---- Location ----

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'region_id', type: 'uuid' })
  regionId: string;

  @ManyToOne(() => Region, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'region_id' })
  region: Region;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'district_id', type: 'uuid' })
  districtId: string;

  @ManyToOne(() => District, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'district_id' })
  district: District;

  @ApiProperty({ nullable: true })
  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @ApiProperty({ nullable: true })
  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  // ---- Optional harvest details ----

  @ApiProperty({ nullable: true, description: 'Date the harvest was picked' })
  @Column({ name: 'harvest_date', type: 'date', nullable: true })
  harvestDate: string | null;

  @ApiProperty({ enum: DeliveryOption })
  @Column({
    name: 'delivery',
    type: 'enum',
    enum: DeliveryOption,
    default: DeliveryOption.NONE,
  })
  delivery: DeliveryOption;

  @ApiProperty({
    description: 'Months (1-12) this product is in season — drives the detail-screen season strip',
    example: [7, 8, 9],
  })
  @Column({ name: 'season_months', type: 'int', array: true, default: () => "'{}'" })
  seasonMonths: number[];

  // ---- Promotion ----

  @ApiProperty({ description: 'Paid TOP placement (saffron badge)' })
  @Column({ name: 'is_promoted', type: 'boolean', default: false })
  isPromoted: boolean;

  @ApiProperty({ nullable: true })
  @Column({ name: 'promoted_until', type: 'timestamptz', nullable: true })
  promotedUntil: Date | null;

  // ---- Counters (the north-star metric lives here) ----

  @ApiProperty()
  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @ApiProperty({ description: 'Times "Qo\'ng\'iroq qilish" was pressed — the north-star metric' })
  @Column({ name: 'call_count', type: 'int', default: 0 })
  callCount: number;

  @ApiProperty()
  @Column({ name: 'favorite_count', type: 'int', default: 0 })
  favoriteCount: number;

  // ---- Lifecycle ----

  @ApiProperty({ description: 'Auto-archived 14 days after publication' })
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'sold_at', type: 'timestamptz', nullable: true })
  soldAt: Date | null;

  /**
   * What the listing actually cleared at, set when an offer is accepted.
   *
   * Distinct from `price`, which is the asking price and stays untouched.
   * Agricultural sales close below asking almost every time, so a price index
   * built on `price` alone reads systematically high — see docs/PRICING.md.
   * Null when the seller marked the listing sold by hand without a deal.
   */
  @ApiProperty({ nullable: true, description: 'Agreed price, per price_unit' })
  @Column({ name: 'sold_price', type: 'numeric', precision: 14, scale: 2, nullable: true })
  soldPrice: string | null;

  @ApiProperty({ nullable: true, description: 'Volume the accepted offer covered' })
  @Column({ name: 'sold_quantity', type: 'numeric', precision: 14, scale: 3, nullable: true })
  soldQuantity: string | null;

  // ---- Moderation ----

  @ApiProperty({ nullable: true, description: 'Latest AI verdict: allow | review | block' })
  @Column({ name: 'moderation_verdict', type: 'varchar', length: 20, nullable: true })
  moderationVerdict: string | null;

  @ApiProperty({ nullable: true, description: 'Uzbek explanation shown to the seller when blocked' })
  @Column({ name: 'moderation_reason', type: 'text', nullable: true })
  moderationReason: string | null;

  /**
   * Category-specific answers — a tractor's year and condition, a plot's
   * tenure, a crop's grade. Validated against the category's field spec on
   * write (see `category-forms.ts`), so the bag only ever holds keys the spec
   * declares.
   */
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { condition: 'used', year: 2018, brand: 'MTZ-82' },
  })
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  attributes: Record<string, string | number>;

  @OneToMany(() => ListingPhoto, (photo) => photo.listing, { cascade: ['remove'] })
  photos: ListingPhoto[];
}
