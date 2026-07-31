import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../listings/entities/listing.entity';
import { PriceIndex } from './entities/price-index.entity';
import { PricingController } from './pricing.controller';
import { PricingCron } from './pricing.cron';
import { PricingService } from './pricing.service';

@Module({
  imports: [TypeOrmModule.forFeature([PriceIndex, Listing])],
  controllers: [PricingController],
  providers: [PricingService, PricingCron],
  exports: [PricingService],
})
export class PricingModule {}
