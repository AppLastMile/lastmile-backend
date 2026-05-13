import { LogisticsController } from './logistics.controller';
import { ShipmentStatus } from './entities/shipment.entity';

const makeService = () => ({
  createPickupPoint: jest.fn().mockResolvedValue({ id: 1 }),
  findPickupPoints: jest.fn().mockResolvedValue({ data: [], meta: {} }),
  findPickupPointById: jest.fn().mockResolvedValue({ id: 1 }),
  updatePickupPoint: jest.fn().mockResolvedValue({ id: 1 }),
  createShipment: jest.fn().mockResolvedValue({ id: 1 }),
  findShipments: jest.fn().mockResolvedValue({ data: [], meta: {} }),
  findShipmentById: jest.fn().mockResolvedValue({ id: 1 }),
  findShipmentLatestLocation: jest.fn().mockResolvedValue(null),
  findShipmentLocationHistory: jest.fn().mockResolvedValue({ data: [], meta: {} }),
  assignVolunteer: jest.fn().mockResolvedValue({ id: 1 }),
  updateShipmentStatusForVolunteer: jest.fn().mockResolvedValue({ id: 1 }),
});

describe('LogisticsController', () => {
  let controller: LogisticsController;
  let service: ReturnType<typeof makeService>;

  beforeEach(() => {
    service = makeService();
    controller = new LogisticsController(service as any);
  });

  it('createPickupPoint() delegates to service', async () => {
    const dto = { name: 'PP', city: 'Bogotá', address: 'Calle 1' } as any;
    await controller.createPickupPoint(dto);
    expect(service.createPickupPoint).toHaveBeenCalledWith(dto);
  });

  it('findPickupPoints() delegates to service', async () => {
    await controller.findPickupPoints({} as any);
    expect(service.findPickupPoints).toHaveBeenCalled();
  });

  it('findPickupPointById() delegates to service', async () => {
    await controller.findPickupPointById(1);
    expect(service.findPickupPointById).toHaveBeenCalledWith(1);
  });

  it('updatePickupPoint() delegates to service', async () => {
    await controller.updatePickupPoint(1, {} as any);
    expect(service.updatePickupPoint).toHaveBeenCalledWith(1, {});
  });

  it('createShipment() delegates to service', async () => {
    const dto = { campaignId: 1, pickupPointId: 1 } as any;
    await controller.createShipment(dto);
    expect(service.createShipment).toHaveBeenCalledWith(dto);
  });

  it('findShipments() passes query to service', async () => {
    const query = { campaignId: 1 } as any;
    const user = { userId: 5, role: 'organizer' } as any;
    await controller.findShipments(query, user);
    expect(service.findShipments).toHaveBeenCalledWith(query);
  });

  it('findShipments() replaces "me" with userId when assignedVolunteerId is "me"', async () => {
    const query = { assignedVolunteerId: 'me' } as any;
    const user = { userId: 7, role: 'volunteer' } as any;
    await controller.findShipments(query, user);
    expect(service.findShipments).toHaveBeenCalledWith({ assignedVolunteerId: 7 });
  });

  it('findShipmentById() delegates to service', async () => {
    await controller.findShipmentById(1);
    expect(service.findShipmentById).toHaveBeenCalledWith(1);
  });

  it('findShipmentLatestLocation() delegates to service', async () => {
    await controller.findShipmentLatestLocation(1);
    expect(service.findShipmentLatestLocation).toHaveBeenCalledWith(1);
  });

  it('findShipmentLocationHistory() delegates to service', async () => {
    await controller.findShipmentLocationHistory(1, {} as any);
    expect(service.findShipmentLocationHistory).toHaveBeenCalledWith(1, {});
  });

  it('assignVolunteer() delegates to service', async () => {
    const dto = { volunteerId: 5 } as any;
    await controller.assignVolunteer(1, dto);
    expect(service.assignVolunteer).toHaveBeenCalledWith(1, dto);
  });

  it('updateShipmentStatus() delegates to service with userId', async () => {
    const dto = { status: ShipmentStatus.IN_TRANSIT } as any;
    const user = { userId: 3, role: 'volunteer' } as any;
    await controller.updateShipmentStatus(1, dto, user);
    expect(service.updateShipmentStatusForVolunteer).toHaveBeenCalledWith(1, dto, 3);
  });
});
