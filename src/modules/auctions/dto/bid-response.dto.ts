export class BidResponseDto {
  id!: number;
  auctionId!: number;
  userId!: number;
  amount!: number;
  currentAuctionPrice!: number;
  createdAt!: Date;
}

export class AuctionBidDto {
  id!: number;
  auctionId!: number;
  userId!: number;
  amount!: number;
  createdAt!: Date;
}
