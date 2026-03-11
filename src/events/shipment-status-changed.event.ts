import { ShipmentStatus } from '../modules/logistics/entities/shipment.entity';

export interface ShipmentStatusChangedEvent {
  shipmentId: number;
  campaignId: number;
  previousStatus: ShipmentStatus;
  status: ShipmentStatus;
  updatedBy: number;
  updatedAt: Date;
}
