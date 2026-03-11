import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Controller('campaigns')
export class CampaignsController {
	constructor(private readonly campaignsService: CampaignsService) {}

	@Get()
	findAll(
		@Query('page') page = '1',
		@Query('limit') limit = '50',
	) {
		return this.campaignsService.findAll(Number(page), Number(limit));
	}

	@Post()
	create(@Body() dto: CreateCampaignDto) {
		return this.campaignsService.create(dto);
	}
}
