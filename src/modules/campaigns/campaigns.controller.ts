import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { FindCampaignsQueryDto } from './dto/find-campaigns-query.dto';
import {
  CampaignItemsSummaryResponseDto,
  CampaignResponseDto,
  PaginatedCampaignsDto,
} from './dto/campaign-response.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(@Body() dto: CreateCampaignDto): Promise<CampaignResponseDto> {
    return this.campaignsService.create(dto);
  }

  @Get()
  findAll(
    @Query() query: FindCampaignsQueryDto,
  ): Promise<PaginatedCampaignsDto> {
    return this.campaignsService.findAll(query);
  }

  @Get('event/:eventId')
  findByEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query() query: FindCampaignsQueryDto,
  ): Promise<PaginatedCampaignsDto> {
    return this.campaignsService.findAll({ ...query, eventId });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<CampaignResponseDto> {
    return this.campaignsService.findOneById(id);
  }

  @Get(':campaignId/items-summary')
  getItemsSummary(
    @Param('campaignId', ParseIntPipe) campaignId: number,
  ): Promise<CampaignItemsSummaryResponseDto> {
    return this.campaignsService.getItemsSummary(campaignId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCampaignDto,
  ): Promise<CampaignResponseDto> {
    return this.campaignsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.campaignsService.remove(id);
  }
}
