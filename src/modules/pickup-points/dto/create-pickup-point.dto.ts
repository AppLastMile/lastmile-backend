import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePickupPointDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  @IsOptional()
  description?: string;
}
