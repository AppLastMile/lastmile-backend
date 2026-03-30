import { AuctionStatus } from '../entities/auction.entity';

export class AuctionResponseDto {
  id!: number;
  productId!: number;
  campaignId!: number | null;
  sellerId!: number;
  itemName!: string;
  description!: string | null;
  initialPrice!: number;
  currentPrice!: number | null;
  currency!: string;
  durationMinutes!: number;
  status!: AuctionStatus;
  buyerId!: number | null;
  winnerId!: number | null;
  startedAt!: Date | null;
  endAt!: Date | null;
  createdAt!: Date;
  soldAt!: Date | null;
  version!: number;
}

export class PaginatedAuctionsDto {
  data!: AuctionResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class BuyAuctionResponseDto {
  id!: number;
  productId!: number;
  campaignId!: number | null;
  status!: AuctionStatus;
  buyerId!: number;
  soldAt!: Date;
  price!: number;
  currency!: string;
}
