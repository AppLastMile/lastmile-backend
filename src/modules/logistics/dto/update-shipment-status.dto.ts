import { IsEnum } from 'class-validator';
import { ShipmentStatus } from '../entities/shipment.entity';

export class UpdateShipmentStatusDto {
  @IsEnum(ShipmentStatus)
  status!: ShipmentStatus;
}
