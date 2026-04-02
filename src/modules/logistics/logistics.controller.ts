import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { UpdateShipmentLocationDto } from './dto/update-shipment-location.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Controller('logistics')
export class LogisticsController {
  constructor(
    private readonly logisticsService: LogisticsService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  // ============================
  // 📦 SHIPMENTS POR VOLUNTARIO
  // ============================
  @Get('volunteer/:id')
  async getVolunteerShipments(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.logisticsService.findShipments({
      assignedVolunteerId: id,
    });
  }

  // ============================
  // 📦 UPDATE STATUS
  // ============================
  @Patch('shipments/:id/status')
  async updateShipmentStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShipmentStatusDto,
  ) {
    const shipment = await this.logisticsService.updateShipmentStatus(id, dto);

    // 🔥 EMIT A ROOM
    this.realtimeGateway.server
      .to(`shipment:${id}:tracking`)
      .emit('shipment.status.changed', {
        shipmentId: id,
        status: shipment.status,
        updatedAt: new Date().toISOString(),
      });

    return shipment;
  }

  // ============================
  // 📍 LOCATION (HTTP fallback)
  // ============================
  @Post('shipments/:id/location')
  async updateShipmentLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShipmentLocationDto,
  ) {
    return this.logisticsService.createShipmentLocationUpdate({
      shipmentId: id,
      lat: dto.lat,
      lng: dto.lng,
      userId: dto.userId,
      updatedBy: 1,
    });
  }
}