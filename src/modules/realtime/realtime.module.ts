import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Campaign } from '../campaigns/entities/campaign.entity';
import { Message } from '../chat/entities/message.entity';
import { Event } from '../events/entities/event.entity';
import { ShipmentLocationHistory } from '../logistics/entities/shipment-location-history.entity';
import { Shipment } from '../logistics/entities/shipment.entity';
import { User } from '../users/entities/user.entity';

import { RealtimeGateway } from './realtime.gateway';
import { TrackingGateway } from './tracking.gateway';

import { RealtimeAuthService } from './services/realtime-auth.service';
import { RoomAuthorizationService } from './services/room-authorization.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      Event,
      Message,
      Shipment,
      ShipmentLocationHistory,
      User,
    ]),
  ],
  providers: [
    RealtimeGateway,
    TrackingGateway,
    RealtimeAuthService,
    RoomAuthorizationService,
  ],
  exports: [TrackingGateway],
})
export class RealtimeModule {}