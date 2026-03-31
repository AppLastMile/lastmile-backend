export interface BidPlacedEvent {
  bidId: number;
  auctionId: number;
  campaignId: number | null;
  userId: number;
  amount: number;
  previousPrice: number;
}
