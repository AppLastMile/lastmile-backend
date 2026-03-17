export interface AuctionSoldEvent {
  auctionId: number;
  productId: number;
  campaignId: number | null;
  buyerId: number;
  soldAt: Date;
  price: number;
  currency: string;
}
