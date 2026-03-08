import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { FindEventsQueryDto } from './dto/find-events-query.dto';
import { PaginatedEventsDto, EventResponseDto } from './dto/event-response.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@Body() dto: CreateEventDto): Promise<EventResponseDto> {
    return this.eventsService.create(dto);
  }

  @Get()
  findAll(@Query() query: FindEventsQueryDto): Promise<PaginatedEventsDto> {
    return this.eventsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<EventResponseDto> {
    return this.eventsService.findOneById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
  ): Promise<EventResponseDto> {
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.eventsService.remove(id);
  }
}
