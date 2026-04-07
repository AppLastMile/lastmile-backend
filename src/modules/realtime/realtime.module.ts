import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { Message } from '../chat/entities/message.entity';
import { Event } from '../events/entities/event.entity';
import { ShipmentLocationHistory } from '../logistics/entities/shipment-location-history.entity';
import { Shipment } from '../logistics/entities/shipment.entity';
import { User } from '../users/entities/user.entity';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeAuthService } from './services/realtime-auth.service';
import { RoomAuthorizationService } from './services/room-authorization.service';
import { VolunteerLocationService } from './services/volunteer-location.service';
import { VolunteerPresenceService } from './services/volunteer-presence.service';

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
    RealtimeAuthService,
    RoomAuthorizationService,
    VolunteerLocationService,
    VolunteerPresenceService,
  ],
})
export class RealtimeModule {}
