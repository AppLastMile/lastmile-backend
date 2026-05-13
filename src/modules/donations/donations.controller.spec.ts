import { DonationsController } from './donations.controller';
import { DonationItemStatus } from './entities/donation-item.entity';

const makeService = () => ({
  createMoneyDonation: jest.fn().mockResolvedValue({ id: 1 }),
  findMoneyDonations: jest.fn().mockResolvedValue({ data: [], meta: {} }),
  findMoneyDonationById: jest.fn().mockResolvedValue({ id: 1 }),
  createItemDonation: jest.fn().mockResolvedValue({ id: 1 }),
  findItemDonations: jest.fn().mockResolvedValue({ data: [], meta: {} }),
  findItemDonationById: jest.fn().mockResolvedValue({ id: 1 }),
  updateItemDonationStatus: jest.fn().mockResolvedValue({ id: 1 }),
});

describe('DonationsController', () => {
  let controller: DonationsController;
  let service: ReturnType<typeof makeService>;

  beforeEach(() => {
    service = makeService();
    controller = new DonationsController(service as any);
  });

  it('createMoneyDonation() delegates to service', async () => {
    const dto = { campaignId: 1, donorId: 1, amount: 100 } as any;
    await controller.createMoneyDonation(dto);
    expect(service.createMoneyDonation).toHaveBeenCalledWith(dto);
  });

  it('findMoneyDonations() delegates to service', async () => {
    await controller.findMoneyDonations({} as any);
    expect(service.findMoneyDonations).toHaveBeenCalled();
  });

  it('findMoneyDonationById() delegates to service', async () => {
    await controller.findMoneyDonationById(1);
    expect(service.findMoneyDonationById).toHaveBeenCalledWith(1);
  });

  it('createItemDonation() delegates to service', async () => {
    const dto = {
      campaignId: 1,
      donorId: 1,
      itemName: 'water',
      quantity: 5,
    } as any;
    await controller.createItemDonation(dto);
    expect(service.createItemDonation).toHaveBeenCalledWith(dto);
  });

  it('findItemDonations() delegates to service', async () => {
    await controller.findItemDonations({} as any);
    expect(service.findItemDonations).toHaveBeenCalled();
  });

  it('findItemDonationById() delegates to service', async () => {
    await controller.findItemDonationById(1);
    expect(service.findItemDonationById).toHaveBeenCalledWith(1);
  });

  it('updateItemDonationStatus() delegates to service', async () => {
    const dto = { status: DonationItemStatus.DELIVERED_TO_PICKUP_POINT };
    await controller.updateItemDonationStatus(1, dto);
    expect(service.updateItemDonationStatus).toHaveBeenCalledWith(1, dto);
  });
});
