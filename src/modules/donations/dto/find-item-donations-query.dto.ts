import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { DonationItemStatus } from '../entities/donation-item.entity';

export class FindItemDonationsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  campaignId?: number;

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  donorId?: number;

  @IsOptional()
  @IsEnum(DonationItemStatus)
  status?: DonationItemStatus;

  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @MinLength(2)
  itemName?: string;

  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @MinLength(2)
  itemType?: string;
}
