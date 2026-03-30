export interface AuctionClosedEvent {
  auctionId: number;
  productId: number;
  campaignId: number | null;
  winnerId: number | null;
  itemName: string;
  winningAmount: number;
  currency: string;
  closedAt: Date;
}
