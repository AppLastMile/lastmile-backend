export interface NotificationCreatedEvent {
  notificationId: number;
  userId: number;
  message: string;
  auctionId: number | null;
  createdAt: Date;
}
