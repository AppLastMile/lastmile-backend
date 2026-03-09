import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignCreatedEvent } from '../../events/campaign-created.event';
import type { DonationCreatedEvent } from '../../events/donation-created.event';
import { Event } from '../events/entities/event.entity';
import { DonationItem } from '../donations/entities/donation-item.entity';
import {
  CampaignItemsSummaryResponseDto,
  CampaignResponseDto,
  PaginatedCampaignsDto,
} from './dto/campaign-response.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { FindCampaignsQueryDto } from './dto/find-campaigns-query.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Campaign } from './entities/campaign.entity';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    @InjectRepository(DonationItem)
    private readonly donationItemsRepository: Repository<DonationItem>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateCampaignDto): Promise<CampaignResponseDto> {
    await this.ensureEventExists(dto.eventId);

    const campaign = this.campaignsRepository.create({
      ...dto,
      collectedMoney: 0,
    });
    const savedCampaign = await this.campaignsRepository.save(campaign);

    const eventPayload: CampaignCreatedEvent = {
      campaignId: savedCampaign.id,
      eventId: savedCampaign.eventId,
      createdBy: savedCampaign.createdBy,
      campaignType: savedCampaign.campaignType,
    };
    this.eventEmitter.emit('campaign.created', eventPayload);

    return this.toCampaignResponse(savedCampaign);
  }

  async findAll(query: FindCampaignsQueryDto): Promise<PaginatedCampaignsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.campaignsRepository.createQueryBuilder('campaign');

    if (query.eventId) {
      qb.andWhere('campaign.eventId = :eventId', { eventId: query.eventId });
    }

    if (query.createdBy) {
      qb.andWhere('campaign.createdBy = :createdBy', {
        createdBy: query.createdBy,
      });
    }

    if (query.campaignType) {
      qb.andWhere('campaign.campaignType = :campaignType', {
        campaignType: query.campaignType,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(campaign.name) LIKE :search OR LOWER(campaign.description) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    qb.orderBy('campaign.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [campaigns, total] = await qb.getManyAndCount();

    return {
      data: campaigns.map((campaign) => this.toCampaignResponse(campaign)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOneById(id: number): Promise<CampaignResponseDto> {
    const campaign = await this.campaignsRepository.findOne({ where: { id } });
    if (!campaign) {
      throw new NotFoundException(`Campaign with id ${id} was not found`);
    }

    return this.toCampaignResponse(campaign);
  }

  async getItemsSummary(
    campaignId: number,
  ): Promise<CampaignItemsSummaryResponseDto> {
    await this.ensureCampaignExists(campaignId);

    const summaryRows = await this.donationItemsRepository
      .createQueryBuilder('donationItem')
      .select('donationItem.itemName', 'itemType')
      .addSelect('SUM(donationItem.quantity)', 'quantity')
      .where('donationItem.campaignId = :campaignId', { campaignId })
      .groupBy('donationItem.itemName')
      .orderBy('itemType', 'ASC')
      .getRawMany<{ itemType: string; quantity: string }>();

    const latestDonation = await this.donationItemsRepository
      .createQueryBuilder('donationItem')
      .where('donationItem.campaignId = :campaignId', { campaignId })
      .orderBy('donationItem.createdAt', 'DESC')
      .select(['donationItem.createdAt'])
      .getOne();

    return {
      campaignId,
      items: summaryRows.map((row) => ({
        itemType: row.itemType,
        quantity: Number(row.quantity),
      })),
      updatedAt: latestDonation?.createdAt ?? new Date(),
    };
  }

  async update(
    id: number,
    dto: UpdateCampaignDto,
  ): Promise<CampaignResponseDto> {
    const campaign = await this.campaignsRepository.findOne({ where: { id } });
    if (!campaign) {
      throw new NotFoundException(`Campaign with id ${id} was not found`);
    }

    if (dto.eventId) {
      await this.ensureEventExists(dto.eventId);
    }

    const updatedCampaign = await this.campaignsRepository.save({
      ...campaign,
      ...dto,
    });

    return this.toCampaignResponse(updatedCampaign);
  }

  async remove(id: number): Promise<void> {
    const result = await this.campaignsRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`Campaign with id ${id} was not found`);
    }
  }

  @OnEvent('donation.created')
  async handleDonationCreated(payload: DonationCreatedEvent): Promise<void> {
    await this.campaignsRepository
      .createQueryBuilder()
      .update(Campaign)
      .set({
        collectedMoney: () => 'collectedMoney + :amount',
      })
      .where('id = :campaignId', {
        campaignId: payload.campaignId,
      })
      .setParameters({ amount: payload.amount })
      .execute();
  }

  private async ensureEventExists(eventId: number): Promise<void> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException(`Event with id ${eventId} was not found`);
    }
  }

  private async ensureCampaignExists(campaignId: number): Promise<void> {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      select: { id: true },
    });

    if (!campaign) {
      throw new NotFoundException(
        `Campaign with id ${campaignId} was not found`,
      );
    }
  }

  private toCampaignResponse(campaign: Campaign): CampaignResponseDto {
    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      campaignType: campaign.campaignType,
      goalMoney: Number(campaign.goalMoney),
      collectedMoney: Number(campaign.collectedMoney),
      eventId: campaign.eventId,
      createdBy: campaign.createdBy,
    };
  }
}
