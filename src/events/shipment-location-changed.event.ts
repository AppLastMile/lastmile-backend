export interface ShipmentLocationChangedEvent {
  shipmentId: number;
  campaignId: number;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  recordedAt: Date;
  updatedBy: number;
}
