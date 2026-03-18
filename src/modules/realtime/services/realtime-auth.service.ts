import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export type AuthUser = {
  userId: number;
  role: string;
};

@Injectable()
export class RealtimeAuthService {
  constructor(private readonly configService: ConfigService) {}

  verifyToken(rawToken: string): AuthUser {
    const secret =
      this.configService.get<string>('JWT_SECRET') ?? 'dev-jwt-secret';
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

    const payload = this.parsePayload(encodedPayload);

    const userId = Number(payload.sub ?? payload.userId ?? payload.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('Token does not include a valid user id');
    }

    const roleRaw = payload.role;
    const role = typeof roleRaw === 'string' ? roleRaw : 'donor';

    const exp = payload.exp;
    if (typeof exp === 'number') {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (exp <= nowInSeconds) {
        throw new UnauthorizedException('Token expired');
      }
    }

    return { userId, role };
  }

  private parsePayload(encodedPayload: string): Record<string, unknown> {
    try {
      const decoded = Buffer.from(
        this.base64UrlToBase64(encodedPayload),
        'base64',
      ).toString('utf8');
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException('Invalid token payload');
    }
  }

  private base64UrlToBase64(input: string): string {
    let output = input.replace(/-/g, '+').replace(/_/g, '/');
    while (output.length % 4 !== 0) {
      output += '=';
    }
    return output;
  }

  private base64UrlEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private constantTimeEqual(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);

    if (aBuffer.length !== bBuffer.length) {
      return false;
    }

    return timingSafeEqual(aBuffer, bBuffer);
  }
}
