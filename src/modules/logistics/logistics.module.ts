import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';
import { PickupPoint } from './entities/pickup-point.entity';
import { ShipmentLocationHistory } from './entities/shipment-location-history.entity';
import { Shipment } from './entities/shipment.entity';
import { ShipmentLocation } from './entities/shipment-location.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([PickupPoint, Shipment, ShipmentLocationHistory]),
  ],
  controllers: [LogisticsController],
  providers: [LogisticsService],
})
export class LogisticsModule {}
