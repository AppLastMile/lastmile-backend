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
import { LogisticsService } from './logistics.service';
import { CreatePickupPointDto } from './dto/create-pickup-point.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';

@Controller('logistics')
export class LogisticsController {
	constructor(private readonly logisticsService: LogisticsService) {}

	@Get('pickup-points')
	listPickupPoints(
		@Query('page') page = '1',
		@Query('limit') limit = '100',
	) {
		return this.logisticsService.listPickupPoints(Number(page), Number(limit));
	}

	@Post('pickup-points')
	createPickupPoint(@Body() dto: CreatePickupPointDto) {
		return this.logisticsService.createPickupPoint(dto);
	}

	@Get('shipments')
	listShipments(
		@Query('page') page = '1',
		@Query('limit') limit = '100',
	) {
		return this.logisticsService.listShipments(Number(page), Number(limit));
	}

	@Post('shipments')
	createShipment(@Body() dto: CreateShipmentDto) {
		return this.logisticsService.createShipment(dto);
	}

	@Patch('shipments/:shipmentId/assign-volunteer')
	assignVolunteer(
		@Param('shipmentId', ParseIntPipe) shipmentId: number,
		@Body() body: { volunteerId: number },
	) {
		return this.logisticsService.assignVolunteer(shipmentId, body.volunteerId);
	}

	@Get('shipments/:shipmentId/location/latest')
	latestLocation(@Param('shipmentId', ParseIntPipe) shipmentId: number) {
		return this.logisticsService.getLatestLocation(shipmentId);
	}

	@Get('shipments/:shipmentId/location/history')
	locationHistory(
		@Param('shipmentId', ParseIntPipe) shipmentId: number,
		@Query('limit') limit = '100',
		@Query('before') before?: string,
	) {
		return this.logisticsService.getLocationHistory(
			shipmentId,
			Number(limit),
			before,
		);
	}
}
