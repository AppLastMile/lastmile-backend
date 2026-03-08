import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { DonationItem } from './entities/donation-item.entity';
import { DonationMoney } from './entities/donation-money.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DonationMoney, DonationItem, Campaign])],
  controllers: [DonationsController],
  providers: [DonationsService],
})
export class DonationsModule {}
