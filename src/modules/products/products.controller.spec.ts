import { ProductsController } from './products.controller';

const makeService = () => ({
  create: jest.fn().mockResolvedValue({ id: 1 }),
  findAll: jest.fn().mockResolvedValue([{ id: 1 }]),
  findById: jest.fn().mockResolvedValue({ id: 1 }),
});

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ReturnType<typeof makeService>;

  beforeEach(() => {
    service = makeService();
    controller = new ProductsController(service as any);
  });

  it('create() delegates to service', async () => {
    const dto = { name: 'Laptop', createdBy: 1 } as any;
    await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll() delegates to service', async () => {
    await controller.findAll();
    expect(service.findAll).toHaveBeenCalled();
  });

  it('findOne() delegates to service', async () => {
    await controller.findOne(1);
    expect(service.findById).toHaveBeenCalledWith(1);
  });
});
