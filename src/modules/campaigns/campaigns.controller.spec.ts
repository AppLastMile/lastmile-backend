import { CampaignsController } from './campaigns.controller';

const makeService = () => ({
  create: jest.fn().mockResolvedValue({ id: 1 }),
  findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
  findOneById: jest.fn().mockResolvedValue({ id: 1 }),
  getItemsSummary: jest
    .fn()
    .mockResolvedValue({ campaignId: 1, items: [], updatedAt: new Date() }),
  update: jest.fn().mockResolvedValue({ id: 1 }),
  remove: jest.fn().mockResolvedValue(undefined),
});

describe('CampaignsController', () => {
  let controller: CampaignsController;
  let service: ReturnType<typeof makeService>;

  beforeEach(() => {
    service = makeService();
    controller = new CampaignsController(service as any);
  });

  it('create() delegates to service', async () => {
    const dto = { name: 'Camp' } as any;
    await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll() delegates to service', async () => {
    await controller.findAll({} as any);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('findByEvent() adds eventId to query', async () => {
    await controller.findByEvent(5, { page: 1 } as any);
    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 5 }),
    );
  });

  it('findOne() delegates to service', async () => {
    await controller.findOne(1);
    expect(service.findOneById).toHaveBeenCalledWith(1);
  });

  it('getItemsSummary() delegates to service', async () => {
    await controller.getItemsSummary(1);
    expect(service.getItemsSummary).toHaveBeenCalledWith(1);
  });

  it('update() delegates to service', async () => {
    const dto = { name: 'New' } as any;
    await controller.update(1, dto);
    expect(service.update).toHaveBeenCalledWith(1, dto);
  });

  it('remove() delegates to service', async () => {
    await controller.remove(1);
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
