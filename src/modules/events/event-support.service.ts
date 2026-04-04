import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class EventSupportService {
  private readonly eventSupporters = new Map<number, Set<number>>();
  private readonly userEvents = new Map<number, Set<number>>();

  joinEvent(eventId: number, userId: number): void {
    const supporters = this.getOrCreate(this.eventSupporters, eventId);
    if (supporters.has(userId)) {
      throw new ConflictException({
        success: false,
        message: 'Ya estás apoyando este evento.',
        code: 'EVENT_ALREADY_SUPPORTED',
      });
    }

    supporters.add(userId);
    this.getOrCreate(this.userEvents, userId).add(eventId);
  }

  leaveEvent(eventId: number, userId: number): void {
    const supporters = this.eventSupporters.get(eventId);
    if (!supporters || !supporters.has(userId)) {
      throw new NotFoundException({
        success: false,
        message: 'No estabas apoyando este evento.',
        code: 'EVENT_SUPPORT_NOT_FOUND',
      });
    }

    supporters.delete(userId);
    if (!supporters.size) {
      this.eventSupporters.delete(eventId);
    }

    const events = this.userEvents.get(userId);
    if (events) {
      events.delete(eventId);
      if (!events.size) {
        this.userEvents.delete(userId);
      }
    }
  }

  getUserEventIds(userId: number): number[] {
    const events = this.userEvents.get(userId);
    if (!events) return [];
    return Array.from(events.values());
  }

  getSupportersCount(eventId: number): number {
    return this.eventSupporters.get(eventId)?.size ?? 0;
  }

  private getOrCreate(
    store: Map<number, Set<number>>,
    key: number,
  ): Set<number> {
    const existing = store.get(key);
    if (existing) return existing;

    const created = new Set<number>();
    store.set(key, created);
    return created;
  }
}
