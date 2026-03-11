import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { DonationsService } from './donations.service';
import { CreateMoneyDonationDto } from './dto/create-money-donation.dto';
import { CreateItemDonationDto } from './dto/create-item-donation.dto';

@Controller('donations')
export class DonationsController {
	constructor(private readonly donationsService: DonationsService) {}

	@Post('money')
	createMoney(@Body() dto: CreateMoneyDonationDto) {
		return this.donationsService.createMoney(dto);
	}

	@Post('items')
	createItem(@Body() dto: CreateItemDonationDto) {
		return this.donationsService.createItem(dto);
	}

	@Get('items')
	listItems(
		@Query('page') page = '1',
		@Query('limit') limit = '200',
	) {
		return this.donationsService.listItems(Number(page), Number(limit));
	}
}
