import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ListingsService } from './listings.service';

/**
 * Hourly expiry sweep.
 *
 * Hourly rather than daily so a listing never lingers a full day past its
 * fourteenth — the freshness of the feed is what a buyer trusts.
 */
@Injectable()
export class ListingsCron {
  private readonly logger = new Logger('ListingsCron');

  constructor(private readonly listings: ListingsService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'expire-listings' })
  async expireStale(): Promise<void> {
    try {
      const count = await this.listings.expireStale();
      if (count > 0) {
        this.logger.log(`Archived ${count} expired listing(s)`);
      }
    } catch (error) {
      this.logger.error(`Expiry sweep failed: ${String(error)}`);
    }
  }
}
