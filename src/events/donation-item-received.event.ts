export interface DonationItemReceivedEvent {
  donationItemId: number;
  campaignId: number;
  donorId: number;
  quantity: number;
}
