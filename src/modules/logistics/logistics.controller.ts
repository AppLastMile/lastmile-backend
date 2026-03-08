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
import { FindShipmentsQueryDto } from './dto/find-shipments-query.dto';
import {
  PaginatedShipmentsDto,
  PickupPointResponseDto,
  ShipmentResponseDto,
} from './dto/logistics-response.dto';
import { UpdatePickupPointDto } from './dto/update-pickup-point.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { LogisticsService } from './logistics.service';

@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Post('pickup-points')
  createPickupPoint(
    @Body() dto: CreatePickupPointDto,
  ): Promise<PickupPointResponseDto> {
    return this.logisticsService.createPickupPoint(dto);
  }

  @Get('pickup-points')
  findPickupPoints(): Promise<PickupPointResponseDto[]> {
    return this.logisticsService.findPickupPoints();
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

  @Post('shipments')
  createShipment(@Body() dto: CreateShipmentDto): Promise<ShipmentResponseDto> {
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
