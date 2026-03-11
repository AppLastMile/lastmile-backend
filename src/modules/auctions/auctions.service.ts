import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction, AuctionStatus } from './entities/auction.entity';

@Injectable()
export class AuctionsService {
  constructor(
    @InjectRepository(Auction)
    private readonly auctionsRepository: Repository<Auction>,
  ) {}

  async listByCampaign(
    campaignId: number,
    status: 'active' | 'sold' | 'all',
    page: number,
    limit: number,
  ) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 100;

    const qb = this.auctionsRepository
      .createQueryBuilder('auction')
      .where('auction.campaignId = :campaignId', { campaignId });

    if (status !== 'all') {
      qb.andWhere('auction.status = :status', { status });
    }

    const [data, total] = await qb
      .orderBy('auction.id', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return {
      data,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }

  create(
    campaignId: number,
    body: {
      sellerId: number;
      itemName: string;
      description?: string;
      price: number;
      currency?: string;
    },
  ) {
    const auction = this.auctionsRepository.create({
      campaignId,
      sellerId: body.sellerId,
      itemName: body.itemName,
      description: body.description ?? null,
      price: body.price,
      currency: body.currency ?? null,
      status: AuctionStatus.ACTIVE,
      buyerId: null,
      soldAt: null,
    });

    return this.auctionsRepository.save(auction);
  }

  async buy(auctionId: number, buyerId: number) {
    const auction = await this.auctionsRepository.findOne({
      where: { id: auctionId },
    });

    if (!auction) {
      return { message: 'Auction not found' };
    }

    if (auction.status !== AuctionStatus.ACTIVE) {
      return auction;
    }

    auction.status = AuctionStatus.SOLD;
    auction.buyerId = buyerId;
    auction.soldAt = new Date();

    return this.auctionsRepository.save(auction);
  }
}
