import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ListingStatus } from '../listings/entities/listing.entity';
import { ReportStatus } from '../reports/entities/report.entity';
import { UserRole } from '../users/entities/user.entity';
import { AdminService } from './admin.service';

class BlockListingDto {
  @IsString()
  @Length(3, 500, { message: "Sabab 3 tadan 500 tagacha belgi bo'lishi kerak" })
  reason: string;
}

class PromoteListingDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  days: number;
}

class SetFlagDto {
  @IsBoolean({ message: "value true yoki false bo'lishi kerak" })
  value: boolean;
}

class ResolveReportDto {
  @IsIn(['resolved', 'rejected'])
  outcome: 'resolved' | 'rejected';

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;
}

/**
 * Everything here requires the admin role. RolesGuard is global, so the
 * class-level @Roles is the single line that locks the whole surface.
 */
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Platform-wide counters for the admin dashboard' })
  overview() {
    return this.admin.overview();
  }

  // ---------------------------------------------------------------- listings

  @Get('listings')
  @ApiOperation({ summary: 'All listings, any status, searchable by title or seller phone' })
  findListings(
    @Query('status') status?: ListingStatus,
    @Query('q') q?: string,
    @Query('page') page?: string,
  ) {
    return this.admin.findListings({
      status: Object.values(ListingStatus).includes(status as ListingStatus)
        ? (status as ListingStatus)
        : undefined,
      q,
      page: page ? parseInt(page, 10) : 1,
    });
  }

  @Post('listings/:id/approve')
  @ApiOperation({ summary: 'Moderation approve: pending -> active with a fresh 14-day clock' })
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.approveListing(id);
  }

  @Post('listings/:id/block')
  @ApiOperation({ summary: 'Block with a reason the seller will see' })
  block(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BlockListingDto) {
    return this.admin.blockListing(id, dto.reason);
  }

  @Post('listings/:id/promote')
  @ApiOperation({ summary: 'Paid TOP placement; days=0 removes it' })
  promote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PromoteListingDto) {
    return this.admin.promoteListing(id, dto.days);
  }

  // ------------------------------------------------------------------- users

  @Get('users')
  @ApiOperation({ summary: 'Users, searchable by phone or name' })
  findUsers(@Query('q') q?: string, @Query('page') page?: string) {
    return this.admin.findUsers({ q, page: page ? parseInt(page, 10) : 1 });
  }

  @Post('users/:id/verify')
  @ApiOperation({ summary: 'Grant or revoke the verified badge' })
  verify(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetFlagDto) {
    return this.admin.setUserVerified(id, dto.value === true);
  }

  @Post('users/:id/block')
  @ApiOperation({ summary: 'Block/unblock a user; blocking also pulls their active listings' })
  blockUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetFlagDto) {
    return this.admin.setUserBlocked(id, dto.value === true);
  }

  // ----------------------------------------------------------------- reports

  @Get('reports')
  @ApiOperation({ summary: 'User complaints, open first' })
  findReports(@Query('status') status?: ReportStatus, @Query('page') page?: string) {
    return this.admin.findReports({
      status: Object.values(ReportStatus).includes(status as ReportStatus)
        ? (status as ReportStatus)
        : undefined,
      page: page ? parseInt(page, 10) : 1,
    });
  }

  @Post('reports/:id/resolve')
  @ApiOperation({ summary: 'Close a report as resolved or rejected' })
  resolveReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.admin.resolveReport(id, adminId, dto.outcome, dto.note);
  }
}
