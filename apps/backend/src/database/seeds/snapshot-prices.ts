import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { PricingService } from '../../modules/pricing/pricing.service';

/**
 * Runs the price-index snapshot by hand.
 *
 * The cron covers the normal case, but a night is missed whenever the API was
 * down at 01:00 — and without an entry point the only recovery would be to wait
 * for the gap to scroll out of the chart. The job is idempotent, so re-running
 * a day that already exists is safe and simply refreshes it.
 *
 *   npm run price:snapshot              # today
 *   npm run price:snapshot 2026-07-30   # one past day
 *   npm run price:snapshot 2026-07-01 2026-07-30   # an inclusive range
 *
 * Booted through the Nest context rather than a bare DataSource so the service
 * gets the same Redis client as the app and its cache invalidation actually
 * clears the keys the API is serving.
 */
async function main(): Promise<void> {
  const [from, to] = process.argv.slice(2);

  const days: Array<string | undefined> = [];
  if (!from) {
    days.push(undefined);
  } else if (!to) {
    days.push(from);
  } else {
    for (const day = new Date(from); day <= new Date(to); day.setDate(day.getDate() + 1)) {
      days.push(day.toISOString().slice(0, 10));
    }
  }

  if (days.length > 366) {
    throw new Error('Refusing to backfill more than a year in one run');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const pricing = app.get(PricingService);
    let total = 0;
    for (const day of days) {
      total += await pricing.snapshot(day);
    }
    console.log(`Price index: ${total} row(s) across ${days.length} day(s)`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
