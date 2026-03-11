import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateItemDonationDto {
  @IsInt()
  campaignId!: number;

  @IsInt()
  donorId!: number;

  @IsString()
  @MinLength(2)
  itemType!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
