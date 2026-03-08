import { IsDateString, IsInt, IsString, MinLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsString()
  disasterType!: string;

  @IsString()
  city!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsDateString()
  date!: string;

  @IsInt()
  createdBy!: number;
}
