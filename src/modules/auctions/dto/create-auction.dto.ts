import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AuctionBidMode } from '../entities/auction.entity';

export class CreateAuctionDto {
  @IsInt()
  productId!: number;

  @IsInt()
  @Min(1)
  initialPrice!: number;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsInt()
  campaignId?: number;

  @IsOptional()
  @IsEnum(AuctionBidMode)
  bidMode?: AuctionBidMode;

  @ValidateIf((o: CreateAuctionDto) => o.bidMode === AuctionBidMode.FIXED_INCREMENT)
  @IsNumber()
  @Min(1)
  bidIncrement?: number;
}
