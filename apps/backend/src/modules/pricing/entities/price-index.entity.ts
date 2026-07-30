import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Category, QuantityUnit } from '../../catalog/entities/category.entity';
import { Region } from '../../geo/entities/region.entity';

/**
 * One row per (day, category, region, unit): the median/quartile prices of that
 * day's active listings. Feeds the Home "Bugungi bozor narxi" card and the AI
 * price suggestion.
 */
@Entity('price_index')
@Index('idx_price_index_unique', ['day', 'categoryId', 'regionId', 'unit'], { unique: true })
@Index('idx_price_index_lookup', ['categoryId', 'regionId', 'day'])
export class PriceIndex extends BaseEntity {
  @ApiProperty({ example: '2026-07-29' })
  @Column({ type: 'date' })
  day: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @ApiProperty({ format: 'uuid', nullable: true, description: 'null means the national index' })
  @Column({ name: 'region_id', type: 'uuid', nullable: true })
  regionId: string | null;

  @ManyToOne(() => Region, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'region_id' })
  region: Region | null;

  @ApiProperty({ enum: QuantityUnit })
  @Column({ type: 'enum', enum: QuantityUnit })
  unit: QuantityUnit;

  @ApiProperty({ description: '25th percentile' })
  @Column({ name: 'price_min', type: 'numeric', precision: 14, scale: 2 })
  priceMin: string;

  @ApiProperty({ description: 'Median' })
  @Column({ name: 'price_avg', type: 'numeric', precision: 14, scale: 2 })
  priceAvg: string;

  @ApiProperty({ description: '75th percentile' })
  @Column({ name: 'price_max', type: 'numeric', precision: 14, scale: 2 })
  priceMax: string;

  @ApiProperty({ description: 'Percent change vs the previous recorded day' })
  @Column({ name: 'trend_pct', type: 'numeric', precision: 6, scale: 2, default: 0 })
  trendPct: string;

  @ApiProperty({ description: 'Number of listings the values were computed from' })
  @Column({ name: 'sample_size', type: 'int', default: 0 })
  sampleSize: number;
}
