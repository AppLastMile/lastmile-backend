import { IsNumber, IsString, MinLength } from 'class-validator';

export class CreatePickupPointDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  city!: string;

  @IsString()
  address!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}
