import { IsInt, IsString, MinLength } from 'class-validator';

export class CreateMessageDto {
  @IsInt()
  campaignId!: number;

  @IsInt()
  userId!: number;

  @IsString()
  @MinLength(1)
  message!: string;
}
