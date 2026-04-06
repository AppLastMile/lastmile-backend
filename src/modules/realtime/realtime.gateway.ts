import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  BadRequestException,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Message } from '../chat/entities/message.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Shipment } from '../logistics/entities/shipment.entity';
import { ShipmentStatus } from '../logistics/entities/shipment.entity';
import { ShipmentLocationHistory } from '../logistics/entities/shipment-location-history.entity';
import type { AuctionClosedEvent } from '../../events/auction-closed.event';
import type { AuctionCreatedEvent } from '../../events/auction-created.event';
import type { AuctionSoldEvent } from '../../events/auction-sold.event';
import type { BidPlacedEvent } from '../../events/bid-placed.event';
import type { CampaignInventoryUpdatedEvent } from '../../events/campaign-inventory-updated.event';
import type { ShipmentAssignedEvent } from '../../events/shipment-assigned.event';
import type { ShipmentDeliveredEvent } from '../../events/shipment-delivered.event';
import type { ShipmentLocationChangedEvent } from '../../events/shipment-location-changed.event';
import type { ShipmentStatusChangedEvent } from '../../events/shipment-status-changed.event';
import type { MessageSentEvent } from '../../events/message-sent.event';
import { RealtimeAuthService } from './services/realtime-auth.service';
import { RoomAuthorizationService } from './services/room-authorization.service';

type AuthenticatedSocket = Socket & {
  data: {
    userId: number;
    role: string;
    rateLimit: Record<string, number[]>;
    isAuthenticated: boolean;
  };
};

const defaultCorsOrigins = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
  'https://chasmic-lavada-pneumatically.ngrok-free.dev',
];

const expoTunnelOriginPattern = /^https:\/\/[a-z0-9-]+-8081\.exp\.direct$/;

const corsOrigins =
  process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0) ?? defaultCorsOrigins;

const allowedCorsOrigins = new Set(corsOrigins);

const isAllowedCorsOrigin = (origin?: string): boolean => {
  if (!origin) {
    return true;
  }

  return (
    allowedCorsOrigins.has(origin) || expoTunnelOriginPattern.test(origin)
  );
};

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, isAllowedCorsOrigin(origin));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'ngrok-skip-browser-warning',
    ],
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Shipment)
    private readonly shipmentsRepository: Repository<Shipment>,
    @InjectRepository(ShipmentLocationHistory)
    private readonly shipmentLocationsRepository: Repository<ShipmentLocationHistory>,
    private readonly realtimeAuthService: RealtimeAuthService,
    private readonly roomAuthorizationService: RoomAuthorizationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async afterInit(server: Server): Promise<void> {
    if (process.env.REDIS_URL) {
      try {
        const pubClient = createClient({ url: process.env.REDIS_URL });
        const subClient = pubClient.duplicate();
        await pubClient.connect();
        await subClient.connect();
        server.adapter(createAdapter(pubClient, subClient));
        this.logger.log('Socket.IO Redis adapter configured');
      } catch (err) {
        this.logger.warn(`Failed to configure Redis adapter: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  async handleConnection(client: Socket): Promise<void> {
    const socket = client as AuthenticatedSocket;

    try {
      const token = this.tryExtractToken(client);

      if (!token) {
        const anonymousUser = this.resolveAnonymousUser(client);
        socket.data.userId = anonymousUser.userId;
        socket.data.role = anonymousUser.role;
        socket.data.rateLimit = {};
        socket.data.isAuthenticated = false;

        this.logger.warn(
          `WS connected in anonymous test mode user=${anonymousUser.userId} socket=${client.id}`,
        );
        return;
      }

      const authUser = this.realtimeAuthService.verifyToken(token);

      socket.data.userId = authUser.userId;
      socket.data.role = authUser.role;
      socket.data.rateLimit = {};
      socket.data.isAuthenticated = true;

      // Ensure per-user notifications can be delivered without extra join calls.
      await socket.join(`user:${authUser.userId}`);

      this.logger.log(
        `WS connected user=${authUser.userId} socket=${client.id}`,
      );
    } catch (error) {
      const anonymousUser = this.resolveAnonymousUser(client);
      socket.data.userId = anonymousUser.userId;
      socket.data.role = anonymousUser.role;
      socket.data.rateLimit = {};
      socket.data.isAuthenticated = false;

      const reason = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(
        `WS auth bypassed in test mode user=${anonymousUser.userId} socket=${client.id} reason=${reason}`,
      );
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`WS disconnected socket=${client.id}`);
  }

  @SubscribeMessage('system.join_room')
  async joinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { room?: string },
  ): Promise<void> {
    try {
      const room = payload?.room?.trim();
      if (!room) {
        throw new BadRequestException('room is required');
      }

      const normalizedRoom =
        await this.roomAuthorizationService.validateAndNormalizeRoom(room, {
          userId: client.data.userId,
          role: client.data.role,
        });

      await client.join(normalizedRoom);
      this.logger.log(
        `room joined user=${client.data.userId} room=${normalizedRoom}`,
      );
      client.emit('system.joined', {
        room: normalizedRoom,
        serverTime: new Date().toISOString(),
      });

      const isChatRoom = normalizedRoom.includes(':chat');
      if (isChatRoom && client.data.isAuthenticated) {
        const campaignIdMatch = normalizedRoom.match(/campaign:(\d+):chat/);
        if (campaignIdMatch) {
          const campaignId = Number(campaignIdMatch[1]);
          const user = await this.usersRepository.findOne({
            where: { id: client.data.userId },
            select: { id: true, name: true },
          });

          if (user) {
            this.eventEmitter.emit('chat.join', {
              campaignId,
              userId: user.id,
              userName: user.name,
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `room join denied user=${client.data.userId} room=${payload?.room ?? 'unknown'} reason=${error instanceof Error ? error.message : 'unknown'}`,
      );
      this.emitSystemError(client, error, 'FORBIDDEN_ROOM');
    }
  }

  @SubscribeMessage('system.leave_room')
  async leaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { room?: string },
  ): Promise<void> {
    const room = payload?.room?.trim();
    if (!room) {
      this.emitSystemError(
        client,
        new BadRequestException('room is required'),
        'BAD_REQUEST',
      );
      return;
    }

    await client.leave(room);
    client.emit('system.left', {
      room,
      serverTime: new Date().toISOString(),
    });
  }

  @SubscribeMessage('chat.send')
  async sendChatMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { campaignId?: number; message?: string },
  ): Promise<void> {
    try {
      this.enforceRateLimit(client, 'chat.send', 5, 10_000);

      const campaignId = Number(payload?.campaignId);
      const text = payload?.message?.trim();

      if (!Number.isInteger(campaignId) || campaignId <= 0) {
        throw new BadRequestException('campaignId must be a valid integer');
      }

      if (!text || text.length < 1 || text.length > 500) {
        throw new BadRequestException(
          'message must have between 1 and 500 characters',
        );
      }

      await this.roomAuthorizationService.validateAndNormalizeRoom(
        `campaign:${campaignId}:chat`,
        {
          userId: client.data.userId,
          role: client.data.role,
        },
      );

      const campaign = await this.campaignsRepository.findOne({
        where: { id: campaignId },
        select: { id: true },
      });
      if (!campaign) {
        throw new BadRequestException('Campaign does not exist');
      }

      const author = await this.usersRepository.findOne({
        where: { id: client.data.userId },
        select: { id: true, name: true },
      });

      const resolvedAuthor =
        author ?? (await this.ensureAnonymousAuthor(client));

      const created = await this.messagesRepository.save(
        this.messagesRepository.create({
          campaignId,
          userId: resolvedAuthor.id,
          message: text,
        }),
      );

      // emitir evento interno para que NotificationsService y otros listeners se enteren
      const sentEvent: MessageSentEvent = {
        messageId: created.id,
        campaignId,
        userId: resolvedAuthor.id,
      };
      this.eventEmitter.emit('message.sent', sentEvent);

      this.logger.log(
        `chat.send ok user=${resolvedAuthor.id} campaign=${campaignId} messageId=${created.id}`,
      );

      this.server
        .to(`campaign:${campaignId}:chat`)
        .emit('chat.message.created', {
          id: created.id,
          campaignId,
          authorId: resolvedAuthor.id,
          authorName: resolvedAuthor.name,
          message: created.message,
          createdAt: created.createdAt.toISOString(),
        });
    } catch (error) {
      this.logger.warn(
        `chat.send failed user=${client.data.userId} campaign=${payload?.campaignId ?? 'unknown'} reason=${error instanceof Error ? error.message : 'unknown'}`,
      );
      client.emit('chat.message.error', {
        campaignId: payload?.campaignId,
        message:
          error instanceof Error
            ? error.message
            : 'No fue posible enviar el mensaje.',
      });
    }
  }

  @SubscribeMessage('chat.typing')
  async chatTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { campaignId?: number; isTyping?: boolean },
  ): Promise<void> {
    const campaignId = Number(payload?.campaignId);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      return;
    }

    await this.roomAuthorizationService.validateAndNormalizeRoom(
      `campaign:${campaignId}:chat`,
      {
        userId: client.data.userId,
        role: client.data.role,
      },
    );

    client.to(`campaign:${campaignId}:chat`).emit('chat.typing.updated', {
      campaignId,
      userId: client.data.userId,
      isTyping: Boolean(payload?.isTyping),
    });
  }

  @SubscribeMessage('shipment.subscribe')
  async subscribeShipment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { shipmentId?: number },
  ): Promise<void> {
    const shipmentId = Number(payload?.shipmentId);
    if (!Number.isInteger(shipmentId) || shipmentId <= 0) {
      this.emitSystemError(
        client,
        new BadRequestException('shipmentId is invalid'),
        'BAD_REQUEST',
      );
      return;
    }

    try {
      const room = await this.roomAuthorizationService.validateAndNormalizeRoom(
        `shipment:${shipmentId}:tracking`,
        {
          userId: client.data.userId,
          role: client.data.role,
        },
      );

      await client.join(room);
      client.emit('system.joined', {
        room,
        serverTime: new Date().toISOString(),
      });

      const latestLocation = await this.shipmentLocationsRepository.findOne({
        where: { shipmentId },
        order: { recordedAt: 'DESC', id: 'DESC' },
      });

      if (latestLocation) {
        client.emit('shipment.location.snapshot', {
          shipmentId,
          lat: latestLocation.lat,
          lng: latestLocation.lng,
          speed: latestLocation.speed,
          heading: latestLocation.heading,
          recordedAt: latestLocation.recordedAt.toISOString(),
        });
      }
    } catch (error) {
      this.emitSystemError(client, error, 'FORBIDDEN_ROOM');
    }
  }

  @SubscribeMessage('shipment.location.update')
  async shipmentLocationUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      shipmentId?: number;
      lat?: number;
      lng?: number;
      speed?: number;
      heading?: number;
      recordedAt?: string;
    },
  ): Promise<void> {
    try {
      this.enforceRateLimit(client, 'shipment.location.update', 1, 2000);

      const shipmentId = Number(payload?.shipmentId);
      const lat = Number(payload?.lat);
      const lng = Number(payload?.lng);

      if (!Number.isInteger(shipmentId) || shipmentId <= 0) {
        throw new BadRequestException('shipmentId is invalid');
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new BadRequestException('lat/lng are required');
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new BadRequestException('lat/lng are out of range');
      }

      await this.roomAuthorizationService.validateAndNormalizeRoom(
        `shipment:${shipmentId}:tracking`,
        {
          userId: client.data.userId,
          role: client.data.role,
        },
      );

      const shipment = await this.shipmentsRepository.findOne({
        where: { id: shipmentId },
        select: { id: true, campaignId: true },
      });
      if (!shipment) {
        throw new BadRequestException('Shipment does not exist');
      }

      const recordedAt = payload?.recordedAt
        ? new Date(payload.recordedAt)
        : new Date();
      if (Number.isNaN(recordedAt.getTime())) {
        throw new BadRequestException('recordedAt is invalid');
      }

      const row = this.shipmentLocationsRepository.create({
        shipmentId,
        campaignId: shipment.campaignId,
        lat,
        lng,
        speed: Number.isFinite(Number(payload?.speed))
          ? Number(payload?.speed)
          : null,
        heading: Number.isFinite(Number(payload?.heading))
          ? Number(payload?.heading)
          : null,
        recordedAt,
        updatedBy: client.data.userId,
      });

      await this.shipmentLocationsRepository.save(row);

      this.server
        .to(`shipment:${shipmentId}:tracking`)
        .emit('shipment.location.changed', {
          shipmentId,
          lat,
          lng,
          speed: row.speed,
          heading: row.heading,
          recordedAt: row.recordedAt.toISOString(),
        });

      client.emit('shipment.location.ack', {
        shipmentId,
        recordedAt: row.recordedAt.toISOString(),
      });
    } catch (error) {
      this.emitSystemError(client, error, 'SHIPMENT_LOCATION_ERROR');
    }
  }

  @SubscribeMessage('shipment.status.update')
  async shipmentStatusUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { shipmentId?: number; status?: ShipmentStatus },
  ): Promise<void> {
    try {
      const shipmentId = Number(payload?.shipmentId);
      if (!Number.isInteger(shipmentId) || shipmentId <= 0) {
        throw new BadRequestException('shipmentId is invalid');
      }

      if (
        !payload?.status ||
        !Object.values(ShipmentStatus).includes(payload.status)
      ) {
        throw new BadRequestException('status is invalid');
      }

      await this.roomAuthorizationService.validateAndNormalizeRoom(
        `shipment:${shipmentId}:tracking`,
        {
          userId: client.data.userId,
          role: client.data.role,
        },
      );

      const shipment = await this.shipmentsRepository.findOne({
        where: { id: shipmentId },
      });

      if (!shipment) {
        throw new BadRequestException('Shipment does not exist');
      }

      const previousStatus = shipment.status;
      if (previousStatus === payload.status) {
        return;
      }

      shipment.status = payload.status;
      await this.shipmentsRepository.save(shipment);

      this.server
        .to(`shipment:${shipmentId}:tracking`)
        .emit('shipment.status.changed', {
          shipmentId,
          previousStatus,
          status: shipment.status,
          updatedBy: client.data.userId,
          updatedAt: new Date().toISOString(),
        });
    } catch (error) {
      this.emitSystemError(client, error, 'SHIPMENT_STATUS_ERROR');
    }
  }

  @OnEvent('message.sent')
  async onMessageSent(event: MessageSentEvent): Promise<void> {
    const message = await this.messagesRepository.findOne({
      where: { id: event.messageId },
    });

    if (!message) {
      return;
    }

    const author = await this.usersRepository.findOne({
      where: { id: message.userId },
      select: { id: true, name: true },
    });

    this.server
      .to(`campaign:${message.campaignId}:chat`)
      .emit('chat.message.created', {
        id: message.id,
        campaignId: message.campaignId,
        authorId: message.userId,
        authorName: author?.name ?? 'Usuario',
        message: message.message,
        createdAt: message.createdAt.toISOString(),
      });
  }

  @OnEvent('shipment.status.changed')
  onShipmentStatusChanged(event: ShipmentStatusChangedEvent): void {
    this.server
      .to(`shipment:${event.shipmentId}:tracking`)
      .emit('shipment.status.changed', {
        shipmentId: event.shipmentId,
        previousStatus: event.previousStatus,
        status: event.status,
        updatedBy: event.updatedBy,
        updatedAt: event.updatedAt.toISOString(),
      });
  }

  @OnEvent('shipment.assigned')
  onShipmentAssigned(event: ShipmentAssignedEvent): void {
    this.server
      .to(`shipment:${event.shipmentId}:tracking`)
      .emit('shipment.assignment.changed', {
        shipmentId: event.shipmentId,
        volunteerId: event.volunteerId,
        assignedAt: new Date().toISOString(),
      });
  }

  @OnEvent('shipment.delivered')
  onShipmentDelivered(event: ShipmentDeliveredEvent): void {
    this.server
      .to(`shipment:${event.shipmentId}:tracking`)
      .emit('shipment.status.changed', {
        shipmentId: event.shipmentId,
        previousStatus: 'in_transit',
        status: 'delivered',
        updatedBy: null,
        updatedAt: event.deliveredAt.toISOString(),
      });
  }

  @OnEvent('shipment.location.changed')
  onShipmentLocationChanged(event: ShipmentLocationChangedEvent): void {
    this.server
      .to(`shipment:${event.shipmentId}:tracking`)
      .emit('shipment.location.changed', {
        shipmentId: event.shipmentId,
        lat: event.lat,
        lng: event.lng,
        speed: event.speed,
        heading: event.heading,
        recordedAt: event.recordedAt.toISOString(),
      });
  }

  @OnEvent('auction.created')
  onAuctionCreated(event: AuctionCreatedEvent): void {
    this.server
      .to(`campaign:${event.campaignId}:auctions`)
      .emit('auction.created', {
        auctionId: event.auctionId,
        campaignId: event.campaignId,
        sellerId: event.sellerId,
        price: event.price,
        currency: event.currency,
        createdAt: new Date().toISOString(),
      });
  }

  @OnEvent('auction.sold')
  onAuctionSold(event: AuctionSoldEvent): void {
    this.server
      .to(`campaign:${event.campaignId}:auctions`)
      .emit('auction.sold', {
        auctionId: event.auctionId,
        campaignId: event.campaignId,
        buyerId: event.buyerId,
        soldAt: event.soldAt.toISOString(),
        price: event.price,
        currency: event.currency,
      });
  }

  @OnEvent('bid.placed')
  onBidPlaced(event: BidPlacedEvent): void {
    this.server
      .to(`auction:${event.auctionId}:bids`)
      .emit('auction.bid.placed', {
        bidId: event.bidId,
        auctionId: event.auctionId,
        userId: event.userId,
        amount: event.amount,
        currentPrice: event.amount,
        placedAt: new Date().toISOString(),
      });
  }

  @OnEvent('auction.closed')
  onAuctionClosed(event: AuctionClosedEvent): void {
    this.server.to(`auction:${event.auctionId}:bids`).emit('auction.closed', {
      auctionId: event.auctionId,
      winnerId: event.winnerId,
      winningAmount: event.winningAmount,
      currency: event.currency,
      closedAt: event.closedAt.toISOString(),
    });
  }

  @OnEvent('campaign.inventory.updated')
  onCampaignInventoryUpdated(event: CampaignInventoryUpdatedEvent): void {
    this.server
      .to(`campaign:${event.campaignId}:inventory`)
      .emit('campaign.inventory.updated', {
        campaignId: event.campaignId,
        itemType: event.itemType,
        quantity: event.quantity,
        updatedAt: new Date().toISOString(),
      });
  }

  @OnEvent('notification.created')
  onNotificationCreated(event: any): void {
    this.server.to(`user:${event.userId}`).emit('notification.new', {
      notificationId: event.notificationId,
      message: event.message,
      auctionId: event.auctionId,
      createdAt: event.createdAt.toISOString(),
    });
  }

  private tryExtractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (
      typeof authHeader === 'string' &&
      authHeader.toLowerCase().startsWith('bearer ')
    ) {
      return authHeader.slice(7);
    }

    const authToken = (client.handshake.auth as { token?: string } | undefined)
      ?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken;
    }

    return null;
  }

  private resolveAnonymousUser(client: Socket): {
    userId: number;
    role: string;
  } {
    const authData =
      (client.handshake.auth as
        | { userId?: unknown; role?: unknown }
        | undefined) ?? {};
    const queryData =
      (client.handshake.query as { userId?: unknown; role?: unknown }) ?? {};

    const rawUserId = authData.userId ?? queryData.userId;
    const parsedUserId = Number(rawUserId);
    const userId =
      Number.isInteger(parsedUserId) && parsedUserId > 0 ? parsedUserId : 1;

    const rawRole = authData.role ?? queryData.role;
    const role =
      typeof rawRole === 'string' && rawRole.trim().length > 0
        ? rawRole.trim()
        : 'donor';

    return { userId, role };
  }

  private emitSystemError(client: Socket, error: unknown, code: string): void {
    client.emit('system.error', {
      code,
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }

  private enforceRateLimit(
    client: AuthenticatedSocket,
    eventName: string,
    maxEvents: number,
    intervalMs: number,
  ): void {
    const now = Date.now();
    const bucket = client.data.rateLimit[eventName] ?? [];
    const filtered = bucket.filter((timestamp) => now - timestamp < intervalMs);

    if (filtered.length >= maxEvents) {
      throw new BadRequestException(
        `Rate limit exceeded for ${eventName}. Please retry later.`,
      );
    }

    filtered.push(now);
    client.data.rateLimit[eventName] = filtered;
  }

  private async ensureAnonymousAuthor(
    client: AuthenticatedSocket,
  ): Promise<{ id: number; name: string }> {
    if (client.data.isAuthenticated) {
      throw new ForbiddenException('User does not exist');
    }

    const role = this.mapRole(client.data.role);
    const userId = client.data.userId;
    const fallbackEmail = `anon-${userId}@realtime.local`;

    const existingByEmail = await this.usersRepository.findOne({
      where: { email: fallbackEmail },
      select: { id: true, name: true },
    });

    if (existingByEmail) {
      client.data.userId = existingByEmail.id;
      return existingByEmail;
    }

    const created = await this.usersRepository.save(
      this.usersRepository.create({
        name: `Anon ${userId}`,
        email: fallbackEmail,
        password: 'temporary-anon-password',
        role,
      }),
    );

    client.data.userId = created.id;
    return { id: created.id, name: created.name };
  }

  private mapRole(role: string): UserRole {
    if (role === UserRole.ORGANIZER) {
      return UserRole.ORGANIZER;
    }

    if (role === UserRole.VOLUNTEER) {
      return UserRole.VOLUNTEER;
    }

    return UserRole.DONOR;
  }
}
