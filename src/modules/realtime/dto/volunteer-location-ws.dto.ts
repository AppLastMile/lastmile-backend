import {
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class VolunteerLocationWsDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsOptional()
  @IsISO8601()
  recordedAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  campaignId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  shipmentId?: number;

  @IsOptional()
  @IsString()
  correlationId?: string;
}
