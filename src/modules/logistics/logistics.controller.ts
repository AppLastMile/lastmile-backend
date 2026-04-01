import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AssignShipmentVolunteerDto } from './dto/assign-shipment-volunteer.dto';
import { CreatePickupPointDto } from './dto/create-pickup-point.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { FindPickupPointsQueryDto } from './dto/find-pickup-points-query.dto';
import { FindShipmentLocationHistoryQueryDto } from './dto/find-shipment-location-history-query.dto';
import { FindShipmentsQueryDto } from './dto/find-shipments-query.dto';
import {
  PaginatedPickupPointsDto,
  PaginatedShipmentsDto,
  PickupPointResponseDto,
  ShipmentLocationHistoryResponseDto,
  ShipmentLocationPointResponseDto,
  ShipmentResponseDto,
} from './dto/logistics-response.dto';
import { UpdatePickupPointDto } from './dto/update-pickup-point.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { LogisticsService } from './logistics.service';
import { UpdateShipmentLocationDto } from './dto/update-shipment-location.dto';

// 🔥 IMPORTANTE
import { TrackingGateway } from '../realtime/tracking.gateway';

@Controller('logistics')
export class LogisticsController {
  constructor(
    private readonly logisticsService: LogisticsService,
    private readonly trackingGateway: TrackingGateway, // 🔥 inyectado
  ) {}

  // ================================
  // 📍 TRACKING EN TIEMPO REAL
  // ================================
  @Post('shipments/:id/location')
  async updateShipmentLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShipmentLocationDto,
  ) {
    console.log('🔥 CONTROLLER HIT - LOCATION UPDATE', id);

    const result =
      await this.logisticsService.createShipmentLocationUpdate({
        shipmentId: id,
        lat: dto.lat,
        lng: dto.lng,
        speed: dto.speed,
        heading: dto.heading,
        userId: dto.userId,
        updatedBy: 1,
      });

    // 🔥 EMIT EN TIEMPO REAL
    this.trackingGateway.server.emit(`tracking-${id}`, {
      shipmentId: id,
      userId: dto.userId,
      lat: dto.lat,
      lng: dto.lng,
    });

    console.log(`📡 EMITIENDO tracking-${id}`, {
      lat: dto.lat,
      lng: dto.lng,
    });

    return result;
  }

  // ================================
  // 📍 PICKUP POINTS
  // ================================
  @Post('pickup-points')
  createPickupPoint(
    @Body() dto: CreatePickupPointDto,
  ): Promise<PickupPointResponseDto> {
    return this.logisticsService.createPickupPoint(dto);
  }

  @Get('pickup-points')
  findPickupPoints(
    @Query() query: FindPickupPointsQueryDto,
  ): Promise<PaginatedPickupPointsDto> {
    return this.logisticsService.findPickupPoints(query);
  }

  @Get('pickup-points/:id')
  findPickupPointById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PickupPointResponseDto> {
    return this.logisticsService.findPickupPointById(id);
  }

  @Patch('pickup-points/:id')
  updatePickupPoint(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePickupPointDto,
  ): Promise<PickupPointResponseDto> {
    return this.logisticsService.updatePickupPoint(id, dto);
  }

  // ================================
  // 📦 SHIPMENTS
  // ================================
  @Post('shipments')
  createShipment(
    @Body() dto: CreateShipmentDto,
  ): Promise<ShipmentResponseDto> {
    return this.logisticsService.createShipment(dto);
  }

  @Get('shipments')
  findShipments(
    @Query() query: FindShipmentsQueryDto,
  ): Promise<PaginatedShipmentsDto> {
    return this.logisticsService.findShipments(query);
  }

  @Get('shipments/:id')
  findShipmentById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ShipmentResponseDto> {
    return this.logisticsService.findShipmentById(id);
  }

  @Get('shipments/:id/location/latest')
  findShipmentLatestLocation(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ShipmentLocationPointResponseDto | null> {
    return this.logisticsService.findShipmentLatestLocation(id);
  }

  @Get('shipments/:id/location/history')
  findShipmentLocationHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: FindShipmentLocationHistoryQueryDto,
  ): Promise<ShipmentLocationHistoryResponseDto> {
    return this.logisticsService.findShipmentLocationHistory(id, query);
  }

  @Patch('shipments/:id/status')
  async updateShipmentStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShipmentStatusDto,
  ): Promise<ShipmentResponseDto> {
    const shipment = await this.logisticsService.updateShipmentStatus(id, dto);

    this.trackingGateway.server.emit('shipment-updated', shipment);

    console.log('📡 shipment-updated', shipment.id);

    return shipment;
  }

  // ================================
  // 👤 VOLUNTARIOS
  // ================================
  @Patch('shipments/:id/assign-volunteer')
  assignVolunteer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignShipmentVolunteerDto,
  ): Promise<ShipmentResponseDto> {
    return this.logisticsService.assignVolunteer(id, dto);
  }

  @Patch('shipments/:id/status')
  updateShipmentStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShipmentStatusDto,
  ): Promise<ShipmentResponseDto> {
    return this.logisticsService.updateShipmentStatus(id, dto);
  }
}