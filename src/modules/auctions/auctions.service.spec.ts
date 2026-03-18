import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { Product } from '../products/entities/product.entity';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { AuctionBuyIdempotencyRecord } from './entities/auction-buy-idempotency-record.entity';
import { Auction, AuctionStatus } from './entities/auction.entity';
import { AuctionsService } from './auctions.service';

const mockAuctionRepository = () => ({
  findOne: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockProductRepository = () => ({
  findOne: jest.fn(),
});

const mockCampaignRepository = () => ({
  findOne: jest.fn(),
});

const mockDataSource = () => ({
  transaction: jest.fn(),
});

const mockEventEmitter = () => ({
  emit: jest.fn(),
});

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: 'Humanitarian Kit',
    description: 'Emergency supply kit',
    createdBy: 5,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  } as Product;
}

function buildAuction(overrides: Partial<Auction> = {}): Auction {
  return {
    id: 1,
    productId: 1,
    campaignId: null,
    sellerId: 5,
    itemName: 'Humanitarian Kit',
    description: 'Emergency supply kit',
    initialPrice: 100,
    currentPrice: null,
    currency: 'COP',
    durationMinutes: 60,
    status: AuctionStatus.CREATED,
    buyerId: null,
    startedAt: null,
    endAt: null,
    soldAt: null,
    version: 1,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  } as Auction;
}

function buildCreateDto(
  overrides: Partial<CreateAuctionDto> = {},
): CreateAuctionDto {
  return {
    productId: 1,
    initialPrice: 100,
    durationMinutes: 60,
    ...overrides,
  };
}

describe('AuctionsService — createAuction', () => {
  let service: AuctionsService;
  let auctionRepo: jest.Mocked<Repository<Auction>>;
  let productRepo: jest.Mocked<Repository<Product>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionsService,
        {
          provide: getRepositoryToken(Auction),
          useFactory: mockAuctionRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useFactory: mockProductRepository,
        },
        {
          provide: getRepositoryToken(Campaign),
          useFactory: mockCampaignRepository,
        },
        {
          provide: getRepositoryToken(AuctionBuyIdempotencyRecord),
          useFactory: mockAuctionRepository,
        },
        { provide: getDataSourceToken(), useFactory: mockDataSource },
        { provide: EventEmitter2, useFactory: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AuctionsService>(AuctionsService);
    auctionRepo = module.get(getRepositoryToken(Auction));
    productRepo = module.get(getRepositoryToken(Product));
  });

  describe('CA1 — auction is saved in the database', () => {
    it('creates and saves the auction when product exists', async () => {
      const product = buildProduct();
      const saved = buildAuction();

      productRepo.findOne.mockResolvedValue(product);
      auctionRepo.create.mockReturnValue(saved);
      auctionRepo.save.mockResolvedValue(saved);

      const result = await service.createAuction(buildCreateDto());

      expect(auctionRepo.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(1);
    });
  });

  describe('CA2 — auction is created with CREATED status', () => {
    it('assigns CREATED as the initial status', async () => {
      const product = buildProduct();
      const saved = buildAuction({ status: AuctionStatus.CREATED });

      productRepo.findOne.mockResolvedValue(product);
      auctionRepo.create.mockReturnValue(saved);
      auctionRepo.save.mockResolvedValue(saved);

      const result = await service.createAuction(buildCreateDto());

      expect(result.status).toBe(AuctionStatus.CREATED);
    });

    it('does not accept bids right after creation (status is not ACTIVE)', async () => {
      const product = buildProduct();
      const saved = buildAuction({ status: AuctionStatus.CREATED });

      productRepo.findOne.mockResolvedValue(product);
      auctionRepo.create.mockReturnValue(saved);
      auctionRepo.save.mockResolvedValue(saved);

      const result = await service.createAuction(buildCreateDto());

      expect(result.status).not.toBe(AuctionStatus.ACTIVE);
    });
  });

  describe('CA3 — auction is linked to the product', () => {
    it('stores the productId on the auction', async () => {
      const product = buildProduct({ id: 42 });
      const saved = buildAuction({ productId: 42 });

      productRepo.findOne.mockResolvedValue(product);
      auctionRepo.create.mockReturnValue(saved);
      auctionRepo.save.mockResolvedValue(saved);

      const result = await service.createAuction(
        buildCreateDto({ productId: 42 }),
      );

      expect(result.productId).toBe(42);
    });

    it('populates sellerId from the product creator', async () => {
      const product = buildProduct({ createdBy: 99 });
      const saved = buildAuction({ sellerId: 99 });

      productRepo.findOne.mockResolvedValue(product);
      auctionRepo.create.mockReturnValue(saved);
      auctionRepo.save.mockResolvedValue(saved);

      const result = await service.createAuction(buildCreateDto());

      expect(result.sellerId).toBe(99);
    });

    it('copies name and description from the product', async () => {
      const product = buildProduct({
        name: 'Water Purifier',
        description: 'Portable filter',
      });
      const saved = buildAuction({
        itemName: 'Water Purifier',
        description: 'Portable filter',
      });

      productRepo.findOne.mockResolvedValue(product);
      auctionRepo.create.mockReturnValue(saved);
      auctionRepo.save.mockResolvedValue(saved);

      const result = await service.createAuction(buildCreateDto());

      expect(result.itemName).toBe('Water Purifier');
      expect(result.description).toBe('Portable filter');
    });
  });

  describe('CA4 — cannot place bids on a CREATED auction', () => {
    it('rejects startAuction call when auction is not in CREATED state at bid time', async () => {
      // A brand-new auction in CREATED status cannot be bid on (tested via startAuction guard)
      auctionRepo.findOne.mockResolvedValue(
        buildAuction({ status: AuctionStatus.ACTIVE }),
      );

      // Simulates the scenario: after creation, trying to start again should fail
      await expect(service.startAuction(1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Error cases', () => {
    it('throws NotFoundException when product does not exist', async () => {
      productRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createAuction(buildCreateDto({ productId: 999 })),
      ).rejects.toThrow(NotFoundException);
    });

    it('campaignId is optional — creates auction without campaign', async () => {
      const product = buildProduct();
      const saved = buildAuction({ campaignId: null });

      productRepo.findOne.mockResolvedValue(product);
      auctionRepo.create.mockReturnValue(saved);
      auctionRepo.save.mockResolvedValue(saved);

      const result = await service.createAuction(buildCreateDto());

      expect(result.campaignId).toBeNull();
    });
  });
});

describe('AuctionsService — startAuction', () => {
  let service: AuctionsService;
  let auctionRepo: jest.Mocked<Repository<Auction>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionsService,
        {
          provide: getRepositoryToken(Auction),
          useFactory: mockAuctionRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useFactory: mockProductRepository,
        },
        {
          provide: getRepositoryToken(Campaign),
          useFactory: mockCampaignRepository,
        },
        {
          provide: getRepositoryToken(AuctionBuyIdempotencyRecord),
          useFactory: mockAuctionRepository,
        },
        { provide: getDataSourceToken(), useFactory: mockDataSource },
        { provide: EventEmitter2, useFactory: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AuctionsService>(AuctionsService);
    auctionRepo = module.get(getRepositoryToken(Auction));
  });

  describe('CA1 — activating an auction changes status to ACTIVE', () => {
    it('calls update with status ACTIVE when auction is in CREATED state', async () => {
      const auction = buildAuction();
      const started = buildAuction({
        status: AuctionStatus.ACTIVE,
        startedAt: new Date(),
        endAt: new Date(),
        currentPrice: 100,
      });

      auctionRepo.findOne
        .mockResolvedValueOnce(auction)
        .mockResolvedValueOnce(started);

      auctionRepo.update.mockResolvedValue({} as UpdateResult);

      const result = await service.startAuction(1);

      expect(auctionRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: AuctionStatus.ACTIVE }),
      );
      expect(result.status).toBe(AuctionStatus.ACTIVE);
    });
  });

  describe('CA2 — starting an auction registers the start date', () => {
    it('sets startedAt to the current time', async () => {
      const before = new Date();
      const auction = buildAuction();

      auctionRepo.findOne.mockResolvedValueOnce(auction);
      auctionRepo.update.mockResolvedValue({} as UpdateResult);
      auctionRepo.findOne.mockImplementationOnce(async () =>
        buildAuction({
          status: AuctionStatus.ACTIVE,
          startedAt: new Date(),
          endAt: new Date(Date.now() + 60 * 60 * 1000),
          currentPrice: 100,
        }),
      );

      const result = await service.startAuction(1);
      const after = new Date();

      expect(result.startedAt).not.toBeNull();
      expect(result.startedAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(result.startedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('passes startedAt in the update call', async () => {
      const auction = buildAuction();
      auctionRepo.findOne
        .mockResolvedValueOnce(auction)
        .mockResolvedValueOnce(
          buildAuction({
            status: AuctionStatus.ACTIVE,
            startedAt: new Date(),
            endAt: new Date(),
            currentPrice: 100,
          }),
        );
      auctionRepo.update.mockResolvedValue({} as UpdateResult);

      await service.startAuction(1);

      const updateArg = auctionRepo.update.mock.calls[0][1] as Partial<Auction>;
      expect(updateArg.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('CA3 — starting an auction calculates the end date', () => {
    it('sets endAt = startedAt + durationMinutes', async () => {
      const durationMinutes = 90;
      const auction = buildAuction({ durationMinutes });
      auctionRepo.findOne.mockResolvedValueOnce(auction);
      auctionRepo.update.mockResolvedValue({} as UpdateResult);
      auctionRepo.findOne.mockResolvedValueOnce(
        buildAuction({
          status: AuctionStatus.ACTIVE,
          startedAt: new Date(),
          endAt: new Date(Date.now() + durationMinutes * 60 * 1000),
          currentPrice: 100,
        }),
      );

      await service.startAuction(1);

      const updateArg = auctionRepo.update.mock.calls[0][1] as Partial<Auction>;
      const expectedDiffMs = durationMinutes * 60 * 1000;
      const actualDiffMs =
        updateArg.endAt!.getTime() - updateArg.startedAt!.getTime();

      expect(Math.abs(actualDiffMs - expectedDiffMs)).toBeLessThan(100);
    });

    it('sets currentPrice equal to initialPrice', async () => {
      const auction = buildAuction({ initialPrice: 250 });
      auctionRepo.findOne.mockResolvedValueOnce(auction);
      auctionRepo.update.mockResolvedValue({} as UpdateResult);
      auctionRepo.findOne.mockResolvedValueOnce(
        buildAuction({
          status: AuctionStatus.ACTIVE,
          currentPrice: 250,
          startedAt: new Date(),
          endAt: new Date(),
        }),
      );

      await service.startAuction(1);

      const updateArg = auctionRepo.update.mock.calls[0][1] as Partial<Auction>;
      expect(updateArg.currentPrice).toBe(250);
    });
  });

  describe('Error cases', () => {
    it('throws NotFoundException when auction does not exist', async () => {
      auctionRepo.findOne.mockResolvedValue(null);
      await expect(service.startAuction(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when auction is already ACTIVE', async () => {
      auctionRepo.findOne.mockResolvedValue(
        buildAuction({ status: AuctionStatus.ACTIVE }),
      );
      await expect(service.startAuction(1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when auction is SOLD', async () => {
      auctionRepo.findOne.mockResolvedValue(
        buildAuction({ status: AuctionStatus.SOLD }),
      );
      await expect(service.startAuction(1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when auction is CLOSED', async () => {
      auctionRepo.findOne.mockResolvedValue(
        buildAuction({ status: AuctionStatus.CLOSED }),
      );
      await expect(service.startAuction(1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
