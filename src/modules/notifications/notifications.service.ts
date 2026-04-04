import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
import type { AuctionClosedEvent } from '../../events/auction-closed.event';
import type { AuctionSoldEvent } from '../../events/auction-sold.event';
import type { MessageSentEvent } from '../../events/message-sent.event';
import type { ChatJoinEvent } from '../../events/chat-join.event';
import { Notification } from './entities/notification.entity';
import {
  NotificationResponseDto,
  PaginatedNotificationsDto,
} from './dto/notification-response.dto';
import { FindNotificationsQueryDto } from './dto/find-notifications-query.dto';
import { Bid } from '../auctions/entities/bid.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { Message } from '../chat/entities/message.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(Bid)
    private readonly bidsRepository: Repository<Bid>,
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    userId: number,
    message: string,
    auctionId: number | null = null,
  ): Promise<NotificationResponseDto> {
    const notification = this.notificationsRepository.create({
      userId,
      message,
      auctionId,
      read: false,
    });
    const saved = await this.notificationsRepository.save(notification);

    this.eventEmitter.emit('notification.created', {
      notificationId: saved.id,
      userId: saved.userId,
      message: saved.message,
      auctionId: saved.auctionId,
      createdAt: saved.createdAt,
    });

    return this.toResponse(saved);
  }

  async findAll(
    query: FindNotificationsQueryDto,
  ): Promise<PaginatedNotificationsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.notificationsRepository.createQueryBuilder('notification');

    if (query.userId) {
      qb.andWhere('notification.userId = :userId', { userId: query.userId });
    }

    if (query.read !== undefined) {
      qb.andWhere('notification.read = :read', { read: query.read });
    }

    qb.orderBy('notification.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [notifications, total] = await qb.getManyAndCount();

    return {
      data: notifications.map((n) => this.toResponse(n)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async markAsRead(id: number): Promise<NotificationResponseDto> {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException(`Notification with id ${id} was not found`);
    }
    notification.read = true;
    const saved = await this.notificationsRepository.save(notification);
    return this.toResponse(saved);
  }

  @OnEvent('auction.closed')
  async onAuctionClosed(event: AuctionClosedEvent): Promise<void> {
    if (!event.winnerId) {
      return;
    }

    const message = `You won the auction for "${event.itemName}" with a bid of ${event.winningAmount} ${event.currency}`;
    await this.create(event.winnerId, message, event.auctionId);
  }

  @OnEvent('message.sent')
  async onMessageSent(event: MessageSentEvent): Promise<void> {
    const message = await this.messagesRepository.findOne({
      where: { id: event.messageId },
    });

    if (!message) return;

    const campaign = await this.campaignsRepository.findOne({
      where: { id: event.campaignId },
    });

    if (!campaign) return;

    const sender = await this.usersRepository.findOne({
      where: { id: event.userId },
      select: { id: true, name: true },
    });

    const senderName = sender?.name?.trim() || 'Usuario';
    const notifMessage = `Nuevo mensaje en campaña "${campaign.name}" de ${senderName}`;

    const recipients = await this.usersRepository.find({
      where: { id: Not(event.userId) },
      select: { id: true },
    });

    for (const recipient of recipients) {
      await this.create(recipient.id, notifMessage, null);
    }
  }

  @OnEvent('auction.sold')
  async onAuctionSold(event: AuctionSoldEvent): Promise<void> {
    // Notify buyer of successful purchase
    const buyerMessage = `Congratulations! You bought an auction item for ${event.price} ${event.currency}`;
    await this.create(event.buyerId, buyerMessage, event.auctionId);

    // Notify other bidders they lost
    const otherBids = await this.bidsRepository.find({
      where: { auctionId: event.auctionId },
    });

    for (const bid of otherBids) {
      if (bid.userId !== event.buyerId) {
        const loserMessage = `An auction you bid on has been sold to another user.`;
        await this.create(bid.userId, loserMessage, event.auctionId);
      }
    }
  }

  private toResponse(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      userId: notification.userId,
      message: notification.message,
      auctionId: notification.auctionId,
      read: notification.read,
      createdAt: notification.createdAt,
    };
  }
}
