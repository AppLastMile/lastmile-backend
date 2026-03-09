export interface AuctionCreatedEvent {
  auctionId: number;
  campaignId: number;
  sellerId: number;
  price: number;
  currency: string;
}
