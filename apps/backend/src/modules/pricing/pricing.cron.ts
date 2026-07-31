import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PricingService } from './pricing.service';

/**
 * The nightly index snapshot.
 *
 * It runs at 01:00 rather than at midnight because the boundary is where the
 * day's listings are still landing, and a snapshot taken mid-write gives a
 * sample size that disagrees with the next morning's data.
 *
 * The job is idempotent (ON CONFLICT DO UPDATE on the day+key unique index), so
 * a missed night can be backfilled by re-running it and a double fire is
 * harmless. That property is what makes it safe to run on more than one
 * instance, which is the deployment this will end up in.
 */
@Injectable()
export class PricingCron {
  private readonly logger = new Logger('PricingCron');

  constructor(private readonly pricing: PricingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'price-index-snapshot' })
  async snapshot(): Promise<void> {
    try {
      await this.pricing.snapshot();
    } catch (error) {
      // Never rethrow: an unhandled rejection in a scheduled job takes the
      // process down, and a missing day of index is recoverable while a
      // crash-looping API is not.
      this.logger.error(`Price index snapshot failed: ${String(error)}`);
    }
  }
}
