import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateItemDonationDto {
  @IsInt()
  campaignId!: number;

  @IsInt()
  donorId!: number;

  @IsString()
  @MinLength(2)
  itemName!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
