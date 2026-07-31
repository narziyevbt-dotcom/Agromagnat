import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../catalog/entities/category.entity';
import { Favorite } from './entities/favorite.entity';
import { ListingPhoto } from './entities/listing-photo.entity';
import { Listing } from './entities/listing.entity';
import { ListingsController, MeFavoritesController } from './listings.controller';
import { ListingsCron } from './listings.cron';
import { ListingsService } from './listings.service';

@Module({
  // Category is read-only here — the posting form's field spec hangs off it,
  // and create/update validate against that spec.
  imports: [TypeOrmModule.forFeature([Listing, ListingPhoto, Favorite, Category])],
  controllers: [ListingsController, MeFavoritesController],
  providers: [ListingsService, ListingsCron],
  exports: [ListingsService],
})
export class ListingsModule {}
