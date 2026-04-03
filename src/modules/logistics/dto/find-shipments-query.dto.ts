import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { ShipmentStatus } from '../entities/shipment.entity';

export class FindShipmentsQueryDto {
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
  pickupPointId?: number;

  @IsOptional()
  @Transform(({ value }: { value: string }) =>
    value === 'me' ? 'me' : Number(value),
  )
  @ValidateIf((dto: FindShipmentsQueryDto) => dto.assignedVolunteerId !== 'me')
  @IsInt()
  assignedVolunteerId?: number | 'me';

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;
}
