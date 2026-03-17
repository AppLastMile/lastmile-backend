import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateBidDto {
  @IsInt()
  userId!: number;

  @IsNumber()
  @Min(1)
  amount!: number;
}
