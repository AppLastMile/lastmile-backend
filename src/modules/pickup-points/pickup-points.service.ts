import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PickupPoint } from './entities/pickup-point.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreatePickupPointDto } from './dto/create-pickup-point.dto';

@Injectable()
export class PickupPointsService {
  constructor(
    @InjectRepository(PickupPoint)
    private pickupRepo: Repository<PickupPoint>,

    @InjectRepository(Campaign)
    private campaignRepo: Repository<Campaign>,

    private eventEmitter: EventEmitter2,

    private dataSource: DataSource,
  ) {}

  async findByCampaign(campaignId: number) {
    return this.pickupRepo.find({
      where: {
        campaign: { id: campaignId },
      },
      relations: ['campaign'],
    });
  }

  async create(campaignId: number, dto: CreatePickupPointDto) {
    return await this.dataSource.transaction(async (manager) => {
      const campaign = await manager.findOne(Campaign, {
        where: { id: campaignId },
      });

      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }

      const point = manager.create(PickupPoint, {
        ...dto,
        campaign,
      });

      const savedPoint = await manager.save(point);

      this.eventEmitter.emit('pickup_point.created', savedPoint);

      return savedPoint;
    });
  }
}
