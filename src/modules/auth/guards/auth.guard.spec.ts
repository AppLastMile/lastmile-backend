import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

const makeContext = (authHeader?: string) => ({
  switchToHttp: () => ({
    getRequest: () => ({ headers: { authorization: authHeader } }),
  }),
});

describe('AuthGuard', () => {
  const mockToken = { verify: jest.fn() };
  const guard = new AuthGuard(mockToken as any);

  beforeEach(() => jest.clearAllMocks());

  it('returns true and sets request.user when token is valid', () => {
    mockToken.verify.mockReturnValue({ userId: 1, role: 'volunteer' });
    const req: any = { headers: { authorization: 'Bearer mytoken' } };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as any;
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.user).toEqual({ userId: 1, role: 'volunteer' });
    expect(mockToken.verify).toHaveBeenCalledWith('mytoken');
  });

  it('throws UnauthorizedException when no Authorization header', () => {
    expect(() => guard.canActivate(makeContext(undefined) as any)).toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when header does not start with Bearer', () => {
    expect(() => guard.canActivate(makeContext('Basic abc') as any)).toThrow(
      UnauthorizedException,
    );
  });

  it('propagates error from tokenService.verify', () => {
    mockToken.verify.mockImplementation(() => {
      throw new UnauthorizedException('Invalid');
    });
    expect(() => guard.canActivate(makeContext('Bearer bad') as any)).toThrow(
      UnauthorizedException,
    );
  });

  it('is case-insensitive for Bearer prefix', () => {
    mockToken.verify.mockReturnValue({ userId: 2, role: 'donor' });
    const req: any = { headers: { authorization: 'BEARER tok' } };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as any;
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
