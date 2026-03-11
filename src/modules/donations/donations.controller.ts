import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateItemDonationDto } from './dto/create-item-donation.dto';
import { CreateMoneyDonationDto } from './dto/create-money-donation.dto';
import { FindItemDonationsQueryDto } from './dto/find-item-donations-query.dto';
import { FindMoneyDonationsQueryDto } from './dto/find-money-donations-query.dto';
import {
  DonationItemResponseDto,
  DonationMoneyResponseDto,
  PaginatedItemDonationsDto,
  PaginatedMoneyDonationsDto,
} from './dto/donation-response.dto';
import { UpdateDonationItemStatusDto } from './dto/update-donation-item-status.dto';
import { DonationsService } from './donations.service';

@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post('money')
  createMoneyDonation(
    @Body() dto: CreateMoneyDonationDto,
  ): Promise<DonationMoneyResponseDto> {
    return this.donationsService.createMoneyDonation(dto);
  }

  @Get('money')
  findMoneyDonations(
    @Query() query: FindMoneyDonationsQueryDto,
  ): Promise<PaginatedMoneyDonationsDto> {
    return this.donationsService.findMoneyDonations(query);
  }

  @Get('money/:id')
  findMoneyDonationById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DonationMoneyResponseDto> {
    return this.donationsService.findMoneyDonationById(id);
  }

  @Post('items')
  createItemDonation(
    @Body() dto: CreateItemDonationDto,
  ): Promise<DonationItemResponseDto> {
    return this.donationsService.createItemDonation(dto);
  }

  @Get('items')
  findItemDonations(
    @Query() query: FindItemDonationsQueryDto,
  ): Promise<PaginatedItemDonationsDto> {
    return this.donationsService.findItemDonations(query);
  }

  @Get('items/:id')
  findItemDonationById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DonationItemResponseDto> {
    return this.donationsService.findItemDonationById(id);
  }

  @Patch('items/:id/status')
  updateItemDonationStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDonationItemStatusDto,
  ): Promise<DonationItemResponseDto> {
    return this.donationsService.updateItemDonationStatus(id, dto);
  }
}
