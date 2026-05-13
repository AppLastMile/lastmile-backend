import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

const makeQb = (overrides: any = {}) => ({
  andWhere: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  ...overrides,
});

const makeNotification = (overrides = {}) => ({
  id: 1,
  userId: 1,
  message: 'test notification',
  auctionId: null,
  read: false,
  createdAt: new Date(),
  ...overrides,
});

const makeService = () => {
  const notifQb = makeQb();
  const notifRepo = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (n: any) => ({ ...makeNotification(), ...n })),
    findOne: jest.fn().mockResolvedValue(makeNotification()),
    createQueryBuilder: jest.fn().mockReturnValue(notifQb),
  };
  const bidsRepo = { find: jest.fn().mockResolvedValue([]) };
  const campaignsRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Camp' }),
  };
  const messagesRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 1, campaignId: 1, userId: 2 }),
  };
  const usersRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 2, name: 'Alice' }),
    find: jest.fn().mockResolvedValue([{ id: 3 }]),
  };
  const dataSource = {};
  const eventEmitter = { emit: jest.fn() };
  const svc = new NotificationsService(
    notifRepo as any,
    bidsRepo as any,
    campaignsRepo as any,
    messagesRepo as any,
    usersRepo as any,
    dataSource as any,
    eventEmitter as any,
  );
  return {
    svc,
    notifRepo,
    bidsRepo,
    campaignsRepo,
    messagesRepo,
    usersRepo,
    eventEmitter,
    notifQb,
  };
};

describe('NotificationsService', () => {
  describe('create', () => {
    it('creates notification and emits event', async () => {
      const { svc, eventEmitter } = makeService();
      const result = await svc.create(1, 'test', null);
      expect(result).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'notification.created',
        expect.any(Object),
      );
    });

    it('creates with auctionId', async () => {
      const { svc } = makeService();
      const result = await svc.create(1, 'auction won', 5);
      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('returns paginated notifications', async () => {
      const { svc } = makeService();
      const result = await svc.findAll({});
      expect(result.data).toEqual([]);
      expect(result.meta.totalPages).toBe(1);
    });

    it('applies userId filter', async () => {
      const { svc, notifQb } = makeService();
      await svc.findAll({ userId: 1 } as any);
      expect(notifQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('userId'),
        expect.any(Object),
      );
    });

    it('applies read filter', async () => {
      const { svc, notifQb } = makeService();
      await svc.findAll({ read: false } as any);
      expect(notifQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('read'),
        expect.any(Object),
      );
    });
  });

  describe('markAsRead', () => {
    it('marks notification as read', async () => {
      const { svc, notifRepo } = makeService();
      notifRepo.save.mockResolvedValue({ ...makeNotification(), read: true });
      const result = await svc.markAsRead(1);
      expect(notifRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when not found', async () => {
      const { svc, notifRepo } = makeService();
      notifRepo.findOne.mockResolvedValue(null);
      await expect(svc.markAsRead(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('onAuctionClosed', () => {
    it('creates winner notification', async () => {
      const { svc, eventEmitter } = makeService();
      await svc.onAuctionClosed({
        auctionId: 1,
        winnerId: 2,
        itemName: 'Laptop',
        winningAmount: 500,
        currency: 'USD',
        closedAt: new Date(),
      });
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('does nothing when no winner', async () => {
      const { svc, eventEmitter } = makeService();
      await svc.onAuctionClosed({
        auctionId: 1,
        winnerId: null,
        itemName: 'Laptop',
        winningAmount: 0,
        currency: 'USD',
        closedAt: new Date(),
      });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('onMessageSent', () => {
    it('sends notification to other users', async () => {
      const { svc, eventEmitter } = makeService();
      await svc.onMessageSent({ messageId: 1, campaignId: 1, userId: 2 });
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('does nothing when message not found', async () => {
      const { svc, messagesRepo, eventEmitter } = makeService();
      messagesRepo.findOne.mockResolvedValue(null);
      await svc.onMessageSent({ messageId: 99, campaignId: 1, userId: 2 });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('does nothing when campaign not found', async () => {
      const { svc, campaignsRepo, eventEmitter } = makeService();
      campaignsRepo.findOne.mockResolvedValue(null);
      await svc.onMessageSent({ messageId: 1, campaignId: 99, userId: 2 });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('uses default name when sender has no name', async () => {
      const { svc, usersRepo } = makeService();
      usersRepo.findOne.mockResolvedValue({ id: 2, name: '   ' });
      await svc.onMessageSent({ messageId: 1, campaignId: 1, userId: 2 });
    });
  });

  describe('onAuctionSold', () => {
    it('notifies buyer and losing bidders', async () => {
      const { svc, bidsRepo, eventEmitter } = makeService();
      bidsRepo.find.mockResolvedValue([
        { userId: 3, auctionId: 1 },
        { userId: 4, auctionId: 1 },
      ]);
      await svc.onAuctionSold({
        auctionId: 1,
        buyerId: 3,
        price: 100,
        currency: 'USD',
        soldAt: new Date(),
        itemName: 'Laptop',
      } as any);
      expect(eventEmitter.emit).toHaveBeenCalled();
    });
  });
});
