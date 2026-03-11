import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventsController {
	constructor(private readonly eventsService: EventsService) {}

	@Get()
	findAll(
		@Query('page') page = '1',
		@Query('limit') limit = '50',
		@Query('city') city?: string,
		@Query('disasterType') disasterType?: string,
		@Query('search') search?: string,
	) {
		return this.eventsService.findAll({
			page: Number(page),
			limit: Number(limit),
			city,
			disasterType,
			search,
		});
	}

	@Post()
	create(@Body() dto: CreateEventDto) {
		return this.eventsService.create(dto);
	}
}
