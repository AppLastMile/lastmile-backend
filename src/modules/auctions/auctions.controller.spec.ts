import { AuctionsController } from './auctions.controller';

const makeService = () => ({
  createAuction: jest.fn().mockResolvedValue({ id: 1 }),
  findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
  findOne: jest.fn().mockResolvedValue({ id: 1 }),
  findBidsByAuction: jest.fn().mockResolvedValue([]),
  startAuction: jest.fn().mockResolvedValue({ id: 1 }),
  placeBid: jest.fn().mockResolvedValue({ id: 1 }),
  buyAuction: jest.fn().mockResolvedValue({ id: 1 }),
});

describe('AuctionsController', () => {
  let controller: AuctionsController;
  let service: ReturnType<typeof makeService>;

  beforeEach(() => {
    service = makeService();
    controller = new AuctionsController(service as any);
  });

  it('createAuction() delegates to service with userId', async () => {
    const dto = { campaignId: 1, price: 100 } as any;
    const user = { userId: 5, role: 'organizer' } as any;
    await controller.createAuction(dto, user);
    expect(service.createAuction).toHaveBeenCalledWith(dto, 5);
  });

  it('findAll() delegates to service', async () => {
    await controller.findAll({} as any);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('findOne() delegates to service', async () => {
    await controller.findOne(1);
    expect(service.findOne).toHaveBeenCalledWith(1);
  });

  it('findBids() delegates to service', async () => {
    await controller.findBids(1);
    expect(service.findBidsByAuction).toHaveBeenCalledWith(1);
  });

  it('startAuction() delegates to service', async () => {
    await controller.startAuction(1);
    expect(service.startAuction).toHaveBeenCalledWith(1);
  });

  it('placeBid() delegates to service', async () => {
    const dto = { amount: 50, userId: 2 } as any;
    await controller.placeBid(1, dto);
    expect(service.placeBid).toHaveBeenCalledWith(1, dto);
  });

  it('buyAuction() delegates to service', async () => {
    const dto = { buyerId: 2 } as any;
    await controller.buyAuction(1, dto);
    expect(service.buyAuction).toHaveBeenCalledWith(1, dto);
  });
});
