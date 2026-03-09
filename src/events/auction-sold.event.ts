export interface AuctionSoldEvent {
  auctionId: number;
  campaignId: number;
  buyerId: number;
  soldAt: Date;
  price: number;
  currency: string;
}
