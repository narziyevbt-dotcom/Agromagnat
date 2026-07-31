import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequiresPhone } from '../auth/decorators/requires-phone.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateListingDto, UpdateListingDto } from './dto/create-listing.dto';
import { PaginatedListingsDto, QueryListingsDto } from './dto/query-listings.dto';
import { ListingPhoto } from './entities/listing-photo.entity';
import { Listing } from './entities/listing.entity';
import { LISTING_TTL_DAYS, MAX_PHOTOS, ListingsService } from './listings.service';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Feed and search with filters, cursor-paginated' })
  @ApiOkResponse({ type: PaginatedListingsDto })
  findAll(
    @Query() query: QueryListingsDto,
    @CurrentUser('sub') viewerId?: string,
  ): Promise<PaginatedListingsDto<Listing>> {
    return this.listings.findAll(query, viewerId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: "The caller's own listings, any status" })
  findMine(
    @CurrentUser('sub') userId: string,
    @Query() query: QueryListingsDto,
  ): Promise<PaginatedListingsDto<Listing>> {
    return this.listings.findAll({ ...query, sellerId: userId }, userId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Listing detail; increments view_count' })
  @ApiOkResponse({ type: Listing })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') viewerId?: string,
  ): Promise<Listing> {
    return this.listings.findOneForViewer(id, viewerId);
  }

  @RequiresPhone()
  // Twenty listings an hour is far above any real seller and far below what a
  // script needs to be worth writing. Shared with editing so a bot cannot post
  // twenty and then rewrite them into twenty more.
  @RateLimit({ bucket: 'listing:write', limit: 20, windowSeconds: 3600 })
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Publish a listing (active, expires in 14 days)" })
  @ApiOkResponse({ type: Listing })
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateListingDto,
  ): Promise<Listing> {
    return this.listings.create(userId, dto);
  }

  @RequiresPhone()
  @RateLimit({ bucket: 'listing:write', limit: 20, windowSeconds: 3600 })
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit own listing' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateListingDto,
  ): Promise<Listing> {
    return this.listings.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete own listing' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ): Promise<void> {
    return this.listings.remove(id, userId);
  }

  @Post(':id/renew')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Put an expired listing back on the market for ${LISTING_TTL_DAYS} more days`,
  })
  renew(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ): Promise<Listing> {
    return this.listings.renew(id, userId);
  }

  @Post(':id/sold')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark own listing sold' })
  markSold(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ): Promise<Listing> {
    return this.listings.markSold(id, userId);
  }

  @Public()
  @Post(':id/call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a tap on "Qo\'ng\'iroq qilish" (north-star metric)' })
  registerCall(@Param('id', ParseUUIDPipe) id: string): Promise<{ callCount: number }> {
    return this.listings.registerCall(id);
  }

  // -------------------------------------------------------------- photos

  @Post(':id/photos')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: `Upload up to ${MAX_PHOTOS} photos; resized to 1280px` })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', MAX_PHOTOS))
  addPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
    @UploadedFiles() files: Array<{ buffer: Buffer; mimetype: string; size: number }>,
  ): Promise<ListingPhoto[]> {
    return this.listings.addPhotos(id, userId, files ?? []);
  }

  @Delete(':id/photos/:photoId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one photo' })
  removePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<void> {
    return this.listings.removePhoto(id, photoId, userId);
  }

  // ------------------------------------------------------------ favorites

  @RequiresPhone()
  // Saving is cheap and people do it in bursts while browsing, so this is set
  // to stop a scraper walking the catalogue rather than to shape behaviour.
  @RateLimit({ bucket: 'favorite', limit: 120, windowSeconds: 3600 })
  @Post(':id/favorite')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Save to favorites' })
  addFavorite(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ): Promise<void> {
    return this.listings.addFavorite(id, userId);
  }

  @RequiresPhone()
  @Delete(':id/favorite')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove from favorites' })
  removeFavorite(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ): Promise<void> {
    return this.listings.removeFavorite(id, userId);
  }
}

@ApiTags('listings')
@Controller('me')
export class MeFavoritesController {
  constructor(private readonly listings: ListingsService) {}

  @Get('favorites')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Saved listings, most recently saved first' })
  @ApiOkResponse({ type: [Listing] })
  findFavorites(@CurrentUser('sub') userId: string): Promise<Listing[]> {
    return this.listings.findFavorites(userId);
  }
}
