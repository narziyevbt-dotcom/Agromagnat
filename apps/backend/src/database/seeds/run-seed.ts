import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Category } from '../../modules/catalog/entities/category.entity';
import { District } from '../../modules/geo/entities/district.entity';
import { Region } from '../../modules/geo/entities/region.entity';
import dataSource from '../data-source';
import { CATEGORIES } from './data/categories.data';
import { REGIONS } from './data/regions.data';

/**
 * Idempotent reference-data seed: matches on slug and updates in place, so it is
 * safe to re-run after adding a region or renaming a category.
 */
async function seedRegions(ds: DataSource): Promise<void> {
  const regionRepo = ds.getRepository(Region);
  const districtRepo = ds.getRepository(District);

  for (const [index, seed] of REGIONS.entries()) {
    let region = await regionRepo.findOne({ where: { slug: seed.slug } });
    if (region) {
      Object.assign(region, {
        nameUz: seed.nameUz,
        nameRu: seed.nameRu,
        lat: seed.lat,
        lng: seed.lng,
        sortOrder: index,
      });
    } else {
      region = regionRepo.create({
        nameUz: seed.nameUz,
        nameRu: seed.nameRu,
        slug: seed.slug,
        lat: seed.lat,
        lng: seed.lng,
        sortOrder: index,
      });
    }
    region = await regionRepo.save(region);

    for (const districtSeed of seed.districts) {
      const existing = await districtRepo.findOne({
        where: { regionId: region.id, slug: districtSeed.slug },
      });
      if (existing) {
        existing.nameUz = districtSeed.nameUz;
        existing.nameRu = districtSeed.nameRu;
        await districtRepo.save(existing);
      } else {
        await districtRepo.save(
          districtRepo.create({
            regionId: region.id,
            nameUz: districtSeed.nameUz,
            nameRu: districtSeed.nameRu,
            slug: districtSeed.slug,
          }),
        );
      }
    }
  }
}

async function seedCategories(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(Category);

  for (const [index, seed] of CATEGORIES.entries()) {
    const existing = await repo.findOne({ where: { slug: seed.slug } });
    if (existing) {
      Object.assign(existing, {
        nameUz: seed.nameUz,
        nameRu: seed.nameRu,
        icon: seed.icon,
        unitDefault: seed.unitDefault,
        isFeatured: seed.isFeatured,
        sortOrder: index,
      });
      await repo.save(existing);
    } else {
      await repo.save(
        repo.create({
          nameUz: seed.nameUz,
          nameRu: seed.nameRu,
          slug: seed.slug,
          icon: seed.icon,
          unitDefault: seed.unitDefault,
          isFeatured: seed.isFeatured,
          sortOrder: index,
        }),
      );
    }
  }
}

async function main(): Promise<void> {
  const ds = await dataSource.initialize();
  try {
    await seedRegions(ds);
    await seedCategories(ds);

    const regionCount = await ds.getRepository(Region).count();
    const districtCount = await ds.getRepository(District).count();
    const categoryCount = await ds.getRepository(Category).count();

    console.log('Seed complete:');
    console.log(`  regions:    ${regionCount}`);
    console.log(`  districts:  ${districtCount}`);
    console.log(`  categories: ${categoryCount}`);
  } finally {
    await ds.destroy();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
