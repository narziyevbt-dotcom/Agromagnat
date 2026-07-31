import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportReason } from './entities/report.entity';
import { ReportsService } from './reports.service';

class CreateReportDto {
  @IsEnum(ReportReason, { message: 'Shikoyat sababi tanlanmagan' })
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  comment?: string;
}

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('listings/:id/report')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Complain about a listing (one per user per listing)' })
  create(
    @Param('id', ParseUUIDPipe) listingId: string,
    @CurrentUser('sub') reporterId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.reports.create(listingId, reporterId, dto.reason, dto.comment);
  }
}
