export interface CampaignCreatedEvent {
  campaignId: number;
  eventId: number;
  createdBy: number;
  campaignType: 'money' | 'physical_items' | 'mixed';
}
