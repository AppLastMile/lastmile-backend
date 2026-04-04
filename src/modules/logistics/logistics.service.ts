import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { ShipmentAssignedEvent } from '../../events/shipment-assigned.event';
import { ShipmentDeliveredEvent } from '../../events/shipment-delivered.event';
import { ShipmentLocationChangedEvent } from '../../events/shipment-location-changed.event';
import { ShipmentStatusChangedEvent } from '../../events/shipment-status-changed.event';
import { AssignShipmentVolunteerDto } from './dto/assign-shipment-volunteer.dto';
import { CreatePickupPointDto } from './dto/create-pickup-point.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { FindPickupPointsQueryDto } from './dto/find-pickup-points-query.dto';
import { FindShipmentLocationHistoryQueryDto } from './dto/find-shipment-location-history-query.dto';
import { FindShipmentsQueryDto } from './dto/find-shipments-query.dto';
import {
  PaginatedPickupPointsDto,
  PaginatedShipmentsDto,
  PickupPointResponseDto,
  ShipmentLocationHistoryResponseDto,
  ShipmentLocationPointResponseDto,
  ShipmentResponseDto,
} from './dto/logistics-response.dto';
import { UpdatePickupPointDto } from './dto/update-pickup-point.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { PickupPoint } from './entities/pickup-point.entity';
import { ShipmentLocationHistory } from './entities/shipment-location-history.entity';
import { Shipment, ShipmentStatus } from './entities/shipment.entity';

@Injectable()
export class LogisticsService {
  constructor(
    @InjectRepository(PickupPoint)
    private readonly pickupPointsRepository: Repository<PickupPoint>,
    @InjectRepository(Shipment)
    private readonly shipmentsRepository: Repository<Shipment>,
    @InjectRepository(ShipmentLocationHistory)
    private readonly shipmentLocationsRepository: Repository<ShipmentLocationHistory>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createPickupPoint(
    dto: CreatePickupPointDto,
  ): Promise<PickupPointResponseDto> {
    const pickupPoint = this.pickupPointsRepository.create(dto);
    const savedPickupPoint =
      await this.pickupPointsRepository.save(pickupPoint);

    return this.toPickupPointResponse(savedPickupPoint);
  }

  async findPickupPoints(
    query: FindPickupPointsQueryDto,
  ): Promise<PaginatedPickupPointsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.pickupPointsRepository.createQueryBuilder('pickupPoint');
    qb.orderBy('pickupPoint.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [pickupPoints, total] = await qb.getManyAndCount();

    return {
      data: pickupPoints.map((pickupPoint) =>
        this.toPickupPointResponse(pickupPoint),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findPickupPointById(id: number): Promise<PickupPointResponseDto> {
    const pickupPoint = await this.pickupPointsRepository.findOne({
      where: { id },
    });
    if (!pickupPoint) {
      throw new NotFoundException(`Pickup point with id ${id} was not found`);
    }

    return this.toPickupPointResponse(pickupPoint);
  }

  async updatePickupPoint(
    id: number,
    dto: UpdatePickupPointDto,
  ): Promise<PickupPointResponseDto> {
    const pickupPoint = await this.pickupPointsRepository.findOne({
      where: { id },
    });
    if (!pickupPoint) {
      throw new NotFoundException(`Pickup point with id ${id} was not found`);
    }

    const updatedPickupPoint = await this.pickupPointsRepository.save({
      ...pickupPoint,
      ...dto,
    });

    return this.toPickupPointResponse(updatedPickupPoint);
  }

  async createShipment(dto: CreateShipmentDto): Promise<ShipmentResponseDto> {
    await this.ensurePickupPointExists(dto.pickupPointId);

    const nextStatus = dto.assignedVolunteerId
      ? ShipmentStatus.ASSIGNED
      : ShipmentStatus.PENDING;

    const shipment = this.shipmentsRepository.create({
      campaignId: dto.campaignId,
      pickupPointId: dto.pickupPointId,
      assignedVolunteerId: dto.assignedVolunteerId ?? null,
      status: nextStatus,
    });

    const savedShipment = await this.shipmentsRepository.save(shipment);

    if (savedShipment.assignedVolunteerId) {
      this.emitShipmentAssignedEvent(savedShipment);
    }

    return this.toShipmentResponse(savedShipment);
  }

  async findShipments(
    query: FindShipmentsQueryDto,
  ): Promise<PaginatedShipmentsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.shipmentsRepository.createQueryBuilder('shipment');

    if (query.campaignId) {
      qb.andWhere('shipment.campaignId = :campaignId', {
        campaignId: query.campaignId,
      });
    }

    if (query.pickupPointId) {
      qb.andWhere('shipment.pickupPointId = :pickupPointId', {
        pickupPointId: query.pickupPointId,
      });
    }

    if (query.assignedVolunteerId) {
      qb.andWhere('shipment.assignedVolunteerId = :assignedVolunteerId', {
        assignedVolunteerId: query.assignedVolunteerId,
      });
    }

    if (query.status) {
      qb.andWhere('shipment.status = :status', { status: query.status });
    }

    qb.orderBy('shipment.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [shipments, total] = await qb.getManyAndCount();

    return {
      data: shipments.map((shipment) => this.toShipmentResponse(shipment)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findShipmentById(id: number): Promise<ShipmentResponseDto> {
    const shipment = await this.shipmentsRepository.findOne({ where: { id } });
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${id} was not found`);
    }

    return this.toShipmentResponse(shipment);
  }

  async assignVolunteer(
    id: number,
    dto: AssignShipmentVolunteerDto,
  ): Promise<ShipmentResponseDto> {
    const shipment = await this.shipmentsRepository.findOne({ where: { id } });
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${id} was not found`);
    }

    const nextStatus =
      shipment.status === ShipmentStatus.PENDING
        ? ShipmentStatus.ASSIGNED
        : shipment.status;

    const updatedShipment = await this.shipmentsRepository.save({
      ...shipment,
      assignedVolunteerId: dto.volunteerId,
      status: nextStatus,
    });

    this.emitShipmentAssignedEvent(updatedShipment);

    return this.toShipmentResponse(updatedShipment);
  }

  async updateShipmentStatus(
    id: number,
    dto: UpdateShipmentStatusDto,
  ): Promise<ShipmentResponseDto> {
    const shipment = await this.shipmentsRepository.findOne({ where: { id } });
    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${id} was not found`);
    }

    const previousStatus = shipment.status;

    const updatedShipment = await this.shipmentsRepository.save({
      ...shipment,
      status: dto.status,
    });

    if (previousStatus !== updatedShipment.status) {
      const statusChangedPayload: ShipmentStatusChangedEvent = {
        shipmentId: updatedShipment.id,
        campaignId: updatedShipment.campaignId,
        previousStatus,
        status: updatedShipment.status,
        updatedBy: updatedShipment.assignedVolunteerId ?? 0,
        updatedAt: new Date(),
      };
      this.eventEmitter.emit('shipment.status.changed', statusChangedPayload);
    }

    if (dto.status === ShipmentStatus.DELIVERED) {
      const eventPayload: ShipmentDeliveredEvent = {
        shipmentId: updatedShipment.id,
        campaignId: updatedShipment.campaignId,
        deliveredAt: new Date(),
      };
      this.eventEmitter.emit('shipment.delivered', eventPayload);
    }

    return this.toShipmentResponse(updatedShipment);
  }

  async updateShipmentStatusForVolunteer(
    id: number,
    dto: UpdateShipmentStatusDto,
    volunteerId: number,
  ): Promise<ShipmentResponseDto> {
    const shipment = await this.shipmentsRepository.findOne({ where: { id } });
    if (!shipment) {
      throw new NotFoundException({
        success: false,
        message: 'Envío no encontrado.',
      });
    }

    if (
      !shipment.assignedVolunteerId ||
      shipment.assignedVolunteerId !== volunteerId
    ) {
      throw new ForbiddenException({
        success: false,
        message: 'No tienes permisos para actualizar este envío.',
      });
    }

    this.ensureValidVolunteerTransition(shipment.status, dto.status);
    return this.updateShipmentStatus(id, dto);
  }

  async createShipmentLocationUpdate(params: {
    shipmentId: number;
    lat: number;
    lng: number;
    speed?: number | null;
    heading?: number | null;
    recordedAt?: Date;
    updatedBy: number;
  }): Promise<ShipmentLocationHistory> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id: params.shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException(
        `Shipment with id ${params.shipmentId} was not found`,
      );
    }

    const row = await this.shipmentLocationsRepository.save(
      this.shipmentLocationsRepository.create({
        shipmentId: shipment.id,
        campaignId: shipment.campaignId,
        lat: params.lat,
        lng: params.lng,
        speed: params.speed ?? null,
        heading: params.heading ?? null,
        recordedAt: params.recordedAt ?? new Date(),
        updatedBy: params.updatedBy,
      }),
    );

    const locationChangedPayload: ShipmentLocationChangedEvent = {
      shipmentId: row.shipmentId,
      campaignId: row.campaignId,
      lat: row.lat,
      lng: row.lng,
      speed: row.speed,
      heading: row.heading,
      recordedAt: row.recordedAt,
      updatedBy: row.updatedBy,
    };
    this.eventEmitter.emit('shipment.location.changed', locationChangedPayload);

    return row;
  }

  async findShipmentLatestLocation(
    shipmentId: number,
  ): Promise<ShipmentLocationPointResponseDto | null> {
    await this.ensureShipmentExists(shipmentId);

    const latest = await this.shipmentLocationsRepository.findOne({
      where: { shipmentId },
      order: { recordedAt: 'DESC', id: 'DESC' },
    });

    return latest ? this.toShipmentLocationResponse(latest) : null;
  }

  async findShipmentLocationHistory(
    shipmentId: number,
    query: FindShipmentLocationHistoryQueryDto,
  ): Promise<ShipmentLocationHistoryResponseDto> {
    await this.ensureShipmentExists(shipmentId);

    const limit = query.limit ?? 100;
    const qb = this.shipmentLocationsRepository
      .createQueryBuilder('location')
      .where('location.shipmentId = :shipmentId', { shipmentId });

    if (query.before) {
      const beforeDate = new Date(query.before);
      if (!Number.isNaN(beforeDate.getTime())) {
        qb.andWhere('location.recordedAt < :beforeDate', { beforeDate });
      }
    }

    qb.orderBy('location.recordedAt', 'DESC');
    qb.addOrderBy('location.id', 'DESC');
    qb.take(limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((row) => this.toShipmentLocationResponse(row)),
      meta: {
        total,
        limit,
      },
    };
  }

  private async ensurePickupPointExists(pickupPointId: number): Promise<void> {
    const pickupPoint = await this.pickupPointsRepository.findOne({
      where: { id: pickupPointId },
      select: { id: true },
    });

    if (!pickupPoint) {
      throw new NotFoundException(
        `Pickup point with id ${pickupPointId} was not found`,
      );
    }
  }

  private async ensureShipmentExists(shipmentId: number): Promise<void> {
    const shipment = await this.shipmentsRepository.findOne({
      where: { id: shipmentId },
      select: { id: true },
    });

    if (!shipment) {
      throw new NotFoundException(
        `Shipment with id ${shipmentId} was not found`,
      );
    }
  }

  private emitShipmentAssignedEvent(shipment: Shipment): void {
    if (!shipment.assignedVolunteerId) {
      return;
    }

    const eventPayload: ShipmentAssignedEvent = {
      shipmentId: shipment.id,
      campaignId: shipment.campaignId,
      volunteerId: shipment.assignedVolunteerId,
    };
    this.eventEmitter.emit('shipment.assigned', eventPayload);
  }

  private ensureValidVolunteerTransition(
    current: ShipmentStatus,
    next: ShipmentStatus,
  ): void {
    const isAssignedToInTransit =
      current === ShipmentStatus.ASSIGNED && next === ShipmentStatus.IN_TRANSIT;
    const isInTransitToDelivered =
      current === ShipmentStatus.IN_TRANSIT &&
      next === ShipmentStatus.DELIVERED;

    if (!isAssignedToInTransit && !isInTransitToDelivered) {
      throw new ConflictException({
        success: false,
        message: 'Transición de estado no permitida.',
      });
    }
  }

  private toPickupPointResponse(
    pickupPoint: PickupPoint,
  ): PickupPointResponseDto {
    return {
      id: pickupPoint.id,
      name: pickupPoint.name,
      city: pickupPoint.city,
      address: pickupPoint.address,
      eventId: pickupPoint.eventId,
      latitude: pickupPoint.latitude ?? undefined,
      longitude: pickupPoint.longitude ?? undefined,
    };
  }

  private toShipmentResponse(shipment: Shipment): ShipmentResponseDto {
    return {
      id: shipment.id,
      campaignId: shipment.campaignId,
      pickupPointId: shipment.pickupPointId,
      assignedVolunteerId: shipment.assignedVolunteerId,
      status: shipment.status,
      createdAt: shipment.createdAt,
    };
  }

  private toShipmentLocationResponse(
    location: ShipmentLocationHistory,
  ): ShipmentLocationPointResponseDto {
    return {
      id: location.id,
      shipmentId: location.shipmentId,
      campaignId: location.campaignId,
      lat: location.lat,
      lng: location.lng,
      speed: location.speed ?? undefined,
      heading: location.heading ?? undefined,
      recordedAt: location.recordedAt,
      updatedBy: location.updatedBy,
      createdAt: location.createdAt,
    };
  }
}
