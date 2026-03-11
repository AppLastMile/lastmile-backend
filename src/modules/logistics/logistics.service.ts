import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { CreatePickupPointDto } from './dto/create-pickup-point.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { PickupPoint } from './entities/pickup-point.entity';
import { Shipment, ShipmentStatus } from './entities/shipment.entity';
import { ShipmentLocation } from './entities/shipment-location.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';

@Injectable()
export class LogisticsService {
	constructor(
		@InjectRepository(PickupPoint)
		private readonly pickupPointsRepository: Repository<PickupPoint>,
		@InjectRepository(Shipment)
		private readonly shipmentsRepository: Repository<Shipment>,
		@InjectRepository(ShipmentLocation)
		private readonly shipmentLocationsRepository: Repository<ShipmentLocation>,
		@InjectRepository(Campaign)
		private readonly campaignsRepository: Repository<Campaign>,
	) {}

	async listPickupPoints(page = 1, limit = 100) {
		const safePage = Number.isFinite(page) && page > 0 ? page : 1;
		const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 100;

		const [data, total] = await this.pickupPointsRepository.findAndCount({
			order: { id: 'DESC' },
			skip: (safePage - 1) * safeLimit,
			take: safeLimit,
		});

		return {
			data: data.map((point) => ({ ...point, eventId: null })),
			meta: {
				total,
				page: safePage,
				limit: safeLimit,
				totalPages: Math.max(1, Math.ceil(total / safeLimit)),
			},
		};
	}

	async createPickupPoint(dto: CreatePickupPointDto) {
		const pickupPoint = this.pickupPointsRepository.create({
			name: dto.name,
			city: dto.city,
			address: dto.address,
			eventId: dto.eventId ?? null,
			latitude: dto.latitude ?? 0,
			longitude: dto.longitude ?? 0,
		});

		return this.pickupPointsRepository.save(pickupPoint);
	}

	async listShipments(page = 1, limit = 100) {
		const safePage = Number.isFinite(page) && page > 0 ? page : 1;
		const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 100;

		const [data, total] = await this.shipmentsRepository.findAndCount({
			order: { id: 'DESC' },
			skip: (safePage - 1) * safeLimit,
			take: safeLimit,
		});

		return {
			data,
			meta: {
				total,
				page: safePage,
				limit: safeLimit,
				totalPages: Math.max(1, Math.ceil(total / safeLimit)),
			},
		};
	}

	async createShipment(dto: CreateShipmentDto) {
		const campaign = await this.campaignsRepository.findOne({
			where: { id: dto.campaignId },
		});

		const shipment = this.shipmentsRepository.create({
			campaignId: dto.campaignId,
			pickupPointId: dto.pickupPointId,
			eventId: campaign?.eventId ?? null,
			assignedVolunteerId: dto.assignedVolunteerId ?? null,
			status: dto.assignedVolunteerId
				? ShipmentStatus.ASSIGNED
				: ShipmentStatus.PENDING,
		});

		const saved = await this.shipmentsRepository.save(shipment);

		const pickupPoint = await this.pickupPointsRepository.findOne({
			where: { id: saved.pickupPointId },
		});

		if (pickupPoint) {
			await this.shipmentLocationsRepository.save(
				this.shipmentLocationsRepository.create({
					shipmentId: saved.id,
					lat: pickupPoint.latitude,
					lng: pickupPoint.longitude,
					speed: 0,
					heading: 0,
				}),
			);
		}

		return saved;
	}

	async assignVolunteer(shipmentId: number, volunteerId: number) {
		const shipment = await this.shipmentsRepository.findOne({
			where: { id: shipmentId },
		});

		if (!shipment) {
			return { message: 'Shipment not found' };
		}

		shipment.assignedVolunteerId = volunteerId;
		shipment.status = ShipmentStatus.ASSIGNED;
		return this.shipmentsRepository.save(shipment);
	}

	async getLatestLocation(shipmentId: number) {
		const latest = await this.shipmentLocationsRepository.findOne({
			where: { shipmentId },
			order: { recordedAt: 'DESC', id: 'DESC' },
		});

		if (latest) {
			return {
				shipmentId: latest.shipmentId,
				lat: latest.lat,
				lng: latest.lng,
				speed: latest.speed,
				heading: latest.heading,
				recordedAt: latest.recordedAt.toISOString(),
			};
		}

		const shipment = await this.shipmentsRepository.findOne({
			where: { id: shipmentId },
		});

		const pickupPoint = shipment
			? await this.pickupPointsRepository.findOne({
					where: { id: shipment.pickupPointId },
				})
			: null;

		const fallback = this.shipmentLocationsRepository.create({
			shipmentId,
			lat: pickupPoint?.latitude ?? 0,
			lng: pickupPoint?.longitude ?? 0,
			speed: 0,
			heading: 0,
		});

		const saved = await this.shipmentLocationsRepository.save(fallback);
		return {
			shipmentId: saved.shipmentId,
			lat: saved.lat,
			lng: saved.lng,
			speed: saved.speed,
			heading: saved.heading,
			recordedAt: saved.recordedAt.toISOString(),
		};
	}

	async getLocationHistory(shipmentId: number, limit = 100, before?: string) {
		const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 100;
		const beforeDate = before ? new Date(before) : null;

		const where = beforeDate
			? { shipmentId, recordedAt: LessThanOrEqual(beforeDate) }
			: { shipmentId };

		const rows = await this.shipmentLocationsRepository.find({
			where,
			order: { recordedAt: 'DESC', id: 'DESC' },
			take: safeLimit,
		});

		if (rows.length === 0) {
			const latest = await this.getLatestLocation(shipmentId);
			return [latest];
		}

		return rows.map((row) => ({
			shipmentId: row.shipmentId,
			lat: row.lat,
			lng: row.lng,
			speed: row.speed,
			heading: row.heading,
			recordedAt: row.recordedAt.toISOString(),
		}));
	}
}
