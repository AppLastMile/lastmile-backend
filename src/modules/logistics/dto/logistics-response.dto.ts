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

export class ShipmentLocationPointResponseDto {
  id!: number;
  shipmentId!: number;
  campaignId!: number;
  lat!: number;
  lng!: number;
  speed?: number;
  heading?: number;
  recordedAt!: Date;
  updatedBy!: number;
  createdAt!: Date;
}

export class ShipmentLocationHistoryResponseDto {
  data!: ShipmentLocationPointResponseDto[];
  meta!: {
    total: number;
    limit: number;
  };
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
