import { NotFoundException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';

const makeQb = (overrides: any = {}) => ({
  andWhere: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue([]),
  getOne: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  setParameters: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({}),
  ...overrides,
});

const makeCampaign = (overrides = {}) => ({
  id: 1,
  name: 'Camp',
  description: 'desc',
  campaignType: 'money',
  goalMoney: 100,
  collectedMoney: 0,
  eventId: 1,
  createdBy: 1,
  createdAt: new Date(),
  ...overrides,
});

describe('CampaignsService', () => {
  const makeService = (overrides: any = {}) => {
    const campaignsQb = makeQb(overrides.campaignsQb);
    const campaignsRepo = {
      create: jest.fn((d: any) => d),
      save: jest.fn(async (c: any) => ({ ...makeCampaign(), ...c })),
      findOne: jest.fn().mockResolvedValue(makeCampaign()),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(campaignsQb),
    };
    const eventsRepo = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
    const donationItemsRepo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(makeQb(overrides.donationQb)),
    };
    const eventEmitter = { emit: jest.fn() };
    const svc = new CampaignsService(
      campaignsRepo as any,
      eventsRepo as any,
      donationItemsRepo as any,
      eventEmitter as any,
    );
    return { svc, campaignsRepo, eventsRepo, eventEmitter };
  };

  describe('create', () => {
    it('creates campaign and emits event', async () => {
      const { svc, eventEmitter } = makeService();
      const dto = {
        name: 'Camp',
        description: 'desc',
        campaignType: 'money',
        goalMoney: 100,
        eventId: 1,
        createdBy: 1,
      } as any;
      const result = await svc.create(dto);
      expect(result.name).toBe('Camp');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'campaign.created',
        expect.any(Object),
      );
    });

    it('throws NotFoundException when event does not exist', async () => {
      const { svc, eventsRepo } = makeService();
      eventsRepo.findOne.mockResolvedValue(null);
      await expect(svc.create({ eventId: 99 } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated list', async () => {
      const campaigns = [makeCampaign()];
      const qb = makeQb({
        getManyAndCount: jest.fn().mockResolvedValue([campaigns, 1]),
      });
      const { svc } = makeService({
        campaignsQb: {
          getManyAndCount: jest.fn().mockResolvedValue([campaigns, 1]),
        },
      });
      void qb;
      const result = await svc.findAll({});
      expect(result.meta).toBeDefined();
    });

    it('applies eventId, createdBy, campaignType, and search filters', async () => {
      const qb = makeQb();
      const campaignsRepo = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        delete: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      };
      const svc = new CampaignsService(
        campaignsRepo as any,
        { findOne: jest.fn() } as any,
        { createQueryBuilder: jest.fn().mockReturnValue(makeQb()) } as any,
        { emit: jest.fn() } as any,
      );
      await svc.findAll({
        eventId: 1,
        createdBy: 1,
        campaignType: 'money' as any,
        search: 'test',
        page: 2,
        limit: 5,
      });
      expect(qb.andWhere).toHaveBeenCalledTimes(4);
    });

    it('calculates totalPages min 1 for zero results', async () => {
      const { svc } = makeService();
      const result = await svc.findAll({});
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findOneById', () => {
    it('returns campaign when found', async () => {
      const { svc } = makeService();
      const result = await svc.findOneById(1);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      const { svc, campaignsRepo } = makeService();
      campaignsRepo.findOne.mockResolvedValue(null);
      await expect(svc.findOneById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getItemsSummary', () => {
    it('returns summary with items and updatedAt', async () => {
      const donationQb = makeQb({
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ itemType: 'water', quantity: '10' }]),
        getOne: jest.fn().mockResolvedValue({ createdAt: new Date() }),
      });
      const donationItemsRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(donationQb),
      };
      const svc = new CampaignsService(
        {
          create: jest.fn(),
          save: jest.fn(),
          findOne: jest.fn().mockResolvedValue({ id: 1 }),
          delete: jest.fn(),
          createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
        } as any,
        { findOne: jest.fn() } as any,
        donationItemsRepo as any,
        { emit: jest.fn() } as any,
      );
      const result = await svc.getItemsSummary(1);
      expect(result.items[0].itemType).toBe('water');
      expect(result.items[0].quantity).toBe(10);
    });

    it('uses current date when no donations exist', async () => {
      const donationQb = makeQb({
        getRawMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
      });
      const svc = new CampaignsService(
        {
          create: jest.fn(),
          save: jest.fn(),
          findOne: jest.fn().mockResolvedValue({ id: 1 }),
          delete: jest.fn(),
          createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
        } as any,
        { findOne: jest.fn() } as any,
        { createQueryBuilder: jest.fn().mockReturnValue(donationQb) } as any,
        { emit: jest.fn() } as any,
      );
      const result = await svc.getItemsSummary(1);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('throws when campaign not found', async () => {
      const { svc, campaignsRepo } = makeService();
      campaignsRepo.findOne.mockResolvedValue(null);
      await expect(svc.getItemsSummary(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates campaign without eventId change', async () => {
      const { svc } = makeService();
      const result = await svc.update(1, { name: 'New' } as any);
      expect(result).toBeDefined();
    });

    it('validates new eventId', async () => {
      const { svc, eventsRepo } = makeService();
      eventsRepo.findOne.mockResolvedValue(null);
      await expect(svc.update(1, { eventId: 99 } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when campaign not found', async () => {
      const { svc, campaignsRepo } = makeService();
      campaignsRepo.findOne.mockResolvedValue(null);
      await expect(svc.update(999, {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('removes successfully', async () => {
      const { svc } = makeService();
      await expect(svc.remove(1)).resolves.toBeUndefined();
    });

    it('throws when not found', async () => {
      const { svc, campaignsRepo } = makeService();
      campaignsRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(svc.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleDonationCreated', () => {
    it('updates collectedMoney when donation created', async () => {
      const qb = makeQb();
      const campaignsRepo = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        delete: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      };
      const svc = new CampaignsService(
        campaignsRepo as any,
        { findOne: jest.fn() } as any,
        { createQueryBuilder: jest.fn().mockReturnValue(makeQb()) } as any,
        { emit: jest.fn() } as any,
      );
      await svc.handleDonationCreated({
        campaignId: 1,
        donorId: 1,
        amount: 50,
      });
      expect(qb.execute).toHaveBeenCalled();
    });
  });
});
