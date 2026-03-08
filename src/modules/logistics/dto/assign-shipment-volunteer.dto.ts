import { IsInt } from 'class-validator';

export class AssignShipmentVolunteerDto {
  @IsInt()
  volunteerId!: number;
}
