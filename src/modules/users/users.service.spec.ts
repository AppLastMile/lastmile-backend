import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

const makeQb = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
  andWhere: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  ...overrides,
});

const makeRepo = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn((dto: any) => dto),
  save: jest.fn(async (u: any) => ({ id: 1, createdAt: new Date(), ...u })),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
  ...overrides,
});

const makeUser = (overrides = {}) => ({
  id: 1,
  name: 'Alice',
  email: 'alice@test.com',
  role: 'volunteer',
  createdAt: new Date(),
  ...overrides,
});

describe('UsersService', () => {
  describe('create', () => {
    it('creates and returns user when email is new', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new UsersService(repo as any);
      const result = await svc.create({
        name: 'Alice',
        email: 'Alice@Test.com',
        password: 'p',
        role: 'volunteer',
      } as any);
      expect(result.email).toBe('alice@test.com');
    });

    it('throws ConflictException when email already exists', async () => {
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(makeUser()),
      });
      const svc = new UsersService(repo as any);
      await expect(
        svc.create({
          name: 'Alice',
          email: 'alice@test.com',
          password: 'p',
          role: 'volunteer',
        } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns paginated list with defaults', async () => {
      const users = [makeUser()];
      const qb = makeQb({
        getManyAndCount: jest.fn().mockResolvedValue([users, 1]),
      });
      const repo = makeRepo({
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      });
      const svc = new UsersService(repo as any);
      const result = await svc.findAll({});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('applies role filter', async () => {
      const qb = makeQb({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      const repo = makeRepo({
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      });
      const svc = new UsersService(repo as any);
      await svc.findAll({ role: 'volunteer' } as any);
      expect(qb.andWhere).toHaveBeenCalledWith('user.role = :role', {
        role: 'volunteer',
      });
    });

    it('applies search filter', async () => {
      const qb = makeQb({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      const repo = makeRepo({
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      });
      const svc = new UsersService(repo as any);
      await svc.findAll({ search: 'alice' } as any);
      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('calculates totalPages correctly for zero results', async () => {
      const qb = makeQb({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      const repo = makeRepo({
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      });
      const svc = new UsersService(repo as any);
      const result = await svc.findAll({ page: 1, limit: 10 });
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findOneById', () => {
    it('returns user when found', async () => {
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue(makeUser()),
      });
      const svc = new UsersService(repo as any);
      const result = await svc.findOneById(1);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new UsersService(repo as any);
      await expect(svc.findOneById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates user without email change', async () => {
      const user = makeUser();
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(user) });
      const svc = new UsersService(repo as any);
      const result = await svc.update(1, { name: 'Bob' } as any);
      expect(repo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when user not found for update', async () => {
      const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
      const svc = new UsersService(repo as any);
      await expect(svc.update(999, { name: 'Bob' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when new email is taken by another user', async () => {
      const user = makeUser({ id: 1 });
      const other = makeUser({ id: 2, email: 'taken@test.com' });
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(other);
      const repo = makeRepo({ findOne });
      const svc = new UsersService(repo as any);
      await expect(
        svc.update(1, { email: 'taken@test.com' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('allows updating to the same email (same user)', async () => {
      const user = makeUser({ id: 1, email: 'alice@test.com' });
      const findOne = jest
        .fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(user);
      const repo = makeRepo({ findOne });
      const svc = new UsersService(repo as any);
      const result = await svc.update(1, { email: 'Alice@Test.com' } as any);
      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('removes user successfully', async () => {
      const repo = makeRepo({
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      });
      const svc = new UsersService(repo as any);
      await expect(svc.remove(1)).resolves.toBeUndefined();
    });

    it('throws NotFoundException when user not found', async () => {
      const repo = makeRepo({
        delete: jest.fn().mockResolvedValue({ affected: 0 }),
      });
      const svc = new UsersService(repo as any);
      await expect(svc.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
