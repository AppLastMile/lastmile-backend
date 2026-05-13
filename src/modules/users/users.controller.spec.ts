import { UsersController } from './users.controller';

const makeService = () => ({
  create: jest.fn().mockResolvedValue({ id: 1 }),
  findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
  findOneById: jest.fn().mockResolvedValue({ id: 1 }),
  update: jest.fn().mockResolvedValue({ id: 1 }),
  remove: jest.fn().mockResolvedValue(undefined),
});

const makeEventSupport = () => ({
  getUserEventIds: jest.fn().mockReturnValue([1, 2]),
});

describe('UsersController', () => {
  let controller: UsersController;
  let service: ReturnType<typeof makeService>;
  let eventSupport: ReturnType<typeof makeEventSupport>;

  beforeEach(() => {
    service = makeService();
    eventSupport = makeEventSupport();
    controller = new UsersController(service as any, eventSupport as any);
  });

  it('create() delegates to service', async () => {
    const dto = {
      name: 'Alice',
      email: 'a@b.com',
      password: 'p',
      role: 'volunteer',
    } as any;
    await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll() delegates to service', async () => {
    await controller.findAll({} as any);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('myEvents() returns event ids for authenticated user', () => {
    const result = controller.myEvents({ userId: 1, role: 'volunteer' });
    expect(result.success).toBe(true);
    expect(result.data.eventIds).toEqual([1, 2]);
    expect(eventSupport.getUserEventIds).toHaveBeenCalledWith(1);
  });

  it('findOne() delegates to service', async () => {
    await controller.findOne(1);
    expect(service.findOneById).toHaveBeenCalledWith(1);
  });

  it('update() delegates to service', async () => {
    const dto = { name: 'Bob' } as any;
    await controller.update(1, dto);
    expect(service.update).toHaveBeenCalledWith(1, dto);
  });

  it('remove() delegates to service', async () => {
    await controller.remove(1);
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
