import { NotFoundException } from '@nestjs/common';
import { DonationsService } from './donations.service';
import { DonationItemStatus } from './entities/donation-item.entity';

const makeQb = (overrides: any = {}) => ({
  andWhere: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  ...overrides,
});

const makeDonationMoney = (overrides = {}) => ({
  id: 1,
  campaignId: 1,
  donorId: 2,
  amount: 100,
  createdAt: new Date(),
  ...overrides,
});

const makeDonationItem = (overrides = {}) => ({
  id: 1,
  campaignId: 1,
  donorId: 2,
  itemName: 'water',
  quantity: 10,
  status: DonationItemStatus.PENDING,
  notes: null,
  createdAt: new Date(),
  ...overrides,
});

describe('DonationsService', () => {
  const makeService = () => {
    const moneyQb = makeQb();
    const itemQb = makeQb();
    const moneyRepo = {
      create: jest.fn((d: any) => d),
      save: jest.fn(async (d: any) => ({ ...makeDonationMoney(), ...d })),
      findOne: jest.fn().mockResolvedValue(makeDonationMoney()),
      createQueryBuilder: jest.fn().mockReturnValue(moneyQb),
    };
    const itemRepo = {
      create: jest.fn((d: any) => d),
      save: jest.fn(async (d: any) => ({ ...makeDonationItem(), ...d })),
      findOne: jest.fn().mockResolvedValue(makeDonationItem()),
      createQueryBuilder: jest.fn().mockReturnValue(itemQb),
    };
    const campaignRepo = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
    const eventEmitter = { emit: jest.fn() };
    const svc = new DonationsService(
      moneyRepo as any,
      itemRepo as any,
      campaignRepo as any,
      eventEmitter as any,
    );
    return {
      svc,
      moneyRepo,
      itemRepo,
      campaignRepo,
      eventEmitter,
      moneyQb,
      itemQb,
    };
  };

  describe('createMoneyDonation', () => {
    it('creates money donation and emits event', async () => {
      const { svc, eventEmitter } = makeService();
      const result = await svc.createMoneyDonation({
        campaignId: 1,
        donorId: 2,
        amount: 100,
      });
      expect(result.amount).toBe(100);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'donation.created',
        expect.any(Object),
      );
    });

    it('throws when campaign not found', async () => {
      const { svc, campaignRepo } = makeService();
      campaignRepo.findOne.mockResolvedValue(null);
      await expect(
        svc.createMoneyDonation({ campaignId: 99, donorId: 1, amount: 10 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMoneyDonations', () => {
    it('returns paginated list', async () => {
      const { svc } = makeService();
      const result = await svc.findMoneyDonations({});
      expect(result.data).toEqual([]);
    });

    it('applies campaignId filter', async () => {
      const { svc, moneyQb } = makeService();
      await svc.findMoneyDonations({ campaignId: 1 } as any);
      expect(moneyQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('campaignId'),
        expect.any(Object),
      );
    });

    it('applies donorId filter', async () => {
      const { svc, moneyQb } = makeService();
      await svc.findMoneyDonations({ donorId: 1 } as any);
      expect(moneyQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('donorId'),
        expect.any(Object),
      );
    });
  });

  describe('findMoneyDonationById', () => {
    it('returns donation when found', async () => {
      const { svc } = makeService();
      const result = await svc.findMoneyDonationById(1);
      expect(result.id).toBe(1);
    });

    it('throws when not found', async () => {
      const { svc, moneyRepo } = makeService();
      moneyRepo.findOne.mockResolvedValue(null);
      await expect(svc.findMoneyDonationById(99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createItemDonation', () => {
    it('creates item donation using itemName', async () => {
      const { svc, eventEmitter } = makeService();
      const result = await svc.createItemDonation({
        campaignId: 1,
        donorId: 2,
        itemName: 'water',
        quantity: 5,
      } as any);
      expect(result.itemName).toBe('water');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'campaign.inventory.updated',
        expect.any(Object),
      );
    });

    it('creates item donation using itemType', async () => {
      const { svc } = makeService();
      const result = await svc.createItemDonation({
        campaignId: 1,
        donorId: 2,
        itemType: 'food',
        quantity: 3,
        notes: 'note',
      } as any);
      expect(result).toBeDefined();
    });

    it('throws when neither itemType nor itemName provided', async () => {
      const { svc } = makeService();
      await expect(
        svc.createItemDonation({
          campaignId: 1,
          donorId: 2,
          quantity: 1,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when campaign not found', async () => {
      const { svc, campaignRepo } = makeService();
      campaignRepo.findOne.mockResolvedValue(null);
      await expect(
        svc.createItemDonation({
          campaignId: 99,
          donorId: 1,
          itemName: 'water',
          quantity: 1,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findItemDonations', () => {
    it('returns paginated list', async () => {
      const { svc } = makeService();
      const result = await svc.findItemDonations({});
      expect(result.data).toEqual([]);
    });

    it('applies all filters', async () => {
      const { svc, itemQb } = makeService();
      await svc.findItemDonations({
        campaignId: 1,
        donorId: 1,
        status: DonationItemStatus.PENDING,
        itemType: 'water',
      } as any);
      expect(itemQb.andWhere).toHaveBeenCalledTimes(4);
    });

    it('applies itemName filter when itemType not provided', async () => {
      const { svc, itemQb } = makeService();
      await svc.findItemDonations({ itemName: 'food' } as any);
      expect(itemQb.andWhere).toHaveBeenCalled();
    });
  });

  describe('findItemDonationById', () => {
    it('returns item donation when found', async () => {
      const { svc } = makeService();
      const result = await svc.findItemDonationById(1);
      expect(result.id).toBe(1);
    });

    it('throws when not found', async () => {
      const { svc, itemRepo } = makeService();
      itemRepo.findOne.mockResolvedValue(null);
      await expect(svc.findItemDonationById(99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateItemDonationStatus', () => {
    it('updates status', async () => {
      const { svc } = makeService();
      const result = await svc.updateItemDonationStatus(1, {
        status: DonationItemStatus.DELIVERED_TO_PICKUP_POINT,
      });
      expect(result).toBeDefined();
    });

    it('emits donation.item.received when status is DELIVERED_TO_PICKUP_POINT', async () => {
      const { svc, eventEmitter } = makeService();
      await svc.updateItemDonationStatus(1, {
        status: DonationItemStatus.DELIVERED_TO_PICKUP_POINT,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'donation.item.received',
        expect.any(Object),
      );
    });

    it('does not emit event for other statuses', async () => {
      const { svc, eventEmitter } = makeService();
      await svc.updateItemDonationStatus(1, {
        status: DonationItemStatus.ASSIGNED_TO_SHIPMENT,
      });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('throws when item not found', async () => {
      const { svc, itemRepo } = makeService();
      itemRepo.findOne.mockResolvedValue(null);
      await expect(
        svc.updateItemDonationStatus(99, {
          status: DonationItemStatus.PENDING,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
