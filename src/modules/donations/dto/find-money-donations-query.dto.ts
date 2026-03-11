import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class FindMoneyDonationsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  campaignId?: number;

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  donorId?: number;
}
