import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '../listings/entities/listing.entity';
import { Report } from '../reports/entities/report.entity';
import { ReviewsModule } from '../reviews/reviews.module';
import { User } from '../users/entities/user.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing, User, Report]), ReviewsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
