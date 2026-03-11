import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateItemDonationDto {
  @IsInt()
  campaignId!: number;

  @IsInt()
  donorId!: number;

  @ValidateIf((dto: CreateItemDonationDto) => !dto.itemType)
  @IsString()
  @MinLength(2)
  itemName?: string;

  @ValidateIf((dto: CreateItemDonationDto) => !dto.itemName)
  @IsString()
  @MinLength(2)
  itemType?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
