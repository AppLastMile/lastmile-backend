import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { CampaignType } from '../entities/campaign.entity';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  @IsOptional()
  @IsEnum(CampaignType)
  campaignType?: CampaignType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  goalMoney?: number;

  @IsOptional()
  @IsInt()
  eventId?: number;

  @IsOptional()
  @IsInt()
  createdBy?: number;
}
