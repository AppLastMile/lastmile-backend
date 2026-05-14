import { IsInt, IsString, MinLength } from 'class-validator';

export class CreatePickupPointDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  city!: string;

  @IsString()
  address!: string;

  @IsInt()
  eventId!: number;
}
