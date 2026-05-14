import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RealtimeAuthService } from './realtime-auth.service';
import { TokenService } from '../../auth/services/token.service';

const makeService = (secret = 'test-secret') => {
  const configService = {
    get: jest.fn().mockReturnValue(secret),
  } as unknown as ConfigService;
  return new RealtimeAuthService(configService);
};

const makeValidToken = (payload: object, secret = 'test-secret') => {
  const tokenService = new TokenService({
    get: jest.fn().mockReturnValue(secret),
  } as unknown as ConfigService);
  return tokenService.generate(payload as any);
};

describe('RealtimeAuthService', () => {
  describe('verifyToken', () => {
    it('returns userId and role for a valid token', () => {
      const token = makeValidToken({ userId: 5, role: 'volunteer' });
      const svc = makeService();
      const result = svc.verifyToken(token);
      expect(result.userId).toBe(5);
      expect(result.role).toBe('volunteer');
    });

    it('throws on malformed token (missing parts)', () => {
      const svc = makeService();
      expect(() => svc.verifyToken('abc.def')).toThrow(UnauthorizedException);
    });

    it('throws on invalid signature', () => {
      const token = makeValidToken({ userId: 1, role: 'donor' }, 'secret-a');
      const svc = makeService('secret-b');
      expect(() => svc.verifyToken(token)).toThrow(UnauthorizedException);
    });

    it('throws on expired token', () => {
      const secret = 'test-secret';
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const body = Buffer.from(
        JSON.stringify({
          sub: 1,
          role: 'donor',
          exp: Math.floor(Date.now() / 1000) - 100,
        }),
      )
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const sig = createHmac('sha256', secret)
        .update(`${header}.${body}`)
        .digest()
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const svc = makeService(secret);
      expect(() => svc.verifyToken(`${header}.${body}.${sig}`)).toThrow(
        UnauthorizedException,
      );
    });

    it('throws when userId is invalid', () => {
      const secret = 'test-secret';
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const body = Buffer.from(
        JSON.stringify({ sub: 'not-an-int', role: 'donor' }),
      )
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const sig = createHmac('sha256', secret)
        .update(`${header}.${body}`)
        .digest()
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const svc = makeService(secret);
      expect(() => svc.verifyToken(`${header}.${body}.${sig}`)).toThrow(
        UnauthorizedException,
      );
    });

    it('throws on invalid payload base64', () => {
      const secret = 'test-secret';
      const header = 'eyJhbGciOiJIUzI1NiJ9';
      const badBody = '!!!not-valid-base64!!!';
      const sig = createHmac('sha256', secret)
        .update(`${header}.${badBody}`)
        .digest()
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const svc = makeService(secret);
      expect(() => svc.verifyToken(`${header}.${badBody}.${sig}`)).toThrow(
        UnauthorizedException,
      );
    });

    it('defaults role to donor when role is not a string', () => {
      const secret = 'test-secret';
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const body = Buffer.from(JSON.stringify({ sub: 3, role: 999 }))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const sig = createHmac('sha256', secret)
        .update(`${header}.${body}`)
        .digest()
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const svc = makeService(secret);
      const result = svc.verifyToken(`${header}.${body}.${sig}`);
      expect(result.role).toBe('donor');
    });

    it('uses fallback secret when config returns undefined', () => {
      const configService = {
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as ConfigService;
      const svc = new RealtimeAuthService(configService);
      const tokenSvc = new TokenService({
        get: jest.fn().mockReturnValue('dev-jwt-secret'),
      } as unknown as ConfigService);
      const token = tokenSvc.generate({ userId: 1, role: 'donor' });
      const result = svc.verifyToken(token);
      expect(result.userId).toBe(1);
    });

    it('trims whitespace from token', () => {
      const token = makeValidToken({ userId: 2, role: 'organizer' });
      const svc = makeService();
      const result = svc.verifyToken(`  ${token}  `);
      expect(result.userId).toBe(2);
    });
  });
});
