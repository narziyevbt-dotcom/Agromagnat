import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Category, QuantityUnit } from '../../modules/catalog/entities/category.entity';
import { District } from '../../modules/geo/entities/district.entity';
import { Region } from '../../modules/geo/entities/region.entity';
import {
  DeliveryOption,
  Listing,
  ListingStatus,
  PriceUnit,
} from '../../modules/listings/entities/listing.entity';
import { User } from '../../modules/users/entities/user.entity';
import dataSource from '../data-source';

/**
 * Development-only demo data.
 *
 * The dashboard chart plots a six-month median per category, which needs
 * listings spread across those months — a fresh database has none, so the chart
 * would render empty and tell you nothing about whether it works. This writes
 * plausible history so the UI can be judged.
 *
 * Everything it creates is tagged with DEMO_PHONE_PREFIX so `--clean` can
 * remove it without touching real rows.
 */
const DEMO_PHONE_PREFIX = '+99899';

const SELLERS = [
  { phone: `${DEMO_PHONE_PREFIX}0000001`, name: 'Anvar Rahimov', verified: true },
  { phone: `${DEMO_PHONE_PREFIX}0000002`, name: 'Dilshod Karimov', verified: true },
  { phone: `${DEMO_PHONE_PREFIX}0000003`, name: 'Sardor Yusupov', verified: false },
];

interface Template {
  title: string;
  categorySlug: string;
  /** Median price in so'm/kg six months ago. */
  basePrice: number;
  /** Fractional change applied per month, compounding — seasonality. */
  monthlyDrift: number;
  quantity: number;
  quantityUnit: QuantityUnit;
  seasonMonths: number[];
  description: string;
}

const TEMPLATES: Template[] = [
  {
    title: 'Pomidor, birinchi navli',
    categorySlug: 'sabzavotlar',
    basePrice: 9000,
    monthlyDrift: 0.09,
    quantity: 12,
    quantityUnit: QuantityUnit.TON,
    seasonMonths: [6, 7, 8, 9],
    description: "Issiqxona pomidori, yangi uzilgan. Qadoqlash o'zimizda.",
  },
  {
    title: 'Bodring, yangi uzilgan',
    categorySlug: 'sabzavotlar',
    basePrice: 7500,
    monthlyDrift: 0.06,
    quantity: 4,
    quantityUnit: QuantityUnit.TON,
    seasonMonths: [5, 6, 7, 8],
    description: "Kunlik yig'im, sifat kafolatlanadi.",
  },
  {
    title: 'Kartoshka, oq nav',
    categorySlug: 'sabzavotlar',
    basePrice: 5200,
    monthlyDrift: 0.04,
    quantity: 25,
    quantityUnit: QuantityUnit.TON,
    seasonMonths: [7, 8, 9, 10],
    description: "Omborda saqlanadi, yirik partiya mavjud.",
  },
  {
    title: 'Uzum, husayni',
    categorySlug: 'mevalar',
    basePrice: 14000,
    monthlyDrift: -0.05,
    quantity: 8,
    quantityUnit: QuantityUnit.TON,
    seasonMonths: [8, 9, 10],
    description: "Shirin, donasi yirik. Eksportga mos.",
  },
  {
    title: 'Olma, golden',
    categorySlug: 'mevalar',
    basePrice: 11000,
    monthlyDrift: 0.03,
    quantity: 15,
    quantityUnit: QuantityUnit.TON,
    seasonMonths: [9, 10, 11],
    description: "Sovutgichda saqlangan, uzoq muddat chidaydi.",
  },
  {
    title: "O'rik, qandak",
    categorySlug: 'mevalar',
    basePrice: 18000,
    monthlyDrift: -0.08,
    quantity: 3,
    quantityUnit: QuantityUnit.TON,
    seasonMonths: [6, 7],
    description: "Qandak navi, mazasi shirin.",
  },
  {
    title: "Bug'doy, yumshoq nav",
    categorySlug: 'don-va-dukkak',
    basePrice: 4200,
    monthlyDrift: 0.05,
    quantity: 60,
    quantityUnit: QuantityUnit.TON,
    seasonMonths: [6, 7, 8],
    description: "Namligi 13%, tozalangan. Yirik partiya.",
  },
  {
    title: 'Makkajoxori, yem uchun',
    categorySlug: 'don-va-dukkak',
    basePrice: 3400,
    monthlyDrift: 0.07,
    quantity: 40,
    quantityUnit: QuantityUnit.TON,
    seasonMonths: [9, 10],
    description: 'Chorva ozuqasi uchun, quritilgan.',
  },
  {
    title: 'Qovun, mirzachul',
    categorySlug: 'poliz',
    basePrice: 6000,
    monthlyDrift: -0.04,
    quantity: 10,
    quantityUnit: QuantityUnit.TON,
    seasonMonths: [7, 8, 9],
    description: "Mirzacho'l navi, xushbo'y.",
  },
];

const DISTRICT_SLUGS = ['urgut', 'payariq', 'jomboy', 'bulungur', 'toyloq'];

/** Deterministic jitter so repeated runs produce the same medians. */
function jitter(seed: number, spread: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * spread;
}

async function clean(ds: DataSource): Promise<void> {
  const users = await ds
    .getRepository(User)
    .createQueryBuilder('user')
    .where('user.phone LIKE :prefix', { prefix: `${DEMO_PHONE_PREFIX}%` })
    .getMany();

  if (!users.length) {
    console.log('No demo data to remove.');
    return;
  }

  const ids = users.map((user) => user.id);
  await ds
    .getRepository(Listing)
    .createQueryBuilder()
    .delete()
    .where('seller_id IN (:...ids)', { ids })
    .execute();
  await ds.getRepository(User).delete(ids);

  console.log(`Removed ${users.length} demo seller(s) and their listings.`);
}

async function main(): Promise<void> {
  const ds = await dataSource.initialize();

  try {
    if (process.argv.includes('--clean')) {
      await clean(ds);
      return;
    }

    // Re-seeding should replace, not accumulate.
    await clean(ds);

    const userRepo = ds.getRepository(User);
    const listingRepo = ds.getRepository(Listing);
    const categoryRepo = ds.getRepository(Category);
    const regionRepo = ds.getRepository(Region);
    const districtRepo = ds.getRepository(District);

    const region = await regionRepo.findOneOrFail({ where: { slug: 'samarqand' } });
    const districts = await districtRepo.find({
      where: DISTRICT_SLUGS.map((slug) => ({ regionId: region.id, slug })),
    });
    if (!districts.length) {
      throw new Error('Run the reference seed first: npm run seed');
    }

    const sellers: User[] = [];
    for (const seed of SELLERS) {
      sellers.push(
        await userRepo.save(
          userRepo.create({
            phone: seed.phone,
            name: seed.name,
            isVerified: seed.verified,
            regionId: region.id,
            districtId: districts[0].id,
          }),
        ),
      );
    }

    const categories = new Map(
      (await categoryRepo.find()).map((category) => [category.slug, category]),
    );

    let created = 0;
    let index = 0;

    // Six months of history: prices drift month over month so the chart has a
    // real shape, and the current month's rows stay active so the feed is not
    // empty either.
    for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo -= 1) {
      for (const template of TEMPLATES) {
        const category = categories.get(template.categorySlug);
        if (!category) continue;

        index += 1;
        const monthsElapsed = 5 - monthsAgo;
        const drifted =
          template.basePrice * (1 + template.monthlyDrift) ** monthsElapsed;
        const price = Math.round((drifted * (1 + jitter(index, 0.06))) / 100) * 100;

        // Day-of-month first, then the month. Subtracting months while the day
        // is the 31st rolls into the following month whenever the target has
        // fewer days, which silently leaves gaps in the series.
        const createdAt = new Date();
        createdAt.setDate(1);
        createdAt.setMonth(createdAt.getMonth() - monthsAgo);
        createdAt.setDate(Math.min(5 + (index % 20), 28));

        const expiresAt = new Date(createdAt);
        expiresAt.setDate(expiresAt.getDate() + 14);

        const isCurrentMonth = monthsAgo === 0;
        const seller = sellers[index % sellers.length];
        const district = districts[index % districts.length];

        const listing = listingRepo.create({
          title: template.title,
          description: template.description,
          categoryId: category.id,
          sellerId: seller.id,
          regionId: region.id,
          districtId: district.id,
          quantity: String(template.quantity),
          quantityUnit: template.quantityUnit,
          // Priced per kg so the chart compares like with like.
          price: String(price),
          priceUnit: PriceUnit.KG,
          minOrder: String(Math.max(1, Math.round(template.quantity / 6))),
          seasonMonths: template.seasonMonths,
          delivery: index % 3 === 0 ? DeliveryOption.BOTH : DeliveryOption.PICKUP,
          status: isCurrentMonth ? ListingStatus.ACTIVE : ListingStatus.EXPIRED,
          expiresAt,
          viewCount: 40 + Math.round(Math.abs(jitter(index, 1)) * 900),
          callCount: 2 + Math.round(Math.abs(jitter(index + 7, 1)) * 40),
          isPromoted: isCurrentMonth && index % 11 === 0,
        });

        const saved = await listingRepo.save(listing);
        // created_at is written by the database default, so backdating needs a
        // second statement.
        await listingRepo.update(saved.id, { createdAt });
        created += 1;
      }
    }

    console.log('Demo seed complete:');
    console.log(`  sellers:  ${sellers.length}`);
    console.log(`  listings: ${created} across 6 months`);
    console.log(`  active:   ${TEMPLATES.length} (current month)`);
  } finally {
    await ds.destroy();
  }
}

main().catch((error) => {
  console.error('Demo seed failed:', error);
  process.exit(1);
});
