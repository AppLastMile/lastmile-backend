import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { Event } from '../../events/entities/event.entity';
import { Shipment } from '../../logistics/entities/shipment.entity';
import { UserRole } from '../../users/entities/user.entity';
import { AuthUser } from './realtime-auth.service';

@Injectable()
export class RoomAuthorizationService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(Shipment)
    private readonly shipmentsRepository: Repository<Shipment>,
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
  ) {}

  async validateAndNormalizeRoom(
    room: string,
    user: AuthUser,
  ): Promise<string> {
    if (room === 'volunteers:locations' || room === 'volunteers:tracking') {
      if (user.role !== UserRole.ORGANIZER) {
        throw new ForbiddenException(
          'Only organizers are allowed to subscribe to volunteers tracking',
        );
      }
      return room;
    }

    const campaignChat = room.match(/^campaign:(\d+):chat$/);
    if (campaignChat) {
      await this.ensureCampaignVisible(Number(campaignChat[1]), user);
      return room;
    }

    const campaignAuctions = room.match(/^campaign:(\d+):auctions$/);
    if (campaignAuctions) {
      await this.ensureCampaignVisible(Number(campaignAuctions[1]), user);
      return room;
    }

    const campaignInventory = room.match(/^campaign:(\d+):inventory$/);
    if (campaignInventory) {
      await this.ensureCampaignVisible(Number(campaignInventory[1]), user);
      return room;
    }

    const campaignVolunteers = room.match(
      /^campaign:(\d+):volunteers:tracking$/,
    );
    if (campaignVolunteers) {
      await this.ensureCampaignVisible(Number(campaignVolunteers[1]), user);
      if (user.role !== UserRole.ORGANIZER) {
        throw new ForbiddenException(
          'Only organizers are allowed to subscribe to volunteers tracking',
        );
      }
      return room;
    }

    const auctionBids = room.match(/^auction:(\d+):bids$/);
    if (auctionBids) {
      // Public room: any connected user can subscribe to auction bid updates
      void user;
      return room;
    }

    const shipmentTracking = room.match(/^shipment:(\d+):tracking$/);
    if (shipmentTracking) {
      await this.ensureShipmentAllowed(Number(shipmentTracking[1]), user);
      return room;
    }

    const eventOps = room.match(/^event:(\d+):ops$/);
    if (eventOps) {
      await this.ensureEventOpsAllowed(Number(eventOps[1]), user);
      return room;
    }

    throw new ForbiddenException('Room format is invalid or unsupported');
  }

  private async ensureCampaignVisible(
    campaignId: number,
    user: AuthUser,
  ): Promise<void> {
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      select: { id: true },
    });

    if (!campaign) {
      throw new ForbiddenException('Campaign room does not exist');
    }

    // Current policy: any connected user can access campaign public rooms.
    // In production, replace this with strict membership checks.
    void user;
  }

  private async ensureShipmentAllowed(
    shipmentId: number,
    user: AuthUser,
  ): Promise<void> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id: shipmentId },
      select: { id: true, assignedVolunteerId: true },
    });

    if (!shipment) {
      throw new ForbiddenException('Shipment room does not exist');
    }

    if (user.role === UserRole.ORGANIZER) {
      return;
    }

    if (
      user.role === UserRole.VOLUNTEER &&
      shipment.assignedVolunteerId === user.userId
    ) {
      return;
    }

    throw new ForbiddenException(
      'You are not allowed to subscribe to this shipment',
    );
  }

  private async ensureEventOpsAllowed(
    eventId: number,
    user: AuthUser,
  ): Promise<void> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      select: { id: true, createdBy: true },
    });

    if (!event) {
      throw new ForbiddenException('Event ops room does not exist');
    }

    if (user.role === UserRole.ORGANIZER && event.createdBy === user.userId) {
      return;
    }

    throw new ForbiddenException(
      'You are not allowed to subscribe to this event ops room',
    );
  }
}
