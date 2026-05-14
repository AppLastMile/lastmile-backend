import { NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';

const makeMessage = (overrides = {}) => ({
  id: 1,
  campaignId: 1,
  userId: 2,
  message: 'Hello',
  createdAt: new Date(),
  ...overrides,
});

const makeService = () => {
  const msgRepo = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (m: any) => ({ ...makeMessage(), ...m })),
  };
  const campaignRepo = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
  const userRepo = { findOne: jest.fn().mockResolvedValue({ id: 2 }) };
  const eventEmitter = { emit: jest.fn() };
  const svc = new ChatService(
    msgRepo as any,
    campaignRepo as any,
    userRepo as any,
    eventEmitter as any,
  );
  return { svc, msgRepo, campaignRepo, userRepo, eventEmitter };
};

describe('ChatService', () => {
  describe('createMessage', () => {
    it('creates message and emits message.sent event', async () => {
      const { svc, eventEmitter } = makeService();
      const result = await svc.createMessage({
        campaignId: 1,
        userId: 2,
        message: 'Hello',
      });
      expect(result).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'message.sent',
        expect.objectContaining({ campaignId: 1, userId: 2 }),
      );
    });

    it('throws NotFoundException when campaign not found', async () => {
      const { svc, campaignRepo } = makeService();
      campaignRepo.findOne.mockResolvedValue(null);
      await expect(
        svc.createMessage({ campaignId: 99, userId: 2, message: 'Hi' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when user not found', async () => {
      const { svc, userRepo } = makeService();
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        svc.createMessage({ campaignId: 1, userId: 99, message: 'Hi' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
