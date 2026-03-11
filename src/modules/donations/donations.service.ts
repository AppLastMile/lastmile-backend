import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMoneyDonationDto } from './dto/create-money-donation.dto';
import { CreateItemDonationDto } from './dto/create-item-donation.dto';
import { DonationMoney } from './entities/donation-money.entity';
import { DonationItem } from './entities/donation-item.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';

@Injectable()
export class DonationsService {
	constructor(
		@InjectRepository(DonationMoney)
		private readonly donationMoneyRepository: Repository<DonationMoney>,
		@InjectRepository(DonationItem)
		private readonly donationItemRepository: Repository<DonationItem>,
		@InjectRepository(Campaign)
		private readonly campaignsRepository: Repository<Campaign>,
	) {}

	async createMoney(dto: CreateMoneyDonationDto) {
		const donation = this.donationMoneyRepository.create(dto);
		const saved = await this.donationMoneyRepository.save(donation);

		const campaign = await this.campaignsRepository.findOne({
			where: { id: dto.campaignId },
		});

		if (campaign) {
			const current = Number(campaign.collectedMoney ?? 0);
			campaign.collectedMoney = current + Number(dto.amount);
			await this.campaignsRepository.save(campaign);
		}

		return saved;
	}

	async createItem(dto: CreateItemDonationDto) {
		const donation = this.donationItemRepository.create({
			campaignId: dto.campaignId,
			donorId: dto.donorId,
			itemName: dto.itemType,
			quantity: dto.quantity,
		});

		const saved = await this.donationItemRepository.save(donation);

		return {
			id: saved.id,
			campaignId: saved.campaignId,
			donorId: saved.donorId,
			itemType: saved.itemName,
			quantity: saved.quantity,
			notes: dto.notes,
			status: saved.status,
			createdAt: saved.createdAt,
		};
	}

	async listItems(page = 1, limit = 200) {
		const safePage = Number.isFinite(page) && page > 0 ? page : 1;
		const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 200;

		const items = await this.donationItemRepository.find({
			order: { id: 'DESC' },
			skip: (safePage - 1) * safeLimit,
			take: safeLimit,
		});

		return items.map((item) => ({
			id: item.id,
			campaignId: item.campaignId,
			donorId: item.donorId,
			itemType: item.itemName,
			quantity: item.quantity,
			status: item.status,
			createdAt: item.createdAt,
		}));
	}
}
