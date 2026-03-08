import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventCreatedEvent } from '../../events/event-created.event';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto, PaginatedEventsDto } from './dto/event-response.dto';
import { FindEventsQueryDto } from './dto/find-events-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from './entities/event.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateEventDto): Promise<EventResponseDto> {
    const event = this.eventsRepository.create({
      ...dto,
      date: new Date(dto.date),
    });
    const savedEvent = await this.eventsRepository.save(event);

    const eventPayload: EventCreatedEvent = {
      eventId: savedEvent.id,
      createdBy: savedEvent.createdBy,
      city: savedEvent.city,
      disasterType: savedEvent.disasterType,
      occurredAt: savedEvent.date,
    };
    this.eventEmitter.emit('event.created', eventPayload);

    return this.toEventResponse(savedEvent);
  }

  async findAll(query: FindEventsQueryDto): Promise<PaginatedEventsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.eventsRepository.createQueryBuilder('event');

    if (query.city) {
      qb.andWhere('LOWER(event.city) = :city', {
        city: query.city.toLowerCase(),
      });
    }

    if (query.disasterType) {
      qb.andWhere('LOWER(event.disasterType) = :disasterType', {
        disasterType: query.disasterType.toLowerCase(),
      });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(event.name) LIKE :search OR LOWER(event.description) LIKE :search)',
        {
          search: `%${query.search.toLowerCase()}%`,
        },
      );
    }

    qb.orderBy('event.date', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [events, total] = await qb.getManyAndCount();

    return {
      data: events.map((event) => this.toEventResponse(event)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOneById(id: number): Promise<EventResponseDto> {
    const event = await this.eventsRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event with id ${id} was not found`);
    }

    return this.toEventResponse(event);
  }

  async update(id: number, dto: UpdateEventDto): Promise<EventResponseDto> {
    const event = await this.eventsRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event with id ${id} was not found`);
    }

    const updatedEvent = await this.eventsRepository.save({
      ...event,
      ...dto,
      date: dto.date ? new Date(dto.date) : event.date,
    });

    return this.toEventResponse(updatedEvent);
  }

  async remove(id: number): Promise<void> {
    const result = await this.eventsRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`Event with id ${id} was not found`);
    }
  }

  private toEventResponse(event: Event): EventResponseDto {
    return {
      id: event.id,
      name: event.name,
      disasterType: event.disasterType,
      city: event.city,
      description: event.description,
      date: event.date,
      createdBy: event.createdBy,
    };
  }
}
