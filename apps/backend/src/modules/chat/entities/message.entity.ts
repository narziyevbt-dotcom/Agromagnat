import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Chat } from './chat.entity';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  SYSTEM = 'system',
  /** A price proposal. `body` is "<offerId>|<preview text>". */
  OFFER = 'offer',
}

@Entity('messages')
@Index('idx_messages_chat_created', ['chatId', 'createdAt'])
export class Message extends BaseEntity {
  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'chat_id', type: 'uuid' })
  chatId: string;

  @ManyToOne(() => Chat, (chat) => chat.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat: Chat;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @ApiProperty({ enum: MessageType })
  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @ApiProperty()
  @Column({ type: 'text' })
  body: string;

  @ApiProperty({
    nullable: true,
    description: 'Client-generated id, so a message queued offline is not delivered twice',
  })
  @Index('idx_messages_client_id', { unique: true, where: 'client_id IS NOT NULL' })
  @Column({ name: 'client_id', type: 'varchar', length: 64, nullable: true })
  clientId: string | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;
}
