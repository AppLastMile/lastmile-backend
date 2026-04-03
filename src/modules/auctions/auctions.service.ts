import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuctionClosedEvent } from '../../events/auction-closed.event';
import { AuctionCreatedEvent } from '../../events/auction-created.event';
import { AuctionSoldEvent } from '../../events/auction-sold.event';
import { BidPlacedEvent } from '../../events/bid-placed.event';
import { DonationMoney } from '../donations/entities/donation-money.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { Product } from '../products/entities/product.entity';
import { BuyAuctionDto } from './dto/buy-auction.dto';
import { AuctionBidDto, BidResponseDto } from './dto/bid-response.dto';
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
import { Auction, AuctionBidMode, AuctionStatus } from './entities/auction.entity';

@Injectable()
export class AuctionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuctionsService.name);
  private readonly scheduledTimers = new Map<number, NodeJS.Timeout>();

  constructor(
    @InjectRepository(Auction)
    private readonly auctionsRepository: Repository<Auction>,
    @InjectRepository(Bid)
    private readonly bidsRepository: Repository<Bid>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    const activeAuctions = await this.auctionsRepository.find({
      where: { status: AuctionStatus.ACTIVE },
      select: { id: true, endAt: true },
    });

    const now = new Date();
    for (const auction of activeAuctions) {
      if (!auction.endAt) continue;
      const delayMs = auction.endAt.getTime() - now.getTime();
      if (delayMs <= 0) {
        void this.closeAuction(auction.id);
      } else {
        this.scheduleAuctionClose(auction.id, delayMs);
      }
    }

    this.logger.log(
      `Scheduled auto-close for ${activeAuctions.length} active auction(s)`,
    );
  }

  onModuleDestroy(): void {
    for (const timer of this.scheduledTimers.values()) {
      clearTimeout(timer);
    }
    this.scheduledTimers.clear();
  }

  async createAuction(
    dto: CreateAuctionDto,
    sellerId: number,
  ): Promise<AuctionResponseDto> {
    // Auto-generate product with itemName
    const newProduct = this.productsRepository.create({
      name: dto.itemName.trim(),
      description: '',
      createdBy: sellerId,
    });
    const savedProduct = await this.productsRepository.save(newProduct);

    const bidMode = dto.bidMode ?? AuctionBidMode.FREE;

    if (bidMode === AuctionBidMode.FIXED_INCREMENT && !dto.bidIncrement) {
      throw new BadRequestException(
        'bidIncrement is required when bidMode is fixed_increment',
      );
    }

    const auction = this.auctionsRepository.create({
      productId: savedProduct.id,
      campaignId: null,
      sellerId: sellerId,
      itemName: dto.itemName.trim(),
      description: '',
      initialPrice: dto.initialPrice,
      currentPrice: null,
      currency: (dto.currency ?? 'COP').toUpperCase(),
      durationMinutes: dto.durationMinutes,
      status: AuctionStatus.CREATED,
      bidMode,
      bidIncrement: bidMode === AuctionBidMode.FIXED_INCREMENT ? dto.bidIncrement! : null,
      buyerId: null,
      winnerId: null,
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
      qb.andWhere('auction.productId = :productId', {
        productId: query.productId,
      });
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

  async findOne(id: number): Promise<AuctionResponseDto> {
    const auction = await this.auctionsRepository.findOne({ where: { id } });
    if (!auction) {
      throw new NotFoundException(`Auction with id ${id} was not found`);
    }
    return this.toAuctionResponse(auction);
  }

  async findBidsByAuction(auctionId: number): Promise<AuctionBidDto[]> {
    const auction = await this.auctionsRepository.findOne({
      where: { id: auctionId },
      select: { id: true },
    });
    if (!auction) {
      throw new NotFoundException(`Auction with id ${auctionId} was not found`);
    }

    const bids = await this.bidsRepository.find({
      where: { auctionId },
      order: { createdAt: 'DESC' },
    });

    return bids.map((b) => ({
      id: b.id,
      auctionId: b.auctionId,
      userId: b.userId,
      amount: Number(b.amount),
      createdAt: b.createdAt,
    }));
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

    const delayMs = auction.durationMinutes * 60 * 1000;
    this.scheduleAuctionClose(auctionId, delayMs);

    return this.toAuctionResponse(updated!);
  }

  async placeBid(
    auctionId: number,
    dto: CreateBidDto,
  ): Promise<BidResponseDto> {
    const result = await this.dataSource.transaction(async (manager) => {
      const auctionRepo = manager.getRepository(Auction);
      const bidRepo = manager.getRepository(Bid);

      const auction = await auctionRepo.findOne({
        where: { id: auctionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!auction) {
        throw new NotFoundException(
          `Auction with id ${auctionId} was not found`,
        );
      }

      if (auction.status !== AuctionStatus.ACTIVE) {
        throw new BadRequestException(
          `Bids can only be placed on active auctions. Current status: '${auction.status}'`,
        );
      }

      const currentPrice = Number(auction.currentPrice ?? auction.initialPrice);

      let bidAmount: number;

      if (auction.bidMode === AuctionBidMode.FIXED_INCREMENT) {
        bidAmount = currentPrice + Number(auction.bidIncrement);
      } else {
        if (dto.amount === undefined) {
          throw new BadRequestException('amount is required for free-bid auctions');
        }
        if (dto.amount <= currentPrice) {
          throw new BadRequestException(
            `Bid amount must be greater than the current price of ${currentPrice}`,
          );
        }
        bidAmount = dto.amount;
      }

      const bid = bidRepo.create({
        auctionId,
        userId: dto.userId,
        amount: bidAmount,
      });
      const savedBid = await bidRepo.save(bid);

      await auctionRepo.update(auctionId, {
        currentPrice: bidAmount,
        version: () => 'version + 1',
      });

      return { bid: savedBid, newCurrentPrice: bidAmount, campaignId: auction.campaignId };
    });

    const payload: BidPlacedEvent = {
      bidId: result.bid.id,
      auctionId,
      campaignId: result.campaignId,
      userId: dto.userId,
      amount: result.newCurrentPrice,
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
            amount: Number(
              soldAuction.currentPrice ?? soldAuction.initialPrice,
            ),
          })
          .execute();
      }

      const response = this.toBuyAuctionResponse(soldAuction);

      await this.saveIdempotencyRecord(
        idempotencyRepository,
        auctionId,
        dto,
        200,
        {
          ...response,
          soldAt: response.soldAt.toISOString(),
        },
      );

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

  private scheduleAuctionClose(auctionId: number, delayMs: number): void {
    const existing = this.scheduledTimers.get(auctionId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      void this.closeAuction(auctionId);
      this.scheduledTimers.delete(auctionId);
    }, delayMs);

    this.scheduledTimers.set(auctionId, timer);
  }

  private async closeAuction(auctionId: number): Promise<void> {
    const closed = await this.dataSource.transaction(async (manager) => {
      const bidRepo = manager.getRepository(Bid);

      const highestBid = await bidRepo
        .createQueryBuilder('bid')
        .where('bid.auctionId = :auctionId', { auctionId })
        .orderBy('bid.amount', 'DESC')
        .addOrderBy('bid.createdAt', 'ASC')
        .limit(1)
        .getOne();

      const winnerId = highestBid?.userId ?? null;

      const updateResult = await manager
        .createQueryBuilder()
        .update(Auction)
        .set({
          status: AuctionStatus.CLOSED,
          winnerId,
          version: () => 'version + 1',
        })
        .where('id = :auctionId', { auctionId })
        .andWhere('status = :status', { status: AuctionStatus.ACTIVE })
        .returning('*')
        .execute();

      const raw = updateResult.raw[0] as Auction | undefined;
      if (!raw) return null;

      const closedAuction = manager.getRepository(Auction).create(raw);
      return { auction: closedAuction, winnerId };
    });

    if (!closed) {
      return;
    }

    this.logger.log(
      `Auction ${auctionId} closed. Winner: ${closed.winnerId ?? 'none'}`,
    );

    const payload: AuctionClosedEvent = {
      auctionId,
      productId: closed.auction.productId,
      campaignId: closed.auction.campaignId,
      winnerId: closed.winnerId,
      itemName: closed.auction.itemName,
      winningAmount: Number(
        closed.auction.currentPrice ?? closed.auction.initialPrice,
      ),
      currency: closed.auction.currency,
      closedAt: new Date(),
    };
    this.eventEmitter.emit('auction.closed', payload);
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
      currentPrice:
        auction.currentPrice !== null ? Number(auction.currentPrice) : null,
      currency: auction.currency,
      durationMinutes: auction.durationMinutes,
      status: auction.status,
      bidMode: auction.bidMode,
      bidIncrement: auction.bidIncrement !== null ? Number(auction.bidIncrement) : null,
      buyerId: auction.buyerId,
      winnerId: auction.winnerId,
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
