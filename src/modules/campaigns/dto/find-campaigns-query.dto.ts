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
import { CampaignType } from '../entities/campaign.entity';

export class FindCampaignsQueryDto {
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
  eventId?: number;

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  createdBy?: number;

  @IsOptional()
  @IsEnum(CampaignType)
  campaignType?: CampaignType;

  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @MinLength(2)
  search?: string;
}
