import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';

import { PickupPoint } from './entities/pickup-point.entity';
import { ShipmentLocationHistory } from './entities/shipment-location-history.entity';
import { Shipment } from './entities/shipment.entity';

import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PickupPoint, Shipment, ShipmentLocationHistory]),
    RealtimeModule,
  ],
  controllers: [LogisticsController],
  providers: [LogisticsService],
})
export class LogisticsModule {}
