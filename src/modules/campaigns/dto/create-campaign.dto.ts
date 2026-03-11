import {
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { CampaignType } from '../entities/campaign.entity';

export class CreateCampaignDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsEnum(CampaignType)
  campaignType!: CampaignType;

  @IsNumber()
  @Min(0)
  goalMoney!: number;

  @IsInt()
  eventId!: number;

  @IsInt()
  createdBy!: number;
}
