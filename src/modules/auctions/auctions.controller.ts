import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuctionsService } from './auctions.service';
import { AuctionBidDto, BidResponseDto } from './dto/bid-response.dto';
import { BuyAuctionDto } from './dto/buy-auction.dto';
import { CreateBidDto } from './dto/create-bid.dto';
import {
  AuctionResponseDto,
  BuyAuctionResponseDto,
  PaginatedAuctionsDto,
} from './dto/auction-response.dto';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { FindAuctionsQueryDto } from './dto/find-auctions-query.dto';

@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Post()
  @UseGuards(AuthGuard)
  createAuction(@Body() dto: CreateAuctionDto): Promise<AuctionResponseDto> {
    return this.auctionsService.createAuction(dto);
  }

  @Get()
  findAll(@Query() query: FindAuctionsQueryDto): Promise<PaginatedAuctionsDto> {
    return this.auctionsService.findAll(query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AuctionResponseDto> {
    return this.auctionsService.findOne(id);
  }

  @Get(':id/bids')
  findBids(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AuctionBidDto[]> {
    return this.auctionsService.findBidsByAuction(id);
  }

  @Post(':id/start')
  @UseGuards(AuthGuard)
  startAuction(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AuctionResponseDto> {
    return this.auctionsService.startAuction(id);
  }

  @Post(':id/bids')
  @UseGuards(AuthGuard)
  placeBid(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateBidDto,
  ): Promise<BidResponseDto> {
    return this.auctionsService.placeBid(id, dto);
  }

  @Post(':id/buy')
  @UseGuards(AuthGuard)
  buyAuction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BuyAuctionDto,
  ): Promise<BuyAuctionResponseDto> {
    return this.auctionsService.buyAuction(id, dto);
  }
}
