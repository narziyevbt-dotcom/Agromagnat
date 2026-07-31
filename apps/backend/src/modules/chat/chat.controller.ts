import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequiresPhone } from '../auth/decorators/requires-phone.decorator';
import { ChatService, MessagePage } from './chat.service';
import { ChatSummaryDto, QueryMessagesDto, SendMessageDto } from './dto/chat.dto';
import { CreateOfferDto, OfferDto } from './dto/offer.dto';
import { Message } from './entities/message.entity';
import { OffersService } from './offers.service';

@ApiTags('chat')
@ApiBearerAuth()
@Controller()
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly offers: OffersService,
  ) {}

  @RequiresPhone()
  @Post('listings/:id/chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open the conversation about a listing, or return the existing one' })
  open(@Param('id', ParseUUIDPipe) listingId: string, @CurrentUser('sub') buyerId: string) {
    return this.chat.openChat(listingId, buyerId);
  }

  @Get('chats')
  @ApiOperation({ summary: "The caller's inbox, most recent first" })
  @ApiOkResponse({ type: ChatSummaryDto, isArray: true })
  inbox(@CurrentUser('sub') userId: string): Promise<ChatSummaryDto[]> {
    return this.chat.findInbox(userId);
  }

  /** Declared before :id so "unread" is never parsed as a chat id. */
  @Get('chats/unread-count')
  @ApiOperation({ summary: 'Total unread messages — the bottom-nav badge' })
  unread(@CurrentUser('sub') userId: string) {
    return this.chat.unreadTotal(userId);
  }

  @Get('chats/:id')
  @ApiOperation({ summary: 'One conversation, as the caller sees it' })
  @ApiOkResponse({ type: ChatSummaryDto })
  findOne(
    @Param('id', ParseUUIDPipe) chatId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<ChatSummaryDto> {
    return this.chat.findOneForUser(chatId, userId);
  }

  @Get('chats/:id/messages')
  @ApiOperation({ summary: 'History, newest first, cursor-paginated' })
  messages(
    @Param('id', ParseUUIDPipe) chatId: string,
    @CurrentUser('sub') userId: string,
    @Query() query: QueryMessagesDto,
  ): Promise<MessagePage> {
    return this.chat.findMessages(chatId, userId, query.cursor, query.limit);
  }

  @RequiresPhone()
  @Post('chats/:id/messages')
  @ApiOperation({ summary: 'Send a message (idempotent when a clientId is supplied)' })
  @ApiOkResponse({ type: Message })
  send(
    @Param('id', ParseUUIDPipe) chatId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: SendMessageDto,
  ): Promise<Message> {
    return this.chat.sendMessage(chatId, userId, dto);
  }

  @Post('chats/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark the other side\'s messages read and clear the badge' })
  read(@Param('id', ParseUUIDPipe) chatId: string, @CurrentUser('sub') userId: string) {
    return this.chat.markRead(chatId, userId);
  }

  // ------------------------------------------------------------- offers

  @Get('chats/:id/offers')
  @ApiOperation({ summary: 'Every offer in a conversation, newest first' })
  @ApiOkResponse({ type: [OfferDto] })
  listOffers(
    @Param('id', ParseUUIDPipe) chatId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<OfferDto[]> {
    return this.offers.findForChat(chatId, userId);
  }

  @RequiresPhone()
  @Post('chats/:id/offers')
  @ApiOperation({ summary: 'Propose a price. One live offer per side per chat.' })
  @ApiOkResponse({ type: OfferDto })
  createOffer(
    @Param('id', ParseUUIDPipe) chatId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateOfferDto,
  ): Promise<OfferDto> {
    return this.offers.create(chatId, userId, dto);
  }

  @RequiresPhone()
  @Post('offers/:id/accept')
  @ApiOperation({
    summary: "Accept — closes the sale at the agreed price and expires rival offers",
  })
  @ApiOkResponse({ type: OfferDto })
  acceptOffer(
    @Param('id', ParseUUIDPipe) offerId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<OfferDto> {
    return this.offers.accept(offerId, userId);
  }

  @Post('offers/:id/decline')
  @ApiOperation({ summary: "Decline the other side's offer" })
  @ApiOkResponse({ type: OfferDto })
  declineOffer(
    @Param('id', ParseUUIDPipe) offerId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<OfferDto> {
    return this.offers.decline(offerId, userId);
  }

  @Post('offers/:id/withdraw')
  @ApiOperation({ summary: 'Withdraw your own pending offer' })
  @ApiOkResponse({ type: OfferDto })
  withdrawOffer(
    @Param('id', ParseUUIDPipe) offerId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<OfferDto> {
    return this.offers.withdraw(offerId, userId);
  }
}
