import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingPhoto } from '../listings/entities/listing-photo.entity';
import { Listing } from '../listings/entities/listing.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { OffersService } from './offers.service';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';
import { Offer } from './entities/offer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, Message, Offer, Listing, ListingPhoto, User]),
    NotificationsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, OffersService],
  exports: [ChatService, OffersService],
})
export class ChatModule {}
