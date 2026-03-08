import { IsEnum } from 'class-validator';
import { DonationItemStatus } from '../entities/donation-item.entity';

export class UpdateDonationItemStatusDto {
  @IsEnum(DonationItemStatus)
  status!: DonationItemStatus;
}
