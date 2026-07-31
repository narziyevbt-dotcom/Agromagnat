import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorite } from './entities/favorite.entity';
import { ListingPhoto } from './entities/listing-photo.entity';
import { Listing } from './entities/listing.entity';
import { ListingsController, MeFavoritesController } from './listings.controller';
import { ListingsCron } from './listings.cron';
import { ListingsService } from './listings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing, ListingPhoto, Favorite])],
  controllers: [ListingsController, MeFavoritesController],
  providers: [ListingsService, ListingsCron],
  exports: [ListingsService],
})
export class ListingsModule {}
