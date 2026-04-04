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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { TokenPayload } from '../auth/services/token.service';
import { CreateEventDto } from './dto/create-event.dto';
import { FindEventsQueryDto } from './dto/find-events-query.dto';
import { PaginatedEventsDto, EventResponseDto } from './dto/event-response.dto';
import { EventSupportService } from './event-support.service';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly eventSupportService: EventSupportService,
  ) {}

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

  @Post(':eventId/join')
  @UseGuards(AuthGuard)
  joinEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @CurrentUser() user: TokenPayload,
  ): {
    success: true;
    message: string;
    data: { eventId: number; userId: number };
  } {
    this.eventSupportService.joinEvent(eventId, user.userId);
    return {
      success: true,
      message: 'Te uniste al evento correctamente.',
      data: { eventId, userId: user.userId },
    };
  }

  @Delete(':eventId/join')
  @UseGuards(AuthGuard)
  leaveEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @CurrentUser() user: TokenPayload,
  ): {
    success: true;
    message: string;
    data: { eventId: number; userId: number };
  } {
    this.eventSupportService.leaveEvent(eventId, user.userId);
    return {
      success: true,
      message: 'Saliste del evento correctamente.',
      data: { eventId, userId: user.userId },
    };
  }

  @Get(':eventId/supporters/count')
  supportersCount(@Param('eventId', ParseIntPipe) eventId: number): {
    success: true;
    message: string;
    data: { eventId: number; supportersCount: number };
  } {
    return {
      success: true,
      message: 'Conteo de apoyos obtenido correctamente.',
      data: {
        eventId,
        supportersCount: this.eventSupportService.getSupportersCount(eventId),
      },
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.eventsService.remove(id);
  }
}
