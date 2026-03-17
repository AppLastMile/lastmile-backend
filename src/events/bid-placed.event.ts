export interface BidPlacedEvent {
  bidId: number;
  auctionId: number;
  userId: number;
  amount: number;
  previousPrice: number;
}
