import { ShipmentStatus } from '../entities/shipment.entity';

export class PickupPointResponseDto {
  id!: number;
  name!: string;
  city!: string;
  address!: string;
  latitude!: number;
  longitude!: number;
  createdAt!: Date;
}

export class ShipmentResponseDto {
  id!: number;
  campaignId!: number;
  pickupPointId!: number;
  assignedVolunteerId!: number | null;
  status!: ShipmentStatus;
  createdAt!: Date;
}

export class PaginatedShipmentsDto {
  data!: ShipmentResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
