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
import { BadRequestException, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { randomUUID } from 'crypto';
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
import {
  VolunteerDisconnectedDto,
  VolunteerLocationDto,
  VolunteerLocationService,
  VolunteerLocationsSnapshotDto,
} from './services/volunteer-location.service';
import { VolunteerPresenceService } from './services/volunteer-presence.service';
import { VolunteerLocationWsDto } from './dto/volunteer-location-ws.dto';

type AuthenticatedSocket = Socket & {
  data: {
    userId: number;
    userName: string;
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

  return allowedCorsOrigins.has(origin) || expoTunnelOriginPattern.test(origin);
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
  private readonly staleThresholdMs = 60_000;
  private readonly maxImpliedSpeedMetersPerSecond = 70;

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
    private readonly volunteerPresenceService: VolunteerPresenceService,
    private readonly volunteerLocationService: VolunteerLocationService,
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
        this.logger.warn(
          `Failed to configure Redis adapter: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  async handleConnection(client: Socket): Promise<void> {
    const socket = client as AuthenticatedSocket;

    const token = this.tryExtractToken(client);
    if (!token) {
      client.emit('system.error', {
        code: 'AUTH_REQUIRED',
        message: 'Authentication token is required',
      });
      client.disconnect(true);
      return;
    }

    try {
      const authUser = this.realtimeAuthService.verifyToken(token);
      const user = await this.usersRepository.findOne({
        where: { id: authUser.userId },
        select: { id: true, name: true, role: true },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      socket.data.userId = authUser.userId;
      socket.data.userName = user.name;
      socket.data.role = user.role;
      socket.data.rateLimit = {};
      socket.data.isAuthenticated = true;

      this.volunteerPresenceService.registerConnection(
        client.id,
        user.id,
        user.role,
      );

      await socket.join(`user:${authUser.userId}`);

      if (user.role === UserRole.ORGANIZER) {
        await socket.join('volunteers:locations');
        await socket.join('volunteers:tracking');
        this.emitGlobalVolunteersSnapshot(socket);
      }

      this.logger.log(
        `WS connected user=${authUser.userId} socket=${client.id}`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`WS auth rejected socket=${client.id} reason=${reason}`);
      client.emit('system.error', {
        code: 'AUTH_INVALID',
        message: 'Invalid authentication token',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const disconnected = this.volunteerPresenceService.unregisterConnection(
      client.id,
    );

    if (
      disconnected &&
      disconnected.role === UserRole.VOLUNTEER &&
      !disconnected.stillConnected
    ) {
      this.volunteerLocationService.removeLocation(disconnected.userId);

      const payload: VolunteerDisconnectedDto = {
        volunteerId: disconnected.userId,
      };
      this.server
        .to('volunteers:locations')
        .emit('volunteer.disconnected', payload);
      this.server.to('volunteers:tracking').emit('volunteer.offline', payload);
      this.server
        .to('volunteers:tracking')
        .emit('volunteer.disconnected', payload);
    }

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

      if (
        normalizedRoom === 'volunteers:locations' ||
        normalizedRoom === 'volunteers:tracking'
      ) {
        this.emitGlobalVolunteersSnapshot(client);
      }

      const campaignVolunteers = normalizedRoom.match(
        /^campaign:(\d+):volunteers:tracking$/,
      );
      if (campaignVolunteers) {
        const campaignId = Number(campaignVolunteers[1]);
        this.emitCampaignVolunteersSnapshot(client, campaignId);
      }

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
      this.ensureAuthenticated(client);
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
      if (!author) {
        throw new BadRequestException('User does not exist');
      }

      const created = await this.messagesRepository.save(
        this.messagesRepository.create({
          campaignId,
          userId: author.id,
          message: text,
        }),
      );

      // emitir evento interno para que NotificationsService y otros listeners se enteren
      const sentEvent: MessageSentEvent = {
        messageId: created.id,
        campaignId,
        userId: author.id,
      };
      this.eventEmitter.emit('message.sent', sentEvent);

      this.logger.log(
        `chat.send ok user=${author.id} campaign=${campaignId} messageId=${created.id}`,
      );

      this.server
        .to(`campaign:${campaignId}:chat`)
        .emit('chat.message.created', {
          id: created.id,
          campaignId,
          authorId: author.id,
          authorName: author.name,
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

  @SubscribeMessage('campaign.volunteers.subscribe')
  async subscribeCampaignVolunteers(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { campaignId?: number },
  ): Promise<void> {
    const campaignId = Number(payload?.campaignId);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      this.emitSystemError(
        client,
        new BadRequestException('campaignId is invalid'),
        'BAD_REQUEST',
      );
      return;
    }

    try {
      const room = await this.roomAuthorizationService.validateAndNormalizeRoom(
        `campaign:${campaignId}:volunteers:tracking`,
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

      this.emitCampaignVolunteersSnapshot(client, campaignId);
    } catch (error) {
      this.emitSystemError(client, error, 'FORBIDDEN_ROOM');
    }
  }

  @SubscribeMessage('volunteers.locations.snapshot.request')
  handleVolunteerSnapshotRequest(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): void {
    if (client.data.role === UserRole.ORGANIZER) {
      this.emitGlobalVolunteersSnapshot(client);
    }
  }

  @SubscribeMessage('volunteer.location.update')
  async volunteerLocationUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      lat?: number;
      lng?: number;
      latitude?: number;
      longitude?: number;
      coords?: {
        lat?: number;
        lng?: number;
        latitude?: number;
        longitude?: number;
      };
      recordedAt?: string | number;
      campaignId?: number;
      shipmentId?: number;
      correlationId?: string;
    },
  ): Promise<void> {
    try {
      const serverReceivedAt = new Date();
      const correlationId = this.resolveCorrelationId(payload?.correlationId);

      this.ensureAuthenticated(client);
      this.ensureVolunteerRole(client);
      this.enforceRateLimit(client, 'volunteer.location.update', 1, 2000);

      const linkedPresence = this.volunteerPresenceService.getLinkedUser(
        client.id,
      );
      if (linkedPresence && linkedPresence.userId !== client.data.userId) {
        this.logger.warn(
          `[tracking] correlationId=${correlationId} socket-user mismatch socket=${client.id} socketUser=${linkedPresence.userId} requestUser=${client.data.userId}`,
        );
      }

      const extracted = this.extractAndNormalizeCoordinates(payload);
      const lat = extracted.lat;
      const lng = extracted.lng;
      const normalizedCoordinates = extracted.normalizedCoordinates;
      const recordedAt = this.parseRecordedAt(payload?.recordedAt);

      const validatedPayload = this.validateVolunteerLocationDto({
        lat,
        lng,
        recordedAt: recordedAt.toISOString(),
        campaignId:
          payload?.campaignId === undefined
            ? undefined
            : Number(payload.campaignId),
        shipmentId:
          payload?.shipmentId === undefined
            ? undefined
            : Number(payload.shipmentId),
        correlationId,
      });

      const stale =
        serverReceivedAt.getTime() - recordedAt.getTime() >
        this.staleThresholdMs;

      this.logger.log(
        `[tracking] received correlationId=${correlationId} userId=${client.data.userId} role=${client.data.role} lat=${lat} lng=${lng} recordedAt=${recordedAt.toISOString()} serverReceivedAt=${serverReceivedAt.toISOString()} normalized=${normalizedCoordinates} stale=${stale}`,
      );

      if (stale) {
        this.logger.warn(
          `[tracking] correlationId=${correlationId} stale location userId=${client.data.userId} ageMs=${serverReceivedAt.getTime() - recordedAt.getTime()}`,
        );
      }

      const previousLocation = this.volunteerLocationService.getByVolunteerId(
        client.data.userId,
      );
      if (
        previousLocation &&
        this.isImplausibleJump(previousLocation, {
          lat,
          lng,
          recordedAt,
        })
      ) {
        throw new BadRequestException(
          'Location discarded due to implausible speed/jump',
        );
      }

      let campaignId: number | undefined = undefined;
      let shipmentId: number | undefined = undefined;

      if (payload?.campaignId !== undefined) {
        campaignId = validatedPayload.campaignId;
      }

      if (payload?.shipmentId !== undefined) {
        shipmentId = validatedPayload.shipmentId;

        const shipment = await this.shipmentsRepository.findOne({
          where: { id: shipmentId },
          select: { id: true, campaignId: true, assignedVolunteerId: true },
        });
        if (!shipment) {
          throw new BadRequestException('Shipment does not exist');
        }

        if (shipment.assignedVolunteerId !== client.data.userId) {
          throw new BadRequestException(
            'Volunteer is not assigned to the shipment',
          );
        }

        campaignId = campaignId ?? shipment.campaignId;

        const locationRow = this.shipmentLocationsRepository.create({
          shipmentId,
          campaignId: shipment.campaignId,
          lat,
          lng,
          speed: null,
          heading: null,
          recordedAt,
          updatedBy: client.data.userId,
        });

        await this.shipmentLocationsRepository.save(locationRow);

        this.logger.log(
          `[tracking] saved correlationId=${correlationId} shipmentId=${shipmentId} userId=${client.data.userId} lat=${lat} lng=${lng}`,
        );
      }

      if (!shipmentId || !campaignId) {
        const inferred = await this.resolveVolunteerActiveShipment(
          client.data.userId,
        );
        if (inferred) {
          shipmentId = shipmentId ?? inferred.shipmentId;
          campaignId = campaignId ?? inferred.campaignId;
        }
      }

      const location: VolunteerLocationDto = {
        volunteerId: client.data.userId,
        lat,
        lng,
        recordedAt: recordedAt.toISOString(),
        correlationId,
        normalizedCoordinates,
        stale,
        serverReceivedAt: serverReceivedAt.toISOString(),
        name: client.data.userName,
        campaignId,
        shipmentId,
      };

      this.volunteerLocationService.upsertLocation(location);
      this.emitVolunteerLocationUpdates(location);

      this.logger.log(
        `[tracking] broadcast correlationId=${correlationId} userId=${client.data.userId} room=volunteers:locations lat=${lat} lng=${lng}`,
      );

      client.emit('volunteer.location.ack', {
        correlationId,
        volunteerId: location.volunteerId,
        lat,
        lng,
        normalizedCoordinates,
        stale,
        recordedAt: location.recordedAt,
        serverReceivedAt: serverReceivedAt.toISOString(),
      });
    } catch (error) {
      this.emitSystemError(client, error, 'VOLUNTEER_LOCATION_ERROR');
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
      latitude?: number;
      longitude?: number;
      coords?: {
        lat?: number;
        lng?: number;
        latitude?: number;
        longitude?: number;
      };
      speed?: number;
      heading?: number;
      recordedAt?: string | number;
    },
  ): Promise<void> {
    try {
      this.ensureAuthenticated(client);
      this.ensureVolunteerRole(client);
      this.enforceRateLimit(client, 'shipment.location.update', 1, 2000);

      const shipmentId = Number(payload?.shipmentId);
      const extracted = this.extractAndNormalizeCoordinates(payload);
      const lat = extracted.lat;
      const lng = extracted.lng;

      if (!Number.isInteger(shipmentId) || shipmentId <= 0) {
        throw new BadRequestException('shipmentId is invalid');
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
        select: { id: true, campaignId: true, assignedVolunteerId: true },
      });
      if (!shipment) {
        throw new BadRequestException('Shipment does not exist');
      }

      if (shipment.assignedVolunteerId !== client.data.userId) {
        throw new BadRequestException(
          'Volunteer is not assigned to the shipment',
        );
      }

      const recordedAt = this.parseRecordedAt(payload?.recordedAt);

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

      const volunteerLocation: VolunteerLocationDto = {
        volunteerId: client.data.userId,
        lat,
        lng,
        recordedAt: row.recordedAt.toISOString(),
        name: client.data.userName,
        campaignId: shipment.campaignId,
        shipmentId,
      };
      this.volunteerLocationService.upsertLocation(volunteerLocation);
      this.emitVolunteerLocationUpdates(volunteerLocation);

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

    const location: VolunteerLocationDto = {
      volunteerId: event.updatedBy,
      lat: event.lat,
      lng: event.lng,
      recordedAt: event.recordedAt.toISOString(),
      campaignId: event.campaignId,
      shipmentId: event.shipmentId,
    };
    this.volunteerLocationService.upsertLocation(location);
    this.emitVolunteerLocationUpdates(location);
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

  private extractAndNormalizeCoordinates(payload: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
    coords?: {
      lat?: number;
      lng?: number;
      latitude?: number;
      longitude?: number;
    };
  }): { lat: number; lng: number; normalizedCoordinates: boolean } {
    const rawLat =
      payload?.lat ??
      payload?.latitude ??
      payload?.coords?.lat ??
      payload?.coords?.latitude;
    const rawLng =
      payload?.lng ??
      payload?.longitude ??
      payload?.coords?.lng ??
      payload?.coords?.longitude;

    const latCandidate = Number(rawLat);
    const lngCandidate = Number(rawLng);

    if (!Number.isFinite(latCandidate) || !Number.isFinite(lngCandidate)) {
      throw new BadRequestException(
        'Coordinates are required (lat/lng or latitude/longitude)',
      );
    }

    const shouldSwap =
      Math.abs(latCandidate) > 90 &&
      Math.abs(latCandidate) <= 180 &&
      Math.abs(lngCandidate) <= 90;

    const lat = shouldSwap ? lngCandidate : latCandidate;
    const lng = shouldSwap ? latCandidate : lngCandidate;

    if (shouldSwap) {
      this.logger.warn(
        `[tracking] coordinates normalized by swap rawLat=${latCandidate} rawLng=${lngCandidate} finalLat=${lat} finalLng=${lng}`,
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException('lat/lng are out of range');
    }

    return { lat, lng, normalizedCoordinates: shouldSwap };
  }

  private validateVolunteerLocationDto(payload: {
    lat: number;
    lng: number;
    recordedAt?: string;
    campaignId?: number;
    shipmentId?: number;
    correlationId?: string;
  }): VolunteerLocationWsDto {
    const dto = plainToInstance(VolunteerLocationWsDto, payload, {
      enableImplicitConversion: false,
    });

    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException('Invalid volunteer location payload');
    }

    return dto;
  }

  private parseRecordedAt(value?: string | number): Date {
    if (value === undefined || value === null || value === '') {
      return new Date();
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('recordedAt is invalid');
    }

    return parsed;
  }

  private resolveCorrelationId(candidate?: unknown): string {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }

    return randomUUID();
  }

  private isImplausibleJump(
    previous: VolunteerLocationDto,
    current: { lat: number; lng: number; recordedAt: Date },
  ): boolean {
    const previousRecordedAt = new Date(previous.recordedAt);
    if (Number.isNaN(previousRecordedAt.getTime())) {
      return false;
    }

    const deltaSeconds =
      (current.recordedAt.getTime() - previousRecordedAt.getTime()) / 1000;

    // Allow up to 5 s of clock skew. Updates with the same or slightly older
    // timestamp (e.g. forced re-sends from a stationary device) are valid.
    if (deltaSeconds < -5) {
      return true;
    }

    // Cannot calculate speed without a positive time delta — skip the check.
    if (deltaSeconds <= 0) {
      return false;
    }

    const distanceMeters = this.distanceInMeters(
      previous.lat,
      previous.lng,
      current.lat,
      current.lng,
    );
    const impliedSpeed = distanceMeters / deltaSeconds;

    if (impliedSpeed > this.maxImpliedSpeedMetersPerSecond) {
      this.logger.warn(
        `[tracking] implausible jump volunteerId=${previous.volunteerId} distanceMeters=${distanceMeters.toFixed(2)} deltaSeconds=${deltaSeconds.toFixed(2)} impliedSpeed=${impliedSpeed.toFixed(2)}`,
      );
      return true;
    }

    return false;
  }

  private async resolveVolunteerActiveShipment(
    volunteerId: number,
  ): Promise<{ shipmentId: number; campaignId: number } | null> {
    const shipment = await this.shipmentsRepository.findOne({
      where: {
        assignedVolunteerId: volunteerId,
        status: In([ShipmentStatus.ASSIGNED, ShipmentStatus.IN_TRANSIT]),
      },
      select: { id: true, campaignId: true },
      order: { id: 'DESC' },
    });

    if (!shipment) {
      return null;
    }

    return {
      shipmentId: shipment.id,
      campaignId: shipment.campaignId,
    };
  }

  private distanceInMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const toRadians = (value: number): number => (value * Math.PI) / 180;
    const earthRadiusMeters = 6371000;

    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusMeters * c;
  }

  private emitGlobalVolunteersSnapshot(client: AuthenticatedSocket): void {
    const snapshot: VolunteerLocationsSnapshotDto = {
      volunteers: this.volunteerLocationService.getAllLocations(),
    };

    client.emit('volunteers.locations.snapshot', snapshot);
    client.emit('volunteer.location.snapshot', snapshot);
  }

  private emitCampaignVolunteersSnapshot(
    client: AuthenticatedSocket,
    campaignId: number,
  ): void {
    void this.emitCampaignVolunteersSnapshotAsync(client, campaignId);
  }

  private async emitCampaignVolunteersSnapshotAsync(
    client: AuthenticatedSocket,
    campaignId: number,
  ): Promise<void> {
    const memoryLocations =
      this.volunteerLocationService.getCampaignLocations(campaignId);

    const rows = await this.shipmentLocationsRepository
      .createQueryBuilder('l')
      .where('l.campaignId = :campaignId', { campaignId })
      .orderBy('l.recordedAt', 'DESC')
      .addOrderBy('l.id', 'DESC')
      .take(500)
      .getMany();

    const shipments = await this.shipmentsRepository.find({
      where: { campaignId },
      select: { id: true, assignedVolunteerId: true },
    });

    const assignedMap = new Map<number, number | null>();
    for (const shipment of shipments) {
      assignedMap.set(shipment.id, shipment.assignedVolunteerId ?? null);
    }

    const byVolunteerId = new Map<number, VolunteerLocationDto>();

    for (const location of memoryLocations) {
      byVolunteerId.set(location.volunteerId, location);
    }

    for (const row of rows) {
      const volunteerId =
        assignedMap.get(row.shipmentId) ?? row.updatedBy ?? undefined;
      if (!volunteerId || byVolunteerId.has(volunteerId)) {
        continue;
      }

      if (!this.volunteerPresenceService.isConnected(volunteerId)) {
        continue;
      }

      byVolunteerId.set(volunteerId, {
        volunteerId,
        lat: row.lat,
        lng: row.lng,
        recordedAt: row.recordedAt.toISOString(),
        campaignId,
        shipmentId: row.shipmentId,
      });
    }

    const volunteers = Array.from(byVolunteerId.values());
    const snapshot: VolunteerLocationsSnapshotDto = {
      volunteers,
    };

    client.emit('campaign.volunteers.snapshot', {
      campaignId,
      volunteers,
    });

    // Alias transitorio para compatibilidad con clientes antiguos.
    client.emit('volunteers.locations.snapshot', snapshot);
  }

  private emitVolunteerLocationUpdates(location: VolunteerLocationDto): void {
    const payload = {
      volunteerId: location.volunteerId,
      lat: location.lat,
      lng: location.lng,
      recordedAt: location.recordedAt,
      campaignId: location.campaignId,
      shipmentId: location.shipmentId,
      name: location.name,
      correlationId: location.correlationId,
      normalizedCoordinates: location.normalizedCoordinates,
      stale: location.stale,
      serverReceivedAt: location.serverReceivedAt,
    };

    this.server
      .to('volunteers:locations')
      .emit('volunteer.location.updated', payload);
    this.server
      .to('volunteers:locations')
      .emit('volunteer.location.changed', payload);
    this.server
      .to('volunteers:locations')
      .emit('volunteer.location.update', payload);

    this.server
      .to('volunteers:tracking')
      .emit('volunteer.location.updated', payload);
    this.server
      .to('volunteers:tracking')
      .emit('volunteer.location.changed', payload);
    this.server
      .to('volunteers:tracking')
      .emit('volunteer.location.update', payload);

    if (location.campaignId) {
      this.server
        .to(`campaign:${location.campaignId}:volunteers:tracking`)
        .emit('volunteer.location.updated', payload);
      this.server
        .to(`campaign:${location.campaignId}:volunteers:tracking`)
        .emit('volunteer.location.changed', payload);
      this.server
        .to(`campaign:${location.campaignId}:volunteers:tracking`)
        .emit('volunteer.location.update', payload);
    }
  }

  private ensureAuthenticated(client: AuthenticatedSocket): void {
    if (!client.data.isAuthenticated) {
      throw new BadRequestException('Authenticated user is required');
    }
  }

  private ensureVolunteerRole(client: AuthenticatedSocket): void {
    if (client.data.role !== UserRole.VOLUNTEER) {
      throw new BadRequestException(
        'Only volunteers can report location updates',
      );
    }
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
}
