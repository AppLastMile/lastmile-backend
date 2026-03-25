import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { PickupPointsService } from './pickup-points.service';
import { CreatePickupPointDto } from './dto/create-pickup-point.dto';

@Controller('campaigns')
export class PickupPointsController {
  constructor(private service: PickupPointsService) {}

  @Get(':id/pickup-points')
  find(@Param('id') id: string) {
    const campaignId = Number(id);
    return this.service.findByCampaign(campaignId);
  }

  @Post(':id/pickup-points')
  create(@Param('id') id: string, @Body() dto: CreatePickupPointDto) {
    const campaignId = Number(id);
    return this.service.create(campaignId, dto);
  }
}
