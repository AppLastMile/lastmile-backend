import { ShipmentStatus } from '../entities/shipment.entity';

export class PickupPointResponseDto {
  id!: number;
  name!: string;
  city!: string;
  address!: string;
  eventId!: number;
  latitude?: number;
  longitude?: number;
}

export class PaginatedPickupPointsDto {
  data!: PickupPointResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
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
