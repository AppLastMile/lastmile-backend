import { EventsController } from './events.controller';

const makeService = () => ({
  create: jest.fn().mockResolvedValue({ id: 1 }),
  findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
  findOneById: jest.fn().mockResolvedValue({ id: 1 }),
  update: jest.fn().mockResolvedValue({ id: 1 }),
  remove: jest.fn().mockResolvedValue(undefined),
});

const makeEventSupport = () => ({
  joinEvent: jest.fn(),
  leaveEvent: jest.fn(),
  getSupportersCount: jest.fn().mockReturnValue(5),
});

describe('EventsController', () => {
  let controller: EventsController;
  let service: ReturnType<typeof makeService>;
  let support: ReturnType<typeof makeEventSupport>;

  beforeEach(() => {
    service = makeService();
    support = makeEventSupport();
    controller = new EventsController(service as any, support as any);
  });

  it('create() delegates to service', async () => {
    const dto = {
      name: 'Flood',
      disasterType: 'flood',
      city: 'Bogota',
      description: 'd',
      date: '2025-01-01',
      createdBy: 1,
    } as any;
    await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll() delegates to service', async () => {
    await controller.findAll({} as any);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('findOne() delegates to service', async () => {
    await controller.findOne(1);
    expect(service.findOneById).toHaveBeenCalledWith(1);
  });

  it('update() delegates to service', async () => {
    await controller.update(1, { name: 'Updated' } as any);
    expect(service.update).toHaveBeenCalledWith(1, { name: 'Updated' });
  });

  it('joinEvent() calls support service and returns success', () => {
    const result = controller.joinEvent(10, { userId: 2, role: 'volunteer' });
    expect(support.joinEvent).toHaveBeenCalledWith(10, 2);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ eventId: 10, userId: 2 });
  });

  it('leaveEvent() calls support service and returns success', () => {
    const result = controller.leaveEvent(10, { userId: 2, role: 'volunteer' });
    expect(support.leaveEvent).toHaveBeenCalledWith(10, 2);
    expect(result.success).toBe(true);
  });

  it('supportersCount() returns count', () => {
    const result = controller.supportersCount(10);
    expect(result.data.supportersCount).toBe(5);
    expect(support.getSupportersCount).toHaveBeenCalledWith(10);
  });

  it('remove() delegates to service', async () => {
    await controller.remove(1);
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
