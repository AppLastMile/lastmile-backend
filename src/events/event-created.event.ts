export interface EventCreatedEvent {
  eventId: number;
  createdBy: number;
  city: string;
  disasterType: string;
  occurredAt: Date;
}
