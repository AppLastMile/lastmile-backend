import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { AuctionsService } from './auctions.service';

@Controller()
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Get('campaigns/:campaignId/auctions')
  listByCampaign(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Query('status') status = 'all',
    @Query('page') page = '1',
    @Query('limit') limit = '100',
  ) {
    const normalizedStatus =
      status === 'active' || status === 'sold' || status === 'all' ? status : 'all';

    return this.auctionsService.listByCampaign(
      campaignId,
      normalizedStatus,
      Number(page),
      Number(limit),
    );
  }

  @Post('campaigns/:campaignId/auctions')
  create(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body()
    body: {
      sellerId: number;
      itemName: string;
      description?: string;
      price: number;
      currency?: string;
    },
  ) {
    return this.auctionsService.create(campaignId, body);
  }

  @Post('auctions/:auctionId/buy')
  buy(
    @Param('auctionId', ParseIntPipe) auctionId: number,
    @Body() body: { buyerId: number; idempotencyKey?: string },
  ) {
    return this.auctionsService.buy(auctionId, body.buyerId);
  }
}
