import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';
import { PickupPoint } from './entities/pickup-point.entity';
import { Shipment } from './entities/shipment.entity';
import { ShipmentLocation } from './entities/shipment-location.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PickupPoint, Shipment, ShipmentLocation, Campaign]),
  ],
  controllers: [LogisticsController],
  providers: [LogisticsService],
})
export class LogisticsModule {}
