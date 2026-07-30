import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Measurement unit a listing's quantity is expressed in. */
export enum QuantityUnit {
  KG = 'kg',
  TON = 't',
  PIECE = 'dona',
  BOX = 'quti',
  BAG = 'qop',
  LITER = 'l',
  HECTARE = 'ga',
  SERVICE = 'xizmat',
}

/** One of the 12 agro categories; supports one level of nesting via parentId. */
@Entity('categories')
export class Category extends BaseEntity {
  @ApiProperty({ example: 'Mevalar' })
  @Column({ name: 'name_uz', length: 120 })
  nameUz: string;

  @ApiProperty({ example: 'Фрукты' })
  @Column({ name: 'name_ru', length: 120 })
  nameRu: string;

  @ApiProperty({ example: 'mevalar' })
  @Index('idx_categories_slug', { unique: true })
  @Column({ length: 80 })
  slug: string;

  @ApiProperty({ description: 'Icon key resolved by the mobile app', example: 'apple' })
  @Column({ type: 'varchar', length: 60, nullable: true })
  icon: string | null;

  @ApiProperty({ enum: QuantityUnit, description: 'Unit pre-selected when posting in this category' })
  @Column({
    name: 'unit_default',
    type: 'enum',
    enum: QuantityUnit,
    default: QuantityUnit.KG,
  })
  unitDefault: QuantityUnit;

  @ApiProperty({ format: 'uuid', nullable: true })
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @ApiProperty({ description: 'Display order on the Home grid' })
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ApiProperty({ description: 'Shown in the 8-icon Home grid' })
  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;
}
