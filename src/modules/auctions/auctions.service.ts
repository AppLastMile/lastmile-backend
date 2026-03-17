import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuctionCreatedEvent } from '../../events/auction-created.event';
import { AuctionSoldEvent } from '../../events/auction-sold.event';
import { BidPlacedEvent } from '../../events/bid-placed.event';
import { DonationMoney } from '../donations/entities/donation-money.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { Product } from '../products/entities/product.entity';
import { BuyAuctionDto } from './dto/buy-auction.dto';
import { BidResponseDto } from './dto/bid-response.dto';
import { CreateBidDto } from './dto/create-bid.dto';
import {
  AuctionResponseDto,
  BuyAuctionResponseDto,
  PaginatedAuctionsDto,
} from './dto/auction-response.dto';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { FindAuctionsQueryDto } from './dto/find-auctions-query.dto';
import { AuctionBuyIdempotencyRecord } from './entities/auction-buy-idempotency-record.entity';
import { Bid } from './entities/bid.entity';
import { Auction, AuctionStatus } from './entities/auction.entity';

@Injectable()
export class AuctionsService {
  constructor(
    @InjectRepository(Auction)
    private readonly auctionsRepository: Repository<Auction>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createAuction(dto: CreateAuctionDto): Promise<AuctionResponseDto> {
    const product = await this.productsRepository.findOne({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${dto.productId} was not found`);
    }

    if (dto.campaignId) {
      await this.ensureCampaignExists(dto.campaignId);
    }

    const auction = this.auctionsRepository.create({
      productId: dto.productId,
      campaignId: dto.campaignId ?? null,
      sellerId: product.createdBy,
      itemName: product.name,
      description: product.description,
      initialPrice: dto.initialPrice,
      currentPrice: null,
      currency: (dto.currency ?? 'COP').toUpperCase(),
      durationMinutes: dto.durationMinutes,
      status: AuctionStatus.CREATED,
      buyerId: null,
      startedAt: null,
      endAt: null,
      soldAt: null,
      version: 1,
    });

    const savedAuction = await this.auctionsRepository.save(auction);

    const payload: AuctionCreatedEvent = {
      auctionId: savedAuction.id,
      productId: savedAuction.productId,
      campaignId: savedAuction.campaignId,
      sellerId: savedAuction.sellerId,
      price: Number(savedAuction.initialPrice),
      currency: savedAuction.currency,
    };
    this.eventEmitter.emit('auction.created', payload);

    return this.toAuctionResponse(savedAuction);
  }

  async findAll(query: FindAuctionsQueryDto): Promise<PaginatedAuctionsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.auctionsRepository.createQueryBuilder('auction');

    if (query.productId) {
      qb.andWhere('auction.productId = :productId', { productId: query.productId });
    }

    if (query.status && query.status !== 'all') {
      qb.andWhere('auction.status = :status', { status: query.status });
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

  async startAuction(auctionId: number): Promise<AuctionResponseDto> {
    const auction = await this.auctionsRepository.findOne({
      where: { id: auctionId },
    });

    if (!auction) {
      throw new NotFoundException(`Auction with id ${auctionId} was not found`);
    }

    if (auction.status !== AuctionStatus.CREATED) {
      throw new BadRequestException(
        `Auction cannot be started because its current status is '${auction.status}'`,
      );
    }

    const now = new Date();
    const endAt = new Date(now.getTime() + auction.durationMinutes * 60 * 1000);

    await this.auctionsRepository.update(auctionId, {
      status: AuctionStatus.ACTIVE,
      startedAt: now,
      endAt,
      currentPrice: auction.initialPrice,
    });

    const updated = await this.auctionsRepository.findOne({
      where: { id: auctionId },
    });

    return this.toAuctionResponse(updated!);
  }

  async placeBid(auctionId: number, dto: CreateBidDto): Promise<BidResponseDto> {
    const result = await this.dataSource.transaction(async (manager) => {
      const auctionRepo = manager.getRepository(Auction);
      const bidRepo = manager.getRepository(Bid);

      const auction = await auctionRepo.findOne({
        where: { id: auctionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!auction) {
        throw new NotFoundException(`Auction with id ${auctionId} was not found`);
      }

      if (auction.status !== AuctionStatus.ACTIVE) {
        throw new BadRequestException(
          `Bids can only be placed on active auctions. Current status: '${auction.status}'`,
        );
      }

      const currentPrice = Number(auction.currentPrice ?? auction.initialPrice);

      if (dto.amount <= currentPrice) {
        throw new BadRequestException(
          `Bid amount must be greater than the current price of ${currentPrice}`,
        );
      }

      const bid = bidRepo.create({
        auctionId,
        userId: dto.userId,
        amount: dto.amount,
      });
      const savedBid = await bidRepo.save(bid);

      await auctionRepo.update(auctionId, {
        currentPrice: dto.amount,
        version: () => 'version + 1',
      });

      return { bid: savedBid, newCurrentPrice: dto.amount };
    });

    const payload: BidPlacedEvent = {
      bidId: result.bid.id,
      auctionId,
      userId: dto.userId,
      amount: dto.amount,
      previousPrice: result.newCurrentPrice,
    };
    this.eventEmitter.emit('bid.placed', payload);

    return {
      id: result.bid.id,
      auctionId,
      userId: dto.userId,
      amount: Number(result.bid.amount),
      currentAuctionPrice: result.newCurrentPrice,
      createdAt: result.bid.createdAt,
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

      if (soldAuction.campaignId !== null) {
        const donationMoneyRepository = manager.getRepository(DonationMoney);
        const donation = donationMoneyRepository.create({
          campaignId: soldAuction.campaignId,
          donorId: dto.buyerId,
          amount: soldAuction.currentPrice ?? soldAuction.initialPrice,
        });
        await donationMoneyRepository.save(donation);

        await manager
          .createQueryBuilder()
          .update(Campaign)
          .set({ collectedMoney: () => 'collectedMoney + :amount' })
          .where('id = :campaignId', { campaignId: soldAuction.campaignId })
          .setParameters({
            amount: Number(soldAuction.currentPrice ?? soldAuction.initialPrice),
          })
          .execute();
      }

      const response = this.toBuyAuctionResponse(soldAuction);

      await this.saveIdempotencyRecord(idempotencyRepository, auctionId, dto, 200, {
        ...response,
        soldAt: response.soldAt.toISOString(),
      });

      return response;
    });

    const soldPayload: AuctionSoldEvent = {
      auctionId: result.id,
      productId: result.productId,
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
      productId: auction.productId,
      campaignId: auction.campaignId,
      sellerId: auction.sellerId,
      itemName: auction.itemName,
      description: auction.description,
      initialPrice: Number(auction.initialPrice),
      currentPrice: auction.currentPrice !== null ? Number(auction.currentPrice) : null,
      currency: auction.currency,
      durationMinutes: auction.durationMinutes,
      status: auction.status,
      buyerId: auction.buyerId,
      startedAt: auction.startedAt,
      endAt: auction.endAt,
      createdAt: auction.createdAt,
      soldAt: auction.soldAt,
      version: auction.version,
    };
  }

  private toBuyAuctionResponse(auction: Auction): BuyAuctionResponseDto {
    return {
      id: auction.id,
      productId: auction.productId,
      campaignId: auction.campaignId,
      status: auction.status,
      buyerId: auction.buyerId ?? 0,
      soldAt: auction.soldAt ?? auction.createdAt,
      price: Number(auction.currentPrice ?? auction.initialPrice),
      currency: auction.currency,
    };
  }
}
