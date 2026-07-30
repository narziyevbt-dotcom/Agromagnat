import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Region } from './region.entity';

/** Second-level unit (tuman / shahar) belonging to a region. */
@Entity('districts')
@Index('idx_districts_region', ['regionId'])
@Index('idx_districts_region_slug', ['regionId', 'slug'], { unique: true })
export class District extends BaseEntity {
  @ApiProperty({ example: 'Urgut tumani' })
  @Column({ name: 'name_uz', length: 120 })
  nameUz: string;

  @ApiProperty({ example: 'Ургутский район' })
  @Column({ name: 'name_ru', length: 120 })
  nameRu: string;

  @ApiProperty({ example: 'urgut' })
  @Column({ length: 80 })
  slug: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'region_id', type: 'uuid' })
  regionId: string;

  @ManyToOne(() => Region, (region) => region.districts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'region_id' })
  region: Region;
}
