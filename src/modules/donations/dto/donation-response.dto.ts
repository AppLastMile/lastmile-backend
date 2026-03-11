import { DonationItemStatus } from '../entities/donation-item.entity';

export class DonationMoneyResponseDto {
  id!: number;
  campaignId!: number;
  donorId!: number;
  amount!: number;
  createdAt!: Date;
}

export class DonationItemResponseDto {
  id!: number;
  campaignId!: number;
  donorId!: number;
  itemName!: string;
  itemType!: string;
  quantity!: number;
  notes!: string | null;
  status!: DonationItemStatus;
  createdAt!: Date;
}

export class PaginatedMoneyDonationsDto {
  data!: DonationMoneyResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class PaginatedItemDonationsDto {
  data!: DonationItemResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
