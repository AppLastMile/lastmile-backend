import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export type TokenPayload = {
  userId: number;
  role: string;
};

@Injectable()
export class TokenService {
  constructor(private readonly configService: ConfigService) {}

  generate(payload: TokenPayload): string {
    const secret = this.getSecret();

    const header = this.base64UrlEncode(
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    );

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24 hours
    const body = this.base64UrlEncode(
      Buffer.from(
        JSON.stringify({ sub: payload.userId, role: payload.role, exp }),
      ),
    );

    const signature = this.base64UrlEncode(
      createHmac('sha256', secret).update(`${header}.${body}`).digest(),
    );

    return `${header}.${body}.${signature}`;
  }

  verify(rawToken: string): TokenPayload {
    const secret = this.getSecret();
    const token = rawToken.trim();
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');

    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException('Invalid token format');
    }

    const expectedSignature = this.base64UrlEncode(
      createHmac('sha256', secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest(),
    );

    if (!this.constantTimeEqual(expectedSignature, encodedSignature)) {
      throw new UnauthorizedException('Invalid token signature');
    }

    const parsed = this.parsePayload(encodedPayload);

    const userId = Number(parsed.sub ?? parsed.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('Token does not include a valid user id');
    }

    const role = typeof parsed.role === 'string' ? parsed.role : 'donor';

    const exp = parsed.exp;
    if (typeof exp === 'number' && exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token expired');
    }

    return { userId, role };
  }

  private getSecret(): string {
    return this.configService.get<string>('JWT_SECRET') ?? 'dev-jwt-secret';
  }

  private parsePayload(encoded: string): Record<string, unknown> {
    try {
      const decoded = Buffer.from(
        this.base64UrlToBase64(encoded),
        'base64',
      ).toString('utf8');
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException('Invalid token payload');
    }
  }

  private base64UrlEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private base64UrlToBase64(input: string): string {
    let output = input.replace(/-/g, '+').replace(/_/g, '/');
    while (output.length % 4 !== 0) output += '=';
    return output;
  }

  private constantTimeEqual(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    if (aBuffer.length !== bBuffer.length) return false;
    return timingSafeEqual(aBuffer, bBuffer);
  }
}
