import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DonationCreatedEvent } from '../../events/donation-created.event';
import { DonationItemReceivedEvent } from '../../events/donation-item-received.event';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { CreateItemDonationDto } from './dto/create-item-donation.dto';
import { CreateMoneyDonationDto } from './dto/create-money-donation.dto';
import {
  DonationItemResponseDto,
  DonationMoneyResponseDto,
  PaginatedItemDonationsDto,
  PaginatedMoneyDonationsDto,
} from './dto/donation-response.dto';
import { FindItemDonationsQueryDto } from './dto/find-item-donations-query.dto';
import { FindMoneyDonationsQueryDto } from './dto/find-money-donations-query.dto';
import { UpdateDonationItemStatusDto } from './dto/update-donation-item-status.dto';
import {
  DonationItem,
  DonationItemStatus,
} from './entities/donation-item.entity';
import { DonationMoney } from './entities/donation-money.entity';

@Injectable()
export class DonationsService {
  constructor(
    @InjectRepository(DonationMoney)
    private readonly donationMoneyRepository: Repository<DonationMoney>,
    @InjectRepository(DonationItem)
    private readonly donationItemRepository: Repository<DonationItem>,
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createMoneyDonation(
    dto: CreateMoneyDonationDto,
  ): Promise<DonationMoneyResponseDto> {
    await this.ensureCampaignExists(dto.campaignId);

    const donation = this.donationMoneyRepository.create(dto);
    const savedDonation = await this.donationMoneyRepository.save(donation);

    const eventPayload: DonationCreatedEvent = {
      campaignId: savedDonation.campaignId,
      donorId: savedDonation.donorId,
      amount: Number(savedDonation.amount),
    };
    this.eventEmitter.emit('donation.created', eventPayload);

    return this.toMoneyDonationResponse(savedDonation);
  }

  async findMoneyDonations(
    query: FindMoneyDonationsQueryDto,
  ): Promise<PaginatedMoneyDonationsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.donationMoneyRepository.createQueryBuilder('donationMoney');

    if (query.campaignId) {
      qb.andWhere('donationMoney.campaignId = :campaignId', {
        campaignId: query.campaignId,
      });
    }

    if (query.donorId) {
      qb.andWhere('donationMoney.donorId = :donorId', {
        donorId: query.donorId,
      });
    }

    qb.orderBy('donationMoney.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [donations, total] = await qb.getManyAndCount();

    return {
      data: donations.map((donation) => this.toMoneyDonationResponse(donation)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findMoneyDonationById(id: number): Promise<DonationMoneyResponseDto> {
    const donation = await this.donationMoneyRepository.findOne({
      where: { id },
    });
    if (!donation) {
      throw new NotFoundException(`Money donation with id ${id} was not found`);
    }

    return this.toMoneyDonationResponse(donation);
  }

  async createItemDonation(
    dto: CreateItemDonationDto,
  ): Promise<DonationItemResponseDto> {
    await this.ensureCampaignExists(dto.campaignId);

    const donationItem = this.donationItemRepository.create({
      ...dto,
      status: DonationItemStatus.PENDING,
    });
    const savedDonationItem =
      await this.donationItemRepository.save(donationItem);

    return this.toItemDonationResponse(savedDonationItem);
  }

  async findItemDonations(
    query: FindItemDonationsQueryDto,
  ): Promise<PaginatedItemDonationsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.donationItemRepository.createQueryBuilder('donationItem');

    if (query.campaignId) {
      qb.andWhere('donationItem.campaignId = :campaignId', {
        campaignId: query.campaignId,
      });
    }

    if (query.donorId) {
      qb.andWhere('donationItem.donorId = :donorId', {
        donorId: query.donorId,
      });
    }

    if (query.status) {
      qb.andWhere('donationItem.status = :status', {
        status: query.status,
      });
    }

    if (query.itemName) {
      qb.andWhere('LOWER(donationItem.itemName) LIKE :itemName', {
        itemName: `%${query.itemName.toLowerCase()}%`,
      });
    }

    qb.orderBy('donationItem.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [donations, total] = await qb.getManyAndCount();

    return {
      data: donations.map((donation) => this.toItemDonationResponse(donation)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findItemDonationById(id: number): Promise<DonationItemResponseDto> {
    const donationItem = await this.donationItemRepository.findOne({
      where: { id },
    });
    if (!donationItem) {
      throw new NotFoundException(`Item donation with id ${id} was not found`);
    }

    return this.toItemDonationResponse(donationItem);
  }

  async updateItemDonationStatus(
    id: number,
    dto: UpdateDonationItemStatusDto,
  ): Promise<DonationItemResponseDto> {
    const donationItem = await this.donationItemRepository.findOne({
      where: { id },
    });
    if (!donationItem) {
      throw new NotFoundException(`Item donation with id ${id} was not found`);
    }

    const updatedDonationItem = await this.donationItemRepository.save({
      ...donationItem,
      status: dto.status,
    });

    if (dto.status === DonationItemStatus.DELIVERED_TO_PICKUP_POINT) {
      const eventPayload: DonationItemReceivedEvent = {
        donationItemId: updatedDonationItem.id,
        campaignId: updatedDonationItem.campaignId,
        donorId: updatedDonationItem.donorId,
        quantity: updatedDonationItem.quantity,
      };
      this.eventEmitter.emit('donation.item.received', eventPayload);
    }

    return this.toItemDonationResponse(updatedDonationItem);
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

  private toMoneyDonationResponse(
    donation: DonationMoney,
  ): DonationMoneyResponseDto {
    return {
      id: donation.id,
      campaignId: donation.campaignId,
      donorId: donation.donorId,
      amount: Number(donation.amount),
      createdAt: donation.createdAt,
    };
  }

  private toItemDonationResponse(
    donation: DonationItem,
  ): DonationItemResponseDto {
    return {
      id: donation.id,
      campaignId: donation.campaignId,
      donorId: donation.donorId,
      itemName: donation.itemName,
      quantity: donation.quantity,
      status: donation.status,
      createdAt: donation.createdAt,
    };
  }
}
