import { NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';

const makeQb = (overrides: any = {}) => ({
  andWhere: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  ...overrides,
});

const makeEvent = (overrides = {}) => ({
  id: 1,
  name: 'Flood Relief',
  disasterType: 'flood',
  city: 'Bogota',
  description: 'desc',
  date: new Date('2025-01-01'),
  createdBy: 1,
  createdAt: new Date(),
  ...overrides,
});

const makeService = (overrides: any = {}) => {
  const qb = makeQb(overrides.qb);
  const repo = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (e: any) => ({ ...makeEvent(), ...e })),
    findOne: jest.fn().mockResolvedValue(makeEvent()),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    ...overrides.repo,
  };
  const eventEmitter = { emit: jest.fn() };
  return {
    svc: new EventsService(repo, eventEmitter as any),
    repo,
    eventEmitter,
    qb,
  };
};

describe('EventsService', () => {
  describe('create', () => {
    it('creates event and emits event.created', async () => {
      const { svc, eventEmitter } = makeService();
      const dto = {
        name: 'Flood',
        disasterType: 'flood',
        city: 'Bogota',
        description: 'desc',
        date: '2025-01-01',
        createdBy: 1,
      } as any;
      const result = await svc.create(dto);
      expect(result).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'event.created',
        expect.any(Object),
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated events with defaults', async () => {
      const { svc } = makeService({
        qb: {
          getManyAndCount: jest.fn().mockResolvedValue([[makeEvent()], 1]),
        },
      });
      const result = await svc.findAll({});
      expect(result.meta.total).toBe(1);
    });

    it('applies city filter', async () => {
      const { svc, qb } = makeService();
      await svc.findAll({ city: 'Bogota' } as any);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('city'),
        expect.any(Object),
      );
    });

    it('applies disasterType filter', async () => {
      const { svc, qb } = makeService();
      await svc.findAll({ disasterType: 'flood' } as any);
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('disasterType'),
        expect.any(Object),
      );
    });

    it('applies search filter', async () => {
      const { svc, qb } = makeService();
      await svc.findAll({ search: 'flood' } as any);
      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('calculates totalPages min 1', async () => {
      const { svc } = makeService();
      const result = await svc.findAll({});
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findOneById', () => {
    it('returns event when found', async () => {
      const { svc } = makeService();
      const result = await svc.findOneById(1);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      const { svc, repo } = makeService();
      repo.findOne.mockResolvedValue(null);
      await expect(svc.findOneById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates event fields', async () => {
      const { svc } = makeService();
      const result = await svc.update(1, {
        name: 'Updated',
        date: '2025-06-01',
      } as any);
      expect(result).toBeDefined();
    });

    it('keeps existing date when not provided', async () => {
      const { svc } = makeService();
      const result = await svc.update(1, { name: 'Updated' } as any);
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when not found', async () => {
      const { svc, repo } = makeService();
      repo.findOne.mockResolvedValue(null);
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

    it('throws NotFoundException when not found', async () => {
      const { svc, repo } = makeService();
      repo.delete.mockResolvedValue({ affected: 0 });
      await expect(svc.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
