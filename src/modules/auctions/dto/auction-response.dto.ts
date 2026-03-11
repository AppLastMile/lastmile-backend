import { AuctionStatus } from '../entities/auction.entity';

export class AuctionResponseDto {
  id!: number;
  campaignId!: number;
  sellerId!: number;
  itemName!: string;
  description!: string | null;
  price!: number;
  currency!: string;
  status!: AuctionStatus;
  buyerId!: number | null;
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
  campaignId!: number;
  status!: AuctionStatus;
  buyerId!: number;
  soldAt!: Date;
  price!: number;
  currency!: string;
}
