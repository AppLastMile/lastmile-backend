import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuctionCreatedEvent } from '../../events/auction-created.event';
import { AuctionSoldEvent } from '../../events/auction-sold.event';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { DonationMoney } from '../donations/entities/donation-money.entity';
import { BuyAuctionDto } from './dto/buy-auction.dto';
import {
  AuctionResponseDto,
  BuyAuctionResponseDto,
  PaginatedAuctionsDto,
} from './dto/auction-response.dto';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { FindCampaignAuctionsQueryDto } from './dto/find-campaign-auctions-query.dto';
import { AuctionBuyIdempotencyRecord } from './entities/auction-buy-idempotency-record.entity';
import { Auction, AuctionStatus } from './entities/auction.entity';

@Injectable()
export class AuctionsService {
  constructor(
    @InjectRepository(Auction)
    private readonly auctionsRepository: Repository<Auction>,
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createAuction(
    campaignId: number,
    dto: CreateAuctionDto,
  ): Promise<AuctionResponseDto> {
    await this.ensureCampaignExists(campaignId);

    const auction = this.auctionsRepository.create({
      campaignId,
      sellerId: dto.sellerId,
      itemName: dto.itemName,
      description: dto.description ?? null,
      price: dto.price,
      currency: (dto.currency ?? 'COP').toUpperCase(),
      status: AuctionStatus.ACTIVE,
      buyerId: null,
      soldAt: null,
      version: 1,
    });

    const savedAuction = await this.auctionsRepository.save(auction);

    const payload: AuctionCreatedEvent = {
      auctionId: savedAuction.id,
      campaignId: savedAuction.campaignId,
      sellerId: savedAuction.sellerId,
      price: Number(savedAuction.price),
      currency: savedAuction.currency,
    };
    this.eventEmitter.emit('auction.created', payload);

    return this.toAuctionResponse(savedAuction);
  }

  async getCampaignAuctions(
    campaignId: number,
    query: FindCampaignAuctionsQueryDto,
  ): Promise<PaginatedAuctionsDto> {
    await this.ensureCampaignExists(campaignId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.auctionsRepository
      .createQueryBuilder('auction')
      .where('auction.campaignId = :campaignId', { campaignId });

    const statusFilter = query.status ?? 'all';
    if (statusFilter !== 'all') {
      qb.andWhere('auction.status = :status', { status: statusFilter });
    }

    qb.orderBy('auction.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [auctions, total] = await qb.getManyAndCount();

    return {
      data: auctions.map((auction) => this.toAuctionResponse(auction)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async buyAuction(
    auctionId: number,
    dto: BuyAuctionDto,
  ): Promise<BuyAuctionResponseDto> {
    const result = await this.dataSource.transaction(async (manager) => {
      const idempotencyRepository = manager.getRepository(
        AuctionBuyIdempotencyRecord,
      );

      if (dto.idempotencyKey) {
        const existingRecord = await idempotencyRepository.findOne({
          where: {
            auctionId,
            buyerId: dto.buyerId,
            idempotencyKey: dto.idempotencyKey,
          },
        });

        if (existingRecord) {
          if (existingRecord.statusCode === 200) {
            const payload =
              existingRecord.responsePayload as unknown as BuyAuctionResponseDto & {
                soldAt: string | Date;
              };

            return {
              ...payload,
              soldAt: new Date(payload.soldAt),
            };
          }

          if (existingRecord.statusCode === 404) {
            throw new NotFoundException('Auction was not found');
          }

          throw new ConflictException('Auction is already sold');
        }
      }

      const updateResult = await manager
        .createQueryBuilder()
        .update(Auction)
        .set({
          status: AuctionStatus.SOLD,
          buyerId: dto.buyerId,
          soldAt: () => 'NOW()',
          version: () => 'version + 1',
        })
        .where('id = :auctionId', { auctionId })
        .andWhere('status = :activeStatus', {
          activeStatus: AuctionStatus.ACTIVE,
        })
        .returning('*')
        .execute();

      const soldRaw = updateResult.raw[0] as Auction | undefined;

      if (!soldRaw) {
        const existingAuction = await manager.getRepository(Auction).findOne({
          where: { id: auctionId },
          select: { id: true },
        });

        if (!existingAuction) {
          await this.saveIdempotencyRecord(
            idempotencyRepository,
            auctionId,
            dto,
            404,
            { message: 'Auction was not found' },
          );
          throw new NotFoundException('Auction was not found');
        }

        await this.saveIdempotencyRecord(
          idempotencyRepository,
          auctionId,
          dto,
          409,
          { message: 'Auction is already sold' },
        );
        throw new ConflictException('Auction is already sold');
      }

      const soldAuction = manager.getRepository(Auction).create(soldRaw);

      const donationMoneyRepository = manager.getRepository(DonationMoney);
      const donation = donationMoneyRepository.create({
        campaignId: soldAuction.campaignId,
        donorId: dto.buyerId,
        amount: soldAuction.price,
      });
      await donationMoneyRepository.save(donation);

      await manager
        .createQueryBuilder()
        .update(Campaign)
        .set({
          collectedMoney: () => 'collectedMoney + :amount',
        })
        .where('id = :campaignId', { campaignId: soldAuction.campaignId })
        .setParameters({ amount: Number(soldAuction.price) })
        .execute();

      const response = this.toBuyAuctionResponse(soldAuction);

      await this.saveIdempotencyRecord(idempotencyRepository, auctionId, dto, 200, {
        ...response,
        soldAt: response.soldAt.toISOString(),
      });

      return response;
    });

    const soldPayload: AuctionSoldEvent = {
      auctionId: result.id,
      campaignId: result.campaignId,
      buyerId: result.buyerId,
      soldAt: result.soldAt,
      price: result.price,
      currency: result.currency,
    };
    this.eventEmitter.emit('auction.sold', soldPayload);

    return result;
  }

  private async ensureCampaignExists(campaignId: number): Promise<void> {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      select: { id: true },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with id ${campaignId} was not found`);
    }
  }

  private async saveIdempotencyRecord(
    repository: Repository<AuctionBuyIdempotencyRecord>,
    auctionId: number,
    dto: BuyAuctionDto,
    statusCode: number,
    responsePayload: Record<string, unknown>,
  ): Promise<void> {
    if (!dto.idempotencyKey) {
      return;
    }

    await repository
      .createQueryBuilder()
      .insert()
      .into(AuctionBuyIdempotencyRecord)
      .values({
        auctionId,
        buyerId: dto.buyerId,
        idempotencyKey: dto.idempotencyKey,
        statusCode,
        responsePayload: responsePayload as unknown as object,
      })
      .orIgnore()
      .execute();
  }

  private toAuctionResponse(auction: Auction): AuctionResponseDto {
    return {
      id: auction.id,
      campaignId: auction.campaignId,
      sellerId: auction.sellerId,
      itemName: auction.itemName,
      description: auction.description,
      price: Number(auction.price),
      currency: auction.currency,
      status: auction.status,
      buyerId: auction.buyerId,
      createdAt: auction.createdAt,
      soldAt: auction.soldAt,
      version: auction.version,
    };
  }

  private toBuyAuctionResponse(auction: Auction): BuyAuctionResponseDto {
    return {
      id: auction.id,
      campaignId: auction.campaignId,
      status: auction.status,
      buyerId: auction.buyerId ?? 0,
      soldAt: auction.soldAt ?? auction.createdAt,
      price: Number(auction.price),
      currency: auction.currency,
    };
  }
}
