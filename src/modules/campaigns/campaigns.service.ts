import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { Campaign } from './entities/campaign.entity';

@Injectable()
export class CampaignsService {
	constructor(
		@InjectRepository(Campaign)
		private readonly campaignsRepository: Repository<Campaign>,
	) {}

	async findAll(page = 1, limit = 50) {
		const safePage = Number.isFinite(page) && page > 0 ? page : 1;
		const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 50;

		const [data, total] = await this.campaignsRepository.findAndCount({
			order: { id: 'DESC' },
			skip: (safePage - 1) * safeLimit,
			take: safeLimit,
		});

		return {
			data,
			meta: {
				total,
				page: safePage,
				limit: safeLimit,
				totalPages: Math.max(1, Math.ceil(total / safeLimit)),
			},
		};
	}

	create(dto: CreateCampaignDto) {
		const campaign = this.campaignsRepository.create({
			...dto,
			collectedMoney: 0,
		});

		return this.campaignsRepository.save(campaign);
	}
}
