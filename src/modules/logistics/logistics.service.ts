import { Injectable, NotFoundException } from '@nestjs/common';
import { ShipmentStatus } from './entities/shipment.entity';

@Injectable()
export class LogisticsService {
  // =============================
  // MOCK DATA (temporal)
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
  // UTIL JOIN
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
      id: Date.now(),
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
  // SHIPMENTS
  // =============================

  async createShipment(dto: any) {
    const shipment = {
      id: Date.now(),
      status: ShipmentStatus.PENDING,
      ...dto,
    };

    this.shipments.push(shipment);

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

    if (!shipment) {
      throw new NotFoundException(`Shipment ${id} no encontrado`);
    }

    return this.enrichShipment(shipment);
  }

  async assignVolunteer(id: number, dto: any) {
    const shipment = this.shipments.find((s) => s.id === id);

    if (!shipment) {
      throw new NotFoundException(`Shipment ${id} no encontrado`);
    }

    shipment.assignedVolunteerId = dto.volunteerId;
    shipment.status = ShipmentStatus.ASSIGNED;

    return this.enrichShipment(shipment);
  }

  async updateShipmentStatus(id: number, dto: any) {
    const shipment = this.shipments.find((s) => s.id === id);

    if (!shipment) {
      throw new NotFoundException('Shipment no encontrado');
    }

    shipment.status = dto.status;

    return this.enrichShipment(shipment);
  }

  // =============================
  // TRACKING (SIN SOCKET AQUÍ)
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

    return {
      status: 'ok',
      message: 'Location received',
    };
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