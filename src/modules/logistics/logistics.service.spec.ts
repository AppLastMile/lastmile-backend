import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import { ShipmentStatus } from './entities/shipment.entity';

const makePickupPoint = (o: any = {}) => ({
  id: 1, name: 'PP1', city: 'Bogotá', address: 'Calle 1', eventId: null,
  latitude: 4.6, longitude: -74.0, createdAt: new Date(), ...o,
});

const makeShipment = (o: any = {}) => ({
  id: 1, campaignId: 1, pickupPointId: 1, assignedVolunteerId: null,
  status: ShipmentStatus.PENDING, createdAt: new Date(), ...o,
});

const makeLocation = (o: any = {}) => ({
  id: 1, shipmentId: 1, campaignId: 1, lat: 4.6, lng: -74.0,
  speed: null, heading: null, recordedAt: new Date(), updatedBy: 1, createdAt: new Date(), ...o,
});

const makeQb = (items: any[] = [], count = 0, overrides: any = {}) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([items, count]),
  getMany: jest.fn().mockResolvedValue(items),
  ...overrides,
});

const makeService = () => {
  const ppQb = makeQb();
  const shipQb = makeQb();
  const locQb = makeQb();

  const ppRepo = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({ ...makePickupPoint(), ...d })),
    findOne: jest.fn().mockResolvedValue(makePickupPoint()),
    createQueryBuilder: jest.fn().mockReturnValue(ppQb),
  };
  const shipRepo = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({ ...makeShipment(), ...d })),
    findOne: jest.fn().mockResolvedValue(makeShipment()),
    createQueryBuilder: jest.fn().mockReturnValue(shipQb),
  };
  const locRepo = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({ ...makeLocation(), ...d })),
    findOne: jest.fn().mockResolvedValue(makeLocation()),
    createQueryBuilder: jest.fn().mockReturnValue(locQb),
  };
  const eventEmitter = { emit: jest.fn() };

  const svc = new LogisticsService(
    ppRepo as any, shipRepo as any, locRepo as any, eventEmitter as any,
  );

  return { svc, ppRepo, shipRepo, locRepo, eventEmitter, ppQb, shipQb, locQb };
};

const mockFetch = (ok: boolean, json: any) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue(json),
  }) as any;
};

describe('LogisticsService', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  describe('createPickupPoint', () => {
    it('creates and returns pickup point', async () => {
      mockFetch(true, [{ lat: '4.6', lon: '-74.0' }]);
      const { svc } = makeService();
      const result = await svc.createPickupPoint({ name: 'PP', city: 'Bogotá', address: 'Calle 1', eventId: null } as any);
      expect(result.id).toBe(1);
      expect(result.latitude).toBe(4.6);
    });

    it('throws UnprocessableEntityException when fetch fails', async () => {
      mockFetch(false, []);
      const { svc } = makeService();
      await expect(svc.createPickupPoint({ name: 'PP', city: 'Bogotá', address: 'Calle 1' } as any))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when geocoding returns empty array', async () => {
      mockFetch(true, []);
      const { svc } = makeService();
      await expect(svc.createPickupPoint({ name: 'PP', city: 'Bogotá', address: 'Calle 1' } as any))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when coords are non-finite', async () => {
      mockFetch(true, [{ lat: 'abc', lon: 'xyz' }]);
      const { svc } = makeService();
      await expect(svc.createPickupPoint({ name: 'PP', city: 'Bogotá', address: 'Calle 1' } as any))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when coords are out of range', async () => {
      mockFetch(true, [{ lat: '999', lon: '-74.0' }]);
      const { svc } = makeService();
      await expect(svc.createPickupPoint({ name: 'PP', city: 'Bogotá', address: 'Calle 1' } as any))
        .rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when lng is out of range', async () => {
      mockFetch(true, [{ lat: '4.6', lon: '-999' }]);
      const { svc } = makeService();
      await expect(svc.createPickupPoint({ name: 'PP', city: 'Bogotá', address: 'Calle 1' } as any))
        .rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('findPickupPoints', () => {
    it('returns paginated pickup points', async () => {
      const { svc, ppRepo, ppQb } = makeService();
      ppQb.getManyAndCount.mockResolvedValue([[makePickupPoint()], 1]);
      ppRepo.createQueryBuilder.mockReturnValue(ppQb);
      const result = await svc.findPickupPoints({});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('uses defaults when query is empty', async () => {
      const { svc } = makeService();
      const result = await svc.findPickupPoints({});
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findPickupPointById', () => {
    it('returns pickup point', async () => {
      const { svc } = makeService();
      const result = await svc.findPickupPointById(1);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      const { svc, ppRepo } = makeService();
      ppRepo.findOne.mockResolvedValue(null);
      await expect(svc.findPickupPointById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePickupPoint', () => {
    it('updates pickup point', async () => {
      const { svc } = makeService();
      const result = await svc.updatePickupPoint(1, { name: 'Updated' } as any);
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when not found', async () => {
      const { svc, ppRepo } = makeService();
      ppRepo.findOne.mockResolvedValue(null);
      await expect(svc.updatePickupPoint(99, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('createShipment', () => {
    it('creates shipment without volunteer (PENDING)', async () => {
      const { svc } = makeService();
      const result = await svc.createShipment({ campaignId: 1, pickupPointId: 1 } as any);
      expect(result).toBeDefined();
    });

    it('creates shipment with volunteer (ASSIGNED) and emits event', async () => {
      const { svc, shipRepo, eventEmitter } = makeService();
      shipRepo.save.mockResolvedValue(makeShipment({ assignedVolunteerId: 5, status: ShipmentStatus.ASSIGNED }));
      const result = await svc.createShipment({ campaignId: 1, pickupPointId: 1, assignedVolunteerId: 5 } as any);
      expect(result).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith('shipment.assigned', expect.any(Object));
    });

    it('throws NotFoundException when pickup point not found', async () => {
      const { svc, ppRepo } = makeService();
      ppRepo.findOne.mockResolvedValue(null);
      await expect(svc.createShipment({ campaignId: 1, pickupPointId: 99 } as any))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('findShipments', () => {
    it('returns paginated shipments', async () => {
      const { svc } = makeService();
      const result = await svc.findShipments({});
      expect(result.data).toEqual([]);
    });

    it('applies campaignId filter', async () => {
      const { svc, shipQb } = makeService();
      await svc.findShipments({ campaignId: 1 } as any);
      expect(shipQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('campaignId'), expect.any(Object));
    });

    it('applies pickupPointId filter', async () => {
      const { svc, shipQb } = makeService();
      await svc.findShipments({ pickupPointId: 1 } as any);
      expect(shipQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('pickupPointId'), expect.any(Object));
    });

    it('applies assignedVolunteerId filter', async () => {
      const { svc, shipQb } = makeService();
      await svc.findShipments({ assignedVolunteerId: 5 } as any);
      expect(shipQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('assignedVolunteerId'), expect.any(Object));
    });

    it('applies status filter', async () => {
      const { svc, shipQb } = makeService();
      await svc.findShipments({ status: ShipmentStatus.PENDING } as any);
      expect(shipQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('status'), expect.any(Object));
    });
  });

  describe('findShipmentById', () => {
    it('returns shipment', async () => {
      const { svc } = makeService();
      const result = await svc.findShipmentById(1);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      const { svc, shipRepo } = makeService();
      shipRepo.findOne.mockResolvedValue(null);
      await expect(svc.findShipmentById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignVolunteer', () => {
    it('assigns volunteer and emits event', async () => {
      const { svc, eventEmitter } = makeService();
      const result = await svc.assignVolunteer(1, { volunteerId: 5 } as any);
      expect(result).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith('shipment.assigned', expect.any(Object));
    });

    it('keeps status if not PENDING when assigning', async () => {
      const { svc, shipRepo } = makeService();
      shipRepo.findOne.mockResolvedValue(makeShipment({ status: ShipmentStatus.IN_TRANSIT }));
      const result = await svc.assignVolunteer(1, { volunteerId: 5 } as any);
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when shipment not found', async () => {
      const { svc, shipRepo } = makeService();
      shipRepo.findOne.mockResolvedValue(null);
      await expect(svc.assignVolunteer(99, { volunteerId: 5 } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateShipmentStatus', () => {
    it('updates status and emits status changed event', async () => {
      const { svc, shipRepo, eventEmitter } = makeService();
      shipRepo.findOne.mockResolvedValue(makeShipment({ status: ShipmentStatus.ASSIGNED }));
      shipRepo.save.mockResolvedValue(makeShipment({ status: ShipmentStatus.IN_TRANSIT }));
      await svc.updateShipmentStatus(1, { status: ShipmentStatus.IN_TRANSIT } as any);
      expect(eventEmitter.emit).toHaveBeenCalledWith('shipment.status.changed', expect.any(Object));
    });

    it('emits delivered event when status is DELIVERED', async () => {
      const { svc, shipRepo, eventEmitter } = makeService();
      shipRepo.findOne.mockResolvedValue(makeShipment({ status: ShipmentStatus.IN_TRANSIT }));
      shipRepo.save.mockResolvedValue(makeShipment({ status: ShipmentStatus.DELIVERED }));
      await svc.updateShipmentStatus(1, { status: ShipmentStatus.DELIVERED } as any);
      expect(eventEmitter.emit).toHaveBeenCalledWith('shipment.delivered', expect.any(Object));
    });

    it('does not emit status changed event when status is unchanged', async () => {
      const { svc, shipRepo, eventEmitter } = makeService();
      shipRepo.save.mockResolvedValue(makeShipment({ status: ShipmentStatus.PENDING }));
      await svc.updateShipmentStatus(1, { status: ShipmentStatus.PENDING } as any);
      expect(eventEmitter.emit).not.toHaveBeenCalledWith('shipment.status.changed', expect.any(Object));
    });

    it('throws NotFoundException when not found', async () => {
      const { svc, shipRepo } = makeService();
      shipRepo.findOne.mockResolvedValue(null);
      await expect(svc.updateShipmentStatus(99, { status: ShipmentStatus.IN_TRANSIT } as any))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('updateShipmentStatusForVolunteer', () => {
    it('allows ASSIGNED → IN_TRANSIT transition', async () => {
      const { svc, shipRepo } = makeService();
      shipRepo.findOne
        .mockResolvedValueOnce(makeShipment({ assignedVolunteerId: 5, status: ShipmentStatus.ASSIGNED }))
        .mockResolvedValueOnce(makeShipment({ assignedVolunteerId: 5, status: ShipmentStatus.ASSIGNED }));
      shipRepo.save.mockResolvedValue(makeShipment({ status: ShipmentStatus.IN_TRANSIT, assignedVolunteerId: 5 }));
      const result = await svc.updateShipmentStatusForVolunteer(1, { status: ShipmentStatus.IN_TRANSIT } as any, 5);
      expect(result).toBeDefined();
    });

    it('allows IN_TRANSIT → DELIVERED transition', async () => {
      const { svc, shipRepo } = makeService();
      shipRepo.findOne
        .mockResolvedValueOnce(makeShipment({ assignedVolunteerId: 5, status: ShipmentStatus.IN_TRANSIT }))
        .mockResolvedValueOnce(makeShipment({ assignedVolunteerId: 5, status: ShipmentStatus.IN_TRANSIT }));
      shipRepo.save.mockResolvedValue(makeShipment({ status: ShipmentStatus.DELIVERED, assignedVolunteerId: 5 }));
      const result = await svc.updateShipmentStatusForVolunteer(1, { status: ShipmentStatus.DELIVERED } as any, 5);
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when shipment not found', async () => {
      const { svc, shipRepo } = makeService();
      shipRepo.findOne.mockResolvedValue(null);
      await expect(svc.updateShipmentStatusForVolunteer(99, { status: ShipmentStatus.IN_TRANSIT } as any, 5))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when volunteer is not assigned', async () => {
      const { svc, shipRepo } = makeService();
      shipRepo.findOne.mockResolvedValue(makeShipment({ assignedVolunteerId: null }));
      await expect(svc.updateShipmentStatusForVolunteer(1, { status: ShipmentStatus.IN_TRANSIT } as any, 5))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when different volunteer', async () => {
      const { svc, shipRepo } = makeService();
      shipRepo.findOne.mockResolvedValue(makeShipment({ assignedVolunteerId: 99 }));
      await expect(svc.updateShipmentStatusForVolunteer(1, { status: ShipmentStatus.IN_TRANSIT } as any, 5))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException for invalid transition', async () => {
      const { svc, shipRepo } = makeService();
      shipRepo.findOne.mockResolvedValue(makeShipment({ assignedVolunteerId: 5, status: ShipmentStatus.PENDING }));
      await expect(svc.updateShipmentStatusForVolunteer(1, { status: ShipmentStatus.DELIVERED } as any, 5))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('createShipmentLocationUpdate', () => {
    it('saves location and emits event', async () => {
      const { svc, eventEmitter } = makeService();
      const result = await svc.createShipmentLocationUpdate({ shipmentId: 1, lat: 4.6, lng: -74.0, updatedBy: 1 });
      expect(result).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith('shipment.location.changed', expect.any(Object));
    });

    it('uses provided optional params', async () => {
      const { svc } = makeService();
      const result = await svc.createShipmentLocationUpdate({
        shipmentId: 1, lat: 4.6, lng: -74.0, speed: 10, heading: 90,
        recordedAt: new Date(), updatedBy: 1,
      });
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when shipment not found', async () => {
      const { svc, shipRepo } = makeService();
      shipRepo.findOne.mockResolvedValue(null);
      await expect(svc.createShipmentLocationUpdate({ shipmentId: 99, lat: 4.6, lng: -74.0, updatedBy: 1 }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('findShipmentLatestLocation', () => {
    it('returns latest location', async () => {
      const { svc } = makeService();
      const result = await svc.findShipmentLatestLocation(1);
      expect(result).toBeDefined();
    });

    it('returns null when no location exists', async () => {
      const { svc, locRepo } = makeService();
      locRepo.findOne.mockResolvedValue(null);
      const result = await svc.findShipmentLatestLocation(1);
      expect(result).toBeNull();
    });

    it('throws NotFoundException when shipment not found', async () => {
      const { svc, shipRepo } = makeService();
      shipRepo.findOne.mockResolvedValue(null);
      await expect(svc.findShipmentLatestLocation(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findShipmentLocationHistory', () => {
    it('returns location history', async () => {
      const { svc, locQb } = makeService();
      locQb.getManyAndCount.mockResolvedValue([[makeLocation()], 1]);
      const result = await svc.findShipmentLocationHistory(1, {});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('applies before filter when valid date', async () => {
      const { svc, locQb } = makeService();
      locQb.getManyAndCount.mockResolvedValue([[], 0]);
      await svc.findShipmentLocationHistory(1, { before: '2024-01-01T00:00:00Z' } as any);
      expect(locQb.andWhere).toHaveBeenCalled();
    });

    it('ignores invalid before date', async () => {
      const { svc, locQb } = makeService();
      locQb.getManyAndCount.mockResolvedValue([[], 0]);
      await svc.findShipmentLocationHistory(1, { before: 'not-a-date' } as any);
      expect(locQb.andWhere).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when shipment not found', async () => {
      const { svc, shipRepo } = makeService();
      shipRepo.findOne.mockResolvedValue(null);
      await expect(svc.findShipmentLocationHistory(99, {})).rejects.toThrow(NotFoundException);
    });
  });
});
