import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEventDto } from './dto/create-event.dto';
import { Event } from './entities/event.entity';

@Injectable()
export class EventsService {
	constructor(
		@InjectRepository(Event)
		private readonly eventsRepository: Repository<Event>,
	) {}

	async findAll(params: {
		page: number;
		limit: number;
		city?: string;
		disasterType?: string;
		search?: string;
	}) {
		const page = Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
		const limit =
			Number.isFinite(params.limit) && params.limit > 0 ? params.limit : 50;

		const qb = this.eventsRepository.createQueryBuilder('event');

		if (params.city) {
			qb.andWhere('event.city ILIKE :city', { city: `%${params.city}%` });
		}

		if (params.disasterType) {
			qb.andWhere('event.disasterType ILIKE :disasterType', {
				disasterType: `%${params.disasterType}%`,
			});
		}

		if (params.search) {
			qb.andWhere(
				'(event.name ILIKE :search OR event.description ILIKE :search)',
				{ search: `%${params.search}%` },
			);
		}

		const [data, total] = await qb
			.orderBy('event.id', 'DESC')
			.skip((page - 1) * limit)
			.take(limit)
			.getManyAndCount();

		return {
			data,
			meta: {
				total,
				page,
				limit,
				totalPages: Math.max(1, Math.ceil(total / limit)),
			},
		};
	}

	create(dto: CreateEventDto) {
		const event = this.eventsRepository.create({
			...dto,
			date: new Date(dto.date),
		});

		return this.eventsRepository.save(event);
	}
}
