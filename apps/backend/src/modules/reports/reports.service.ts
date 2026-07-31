import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Listing } from '../listings/entities/listing.entity';
import { Report, ReportReason } from './entities/report.entity';

/** Postgres unique-violation code. */
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
  ) {}

  /**
   * One report per (user, listing) — the unique index enforces it, and the
   * violation is translated into an Uzbek message rather than a 500. Repeat
   * pressing of the complaint button must not multiply queue entries.
   */
  async create(
    listingId: string,
    reporterId: string,
    reason: ReportReason,
    comment?: string,
  ): Promise<Report> {
    const listing = await this.listings.findOne({ where: { id: listingId } });
    if (!listing) {
      throw new NotFoundException("E'lon topilmadi");
    }

    try {
      return await this.reports.save(
        this.reports.create({
          listingId,
          reporterId,
          reason,
          comment: comment?.trim() || null,
        }),
      );
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException("Bu e'lon bo'yicha shikoyatingiz allaqachon qabul qilingan");
      }
      throw error;
    }
  }
}
