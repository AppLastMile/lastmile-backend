import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

const makeProduct = (overrides = {}) => ({
  id: 1, name: 'Laptop', description: 'A laptop', createdBy: 1, createdAt: new Date(), ...overrides,
});

const makeRepo = () => ({
  create: jest.fn((d: any) => d),
  save: jest.fn(async (p: any) => ({ ...makeProduct(), ...p })),
  findOne: jest.fn().mockResolvedValue(makeProduct()),
  find: jest.fn().mockResolvedValue([makeProduct()]),
});

describe('ProductsService', () => {
  describe('create', () => {
    it('creates product with description', async () => {
      const repo = makeRepo();
      const svc = new ProductsService(repo as any);
      const result = await svc.create({ name: 'Laptop', description: 'A laptop', createdBy: 1 });
      expect(result.name).toBe('Laptop');
    });

    it('creates product without description (defaults to null)', async () => {
      const repo = makeRepo();
      const svc = new ProductsService(repo as any);
      const result = await svc.create({ name: 'Item', createdBy: 1 } as any);
      expect(result).toBeDefined();
    });
  });

  describe('findById', () => {
    it('returns product when found', async () => {
      const repo = makeRepo();
      const svc = new ProductsService(repo as any);
      const result = await svc.findById(1);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      const repo = makeRepo();
      repo.findOne.mockResolvedValue(null);
      const svc = new ProductsService(repo as any);
      await expect(svc.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns all products', async () => {
      const repo = makeRepo();
      const svc = new ProductsService(repo as any);
      const result = await svc.findAll();
      expect(result).toHaveLength(1);
    });
  });
});
