import { Injectable } from '@nestjs/common';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { ShipmentStatus } from './entities/shipment.entity';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class LogisticsService {
  constructor(private readonly trackingGateway: TrackingGateway) {}

  // =============================
  // TRACKING EN TIEMPO REAL
  // =============================

  async createShipmentLocationUpdate(data: {
    shipmentId: number;
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    userId: string;
    updatedBy: number;
  }) {
    console.log('📍 LOCATION RECIBIDA EN BACK:', data);

    this.trackingGateway.emitLocation({
      shipmentId: data.shipmentId,
      lat: data.lat,
      lng: data.lng,
      userId: data.userId,
    });

    this.trackingGateway.emitNotification(
      data.userId,
      '📍 Nueva ubicación registrada',
    );

    return {
      status: 'ok',
      message: 'Location updated and emitted',
    };
  }

  // =============================
  // MOCK DATA (ALINEADO A TU BD)
  // =============================

  private campaigns = [
    { id: 1, name: '🚨 Inundación Cali', eventId: 1 },
    { id: 2, name: '🔥 Incendio Forestal', eventId: 2 },
  ];

  private pickupPoints = [
    {
      id: 1,
      name: 'Centro Acopio Norte',
      address: 'Calle 10',
      city: 'Cali',
      eventId: 1,
      latitude: 3.45,
      longitude: -76.53,
    },
    {
      id: 2,
      name: 'Centro Acopio Sur',
      address: 'Calle 25',
      city: 'Cali',
      eventId: 2,
      latitude: 3.42,
      longitude: -76.54,
    },
  ];

  private shipments = [
    {
      id: 1,
      status: ShipmentStatus.ASSIGNED,
      campaignId: 1,
      pickupPointId: 1,
      assignedVolunteerId: 10,
      createdAt: new Date(),
    },
    {
      id: 2,
      status: ShipmentStatus.IN_TRANSIT,
      campaignId: 1,
      pickupPointId: 1,
      assignedVolunteerId: 10,
      createdAt: new Date(),
    },
    {
      id: 3,
      status: ShipmentStatus.ASSIGNED,
      campaignId: 2,
      pickupPointId: 2,
      assignedVolunteerId: 10,
      createdAt: new Date(),
    },
  ];

  // =============================
  // UTIL JOIN (🔥 CLAVE)
  // =============================

  private enrichShipment(shipment: any) {
    const point = this.pickupPoints.find(
      (p) => p.id === shipment.pickupPointId,
    );

    const campaign = this.campaigns.find((c) => c.eventId === point?.eventId);

    return {
      ...shipment,
      campaign: campaign || null,
    };
  }

  // =============================
  // PICKUP POINTS
  // =============================

  async createPickupPoint(dto: any) {
    return {
      id: 1,
      ...dto,
    };
  }

  async findPickupPoints(query: any) {
    return {
      data: this.pickupPoints,
      meta: {
        total: this.pickupPoints.length,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    };
  }

  async findPickupPointById(id: number) {
    const point = this.pickupPoints.find((p) => p.id === id);

    if (!point) {
      throw new NotFoundException(`PickupPoint con id ${id} no encontrado`);
    }

    return point;
  }

  async updatePickupPoint(id: number, dto: any) {
    return {
      id,
      ...dto,
    };
  }

  // =============================
  // SHIPMENTS (🔥 FIX REAL)
  // =============================

  async createShipment(dto: any) {
    const shipment = {
      id: 99,
      status: ShipmentStatus.PENDING,
      ...dto,
    };

    return this.enrichShipment(shipment);
  }

  async findShipments(query: any) {
    const volunteerId = Number(query.assignedVolunteerId);

    const filtered = this.shipments.filter(
      (s) => s.assignedVolunteerId === volunteerId,
    );

    const enriched = filtered.map((s) => this.enrichShipment(s));

    return {
      data: enriched,
      meta: {
        total: enriched.length,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    };
  }

  async findShipmentById(id: number) {
    const shipment = this.shipments.find((s) => s.id === id);
    return shipment ? this.enrichShipment(shipment) : null;
  }

  async assignVolunteer(id: number, dto: any) {
    return this.enrichShipment({
      id,
      status: ShipmentStatus.ASSIGNED,
      campaignId: 1,
      pickupPointId: 1,
      assignedVolunteerId: dto.volunteerId,
      createdAt: new Date(),
    });
  }

  async updateShipmentStatus(id: number, dto: any) {
    const shipment = this.shipments.find((s) => s.id === id);

    if (!shipment) return null;

    shipment.status = dto.status as ShipmentStatus;

    return this.enrichShipment(shipment);
  }

  async findShipmentLatestLocation(id: number) {
    return null;
  }

  async findShipmentLocationHistory(id: number, query: any) {
    return {
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      },
    };
  }

  // =============================
  // VOLUNTEER SHIPMENTS
  // =============================

  async getVolunteerShipments(query: any) {
    return this.findShipments(query);
  }
}
