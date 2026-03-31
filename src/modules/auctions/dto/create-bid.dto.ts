import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateBidDto {
  @IsInt()
  userId!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;
}
