import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { TokenPayload } from '../auth/services/token.service';
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

  @Post('shipments')
  createShipment(@Body() dto: CreateShipmentDto): Promise<ShipmentResponseDto> {
    return this.logisticsService.createShipment(dto);
  }

  @Get('shipments')
  @UseGuards(AuthGuard)
  findShipments(
    @Query() query: FindShipmentsQueryDto,
    @CurrentUser() user: TokenPayload,
  ): Promise<PaginatedShipmentsDto> {
    if (query.assignedVolunteerId === 'me') {
      return this.logisticsService.findShipments({
        ...query,
        assignedVolunteerId: user.userId,
      });
    }

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

  @Patch('shipments/:id/assign-volunteer')
  assignVolunteer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignShipmentVolunteerDto,
  ): Promise<ShipmentResponseDto> {
    return this.logisticsService.assignVolunteer(id, dto);
  }

  @Patch('shipments/:id/status')
  @UseGuards(AuthGuard)
  updateShipmentStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShipmentStatusDto,
    @CurrentUser() user: TokenPayload,
  ): Promise<ShipmentResponseDto> {
    return this.logisticsService.updateShipmentStatusForVolunteer(
      id,
      dto,
      user.userId,
    );
  }
}
