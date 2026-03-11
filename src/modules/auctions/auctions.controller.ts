import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { BuyAuctionDto } from './dto/buy-auction.dto';
import { BuyAuctionResponseDto, PaginatedAuctionsDto, AuctionResponseDto } from './dto/auction-response.dto';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { FindCampaignAuctionsQueryDto } from './dto/find-campaign-auctions-query.dto';

@Controller()
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Post('campaigns/:campaignId/auctions')
  createAuction(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() dto: CreateAuctionDto,
  ): Promise<AuctionResponseDto> {
    return this.auctionsService.createAuction(campaignId, dto);
  }

  @Get('campaigns/:campaignId/auctions')
  getCampaignAuctions(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Query() query: FindCampaignAuctionsQueryDto,
  ): Promise<PaginatedAuctionsDto> {
    return this.auctionsService.getCampaignAuctions(campaignId, query);
  }

  @Post('auctions/:auctionId/buy')
  buyAuction(
    @Param('auctionId', ParseIntPipe) auctionId: number,
    @Body() dto: BuyAuctionDto,
  ): Promise<BuyAuctionResponseDto> {
    return this.auctionsService.buyAuction(auctionId, dto);
  }
}
