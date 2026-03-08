import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';
import { PickupPoint } from './entities/pickup-point.entity';
import { Shipment } from './entities/shipment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PickupPoint, Shipment])],
  controllers: [LogisticsController],
  providers: [LogisticsService],
})
export class LogisticsModule {}
