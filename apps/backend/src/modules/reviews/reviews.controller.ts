import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateReviewDto, SellerReviewsDto } from './dto/review.dto';
import { Review } from './entities/review.entity';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('sellers/:id/reviews')
  @ApiOperation({ summary: "A seller's visible reviews with the star histogram" })
  @ApiOkResponse({ type: SellerReviewsDto })
  findForSeller(
    @Param('id', ParseUUIDPipe) sellerId: string,
    @Query('page') page?: string,
  ): Promise<SellerReviewsDto> {
    return this.reviews.findForSeller(sellerId, page ? parseInt(page, 10) : 1);
  }

  @Post('listings/:id/review')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rate the seller of a sold listing (one review per listing)' })
  @ApiOkResponse({ type: Review })
  create(
    @Param('id', ParseUUIDPipe) listingId: string,
    @CurrentUser('sub') authorId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<Review> {
    return this.reviews.create(listingId, authorId, dto);
  }

  @Get('listings/:id/review')
  @ApiBearerAuth()
  @ApiOperation({ summary: "The caller's own review of a listing, or null" })
  findMine(
    @Param('id', ParseUUIDPipe) listingId: string,
    @CurrentUser('sub') authorId: string,
  ): Promise<Review | null> {
    return this.reviews.findMine(listingId, authorId);
  }
}
