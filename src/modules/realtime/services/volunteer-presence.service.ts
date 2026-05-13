import { Injectable } from '@nestjs/common';

export type PresenceRole = string;

export type DisconnectedPresence = {
  userId: number;
  role: PresenceRole;
  stillConnected: boolean;
};

@Injectable()
export class VolunteerPresenceService {
  private readonly socketsByUserId = new Map<number, Set<string>>();
  private readonly userBySocketId = new Map<
    string,
    { userId: number; role: PresenceRole }
  >();

  registerConnection(
    socketId: string,
    userId: number,
    role: PresenceRole,
  ): void {
    this.userBySocketId.set(socketId, { userId, role });

    const sockets = this.socketsByUserId.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    this.socketsByUserId.set(userId, sockets);
  }

  unregisterConnection(socketId: string): DisconnectedPresence | null {
    const linkedUser = this.userBySocketId.get(socketId);
    if (!linkedUser) {
      return null;
    }

    this.userBySocketId.delete(socketId);

    const sockets = this.socketsByUserId.get(linkedUser.userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.socketsByUserId.delete(linkedUser.userId);
      }
    }

    return {
      userId: linkedUser.userId,
      role: linkedUser.role,
      stillConnected: this.socketsByUserId.has(linkedUser.userId),
    };
  }

  isConnected(userId: number): boolean {
    return this.socketsByUserId.has(userId);
  }

  getLinkedUser(
    socketId: string,
  ): { userId: number; role: PresenceRole } | null {
    return this.userBySocketId.get(socketId) ?? null;
  }
}
