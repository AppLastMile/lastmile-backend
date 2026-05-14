import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

const makeQb = (result: unknown) => ({
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(result),
});

describe('AuthService', () => {
  const mockTokenService = { generate: jest.fn().mockReturnValue('tok') };

  const makeService = (qbResult: unknown) => {
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(qbResult)),
    };
    return new AuthService(repo as any, mockTokenService as any);
  };

  beforeEach(() => jest.clearAllMocks());

  it('returns accessToken and user on valid credentials', async () => {
    const user = {
      id: 1,
      email: 'a@b.com',
      role: 'volunteer',
      password: 'pass',
    };
    const svc = makeService(user);
    const result = await svc.login({ email: 'a@b.com', password: 'pass' });
    expect(result.accessToken).toBe('tok');
    expect(result.user.id).toBe(1);
    expect(result.user.email).toBe('a@b.com');
    expect(result.user.role).toBe('volunteer');
  });

  it('throws UnauthorizedException when user not found', async () => {
    const svc = makeService(null);
    await expect(
      svc.login({ email: 'x@x.com', password: 'p' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when password does not match', async () => {
    const user = {
      id: 1,
      email: 'a@b.com',
      role: 'donor',
      password: 'correct',
    };
    const svc = makeService(user);
    await expect(
      svc.login({ email: 'a@b.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
