import { IsInt, IsOptional } from 'class-validator';

export class CreateShipmentDto {
  @IsInt()
  campaignId!: number;

  @IsInt()
  pickupPointId!: number;

  @IsOptional()
  @IsInt()
  assignedVolunteerId?: number;
}
