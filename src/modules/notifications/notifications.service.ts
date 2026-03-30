import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuctionClosedEvent } from '../../events/auction-closed.event';
import { Notification } from './entities/notification.entity';
import {
  NotificationResponseDto,
  PaginatedNotificationsDto,
} from './dto/notification-response.dto';
import { FindNotificationsQueryDto } from './dto/find-notifications-query.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
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
    return this.toResponse(saved);
  }

  async findAll(
    query: FindNotificationsQueryDto,
  ): Promise<PaginatedNotificationsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const qb =
      this.notificationsRepository.createQueryBuilder('notification');

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
    const notification = await this.notificationsRepository.findOne({ where: { id } });
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
