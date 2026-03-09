import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DonationItem } from '../donations/entities/donation-item.entity';
import { Event } from '../events/entities/event.entity';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { Campaign } from './entities/campaign.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, Event, DonationItem])],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
