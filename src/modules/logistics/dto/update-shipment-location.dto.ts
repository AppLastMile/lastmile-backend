import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateShipmentLocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsOptional()
  @IsNumber()
  speed?: number;

  @IsOptional()
  @IsNumber()
  heading?: number;

  // 🔥 NUEVO
  @IsString()
  userId: string;
}