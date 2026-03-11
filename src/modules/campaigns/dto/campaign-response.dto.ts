import { CampaignType } from '../entities/campaign.entity';

export class CampaignResponseDto {
  id!: number;
  name!: string;
  description!: string;
  campaignType!: CampaignType;
  goalMoney!: number;
  collectedMoney!: number;
  eventId!: number;
  createdBy!: number;
}

export class PaginatedCampaignsDto {
  data!: CampaignResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class CampaignItemSummaryDto {
  itemType!: string;
  quantity!: number;
}

export class CampaignItemsSummaryResponseDto {
  campaignId!: number;
  items!: CampaignItemSummaryDto[];
  updatedAt!: Date;
}
