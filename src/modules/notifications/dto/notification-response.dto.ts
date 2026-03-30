export class NotificationResponseDto {
  id!: number;
  userId!: number;
  message!: string;
  auctionId!: number | null;
  read!: boolean;
  createdAt!: Date;
}

export class PaginatedNotificationsDto {
  data!: NotificationResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
