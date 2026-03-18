import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageSentEvent } from '../../events/message-sent.event';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { User } from '../users/entities/user.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { Message } from './entities/message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(Campaign)
    private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createMessage(dto: CreateMessageDto): Promise<Message> {
    await this.ensureCampaignExists(dto.campaignId);
    await this.ensureUserExists(dto.userId);

    const created = await this.messagesRepository.save(
      this.messagesRepository.create(dto),
    );

    const payload: MessageSentEvent = {
      messageId: created.id,
      campaignId: created.campaignId,
      userId: created.userId,
    };
    this.eventEmitter.emit('message.sent', payload);

    return created;
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

  private async ensureUserExists(userId: number): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} was not found`);
    }
  }
}
