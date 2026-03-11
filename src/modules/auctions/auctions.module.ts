import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { DonationMoney } from '../donations/entities/donation-money.entity';
import { AuctionBuyIdempotencyRecord } from './entities/auction-buy-idempotency-record.entity';
import { Auction } from './entities/auction.entity';
import { AuctionsController } from './auctions.controller';
import { AuctionsService } from './auctions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Auction,
      AuctionBuyIdempotencyRecord,
      Campaign,
      DonationMoney,
    ]),
  ],
  controllers: [AuctionsController],
  providers: [AuctionsService],
})
export class AuctionsModule {}
