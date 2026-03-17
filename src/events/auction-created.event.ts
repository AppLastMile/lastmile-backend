export interface AuctionCreatedEvent {
  auctionId: number;
  productId: number;
  campaignId: number | null;
  sellerId: number;
  price: number;
  currency: string;
}
