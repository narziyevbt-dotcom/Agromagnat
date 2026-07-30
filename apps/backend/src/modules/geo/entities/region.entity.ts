import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { District } from './district.entity';

/** One of the 14 first-level administrative units of Uzbekistan. */
@Entity('regions')
export class Region extends BaseEntity {
  @ApiProperty({ example: 'Samarqand viloyati' })
  @Column({ name: 'name_uz', length: 120 })
  nameUz: string;

  @ApiProperty({ example: 'Самаркандская область' })
  @Column({ name: 'name_ru', length: 120 })
  nameRu: string;

  @ApiProperty({ example: 'samarqand' })
  @Index('idx_regions_slug', { unique: true })
  @Column({ length: 80 })
  slug: string;

  @ApiProperty({ example: 39.627 })
  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @ApiProperty({ example: 66.975 })
  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @ApiProperty({ description: 'Display order in pickers' })
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => District, (district) => district.region)
  districts: District[];
}
