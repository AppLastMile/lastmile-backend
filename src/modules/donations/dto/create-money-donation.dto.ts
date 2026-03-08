import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateMoneyDonationDto {
  @IsInt()
  campaignId!: number;

  @IsInt()
  donorId!: number;

  @IsNumber()
  @Min(1)
  amount!: number;
}
