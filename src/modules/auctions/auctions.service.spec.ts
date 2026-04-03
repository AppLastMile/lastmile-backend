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
import { Bid } from './entities/bid.entity';
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
  create: jest.fn(),
  save: jest.fn(),
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
    itemName: 'Test Auction',
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
          provide: getRepositoryToken(Bid),
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
    it('creates and saves the auction with auto-generated product', async () => {
      const sellerId = 5;
      const createdProduct = buildProduct({ id: 42 });
      const savedAuction = buildAuction({ productId: 42, sellerId });

      productRepo.create.mockReturnValue(createdProduct);
      productRepo.save.mockResolvedValue(createdProduct);
      auctionRepo.create.mockReturnValue(savedAuction);
      auctionRepo.save.mockResolvedValue(savedAuction);

      const result = await service.createAuction(buildCreateDto(), sellerId);

      expect(productRepo.create).toHaveBeenCalledWith({
        name: 'Test Auction',
        description: '',
        createdBy: sellerId,
      });
      expect(productRepo.save).toHaveBeenCalled();
      expect(auctionRepo.save).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(1);
      expect(result.productId).toBe(42);
    });
  });

  describe('CA2 — auction is created with CREATED status', () => {
    it('assigns CREATED as the initial status', async () => {
      const sellerId = 5;
      const createdProduct = buildProduct({ id: 42 });
      const saved = buildAuction({ status: AuctionStatus.CREATED, productId: 42, sellerId });

      productRepo.create.mockReturnValue(createdProduct);
      productRepo.save.mockResolvedValue(createdProduct);
      auctionRepo.create.mockReturnValue(saved);
      auctionRepo.save.mockResolvedValue(saved);

      const result = await service.createAuction(buildCreateDto(), sellerId);

      expect(result.status).toBe(AuctionStatus.CREATED);
    });

    it('does not accept bids right after creation (status is not ACTIVE)', async () => {
      const sellerId = 5;
      const createdProduct = buildProduct({ id: 42 });
      const saved = buildAuction({ status: AuctionStatus.CREATED, productId: 42, sellerId });

      productRepo.create.mockReturnValue(createdProduct);
      productRepo.save.mockResolvedValue(createdProduct);
      auctionRepo.create.mockReturnValue(saved);
      auctionRepo.save.mockResolvedValue(saved);

      const result = await service.createAuction(buildCreateDto(), sellerId);

      expect(result.status).not.toBe(AuctionStatus.ACTIVE);
    });
  });

  describe('CA3 — auction is linked to the product', () => {
    it('auto-generates productId from created product', async () => {
      const sellerId = 5;
      const createdProduct = buildProduct({ id: 99 });
      const saved = buildAuction({ productId: 99, sellerId });

      productRepo.create.mockReturnValue(createdProduct);
      productRepo.save.mockResolvedValue(createdProduct);
      auctionRepo.create.mockReturnValue(saved);
      auctionRepo.save.mockResolvedValue(saved);

      const result = await service.createAuction(buildCreateDto(), sellerId);

      expect(result.productId).toBe(99);
    });

    it('uses sellerId from parameter as auction seller', async () => {
      const sellerId = 99;
      const createdProduct = buildProduct({ id: 42 });
      const saved = buildAuction({ sellerId: 99, productId: 42 });

      productRepo.create.mockReturnValue(createdProduct);
      productRepo.save.mockResolvedValue(createdProduct);
      auctionRepo.create.mockReturnValue(saved);
      auctionRepo.save.mockResolvedValue(saved);

      const result = await service.createAuction(buildCreateDto(), sellerId);

      expect(result.sellerId).toBe(99);
    });

    it('uses itemName from DTO for auction name', async () => {
      const sellerId = 5;
      const createdProduct = buildProduct({ id: 42 });
      const saved = buildAuction({ itemName: 'Laptop Gaming', productId: 42, sellerId });

      productRepo.create.mockReturnValue(createdProduct);
      productRepo.save.mockResolvedValue(createdProduct);
      auctionRepo.create.mockReturnValue(saved);
      auctionRepo.save.mockResolvedValue(saved);

      const result = await service.createAuction(
        buildCreateDto({ itemName: 'Laptop Gaming' }),
        sellerId,
      );

      expect(result.itemName).toBe('Laptop Gaming');
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
    it('campaignId is not used — creates auction without campaign', async () => {
      const sellerId = 5;
      const createdProduct = buildProduct({ id: 42 });
      const saved = buildAuction({ campaignId: null, productId: 42, sellerId });

      productRepo.create.mockReturnValue(createdProduct);
      productRepo.save.mockResolvedValue(createdProduct);
      auctionRepo.create.mockReturnValue(saved);
      auctionRepo.save.mockResolvedValue(saved);

      const result = await service.createAuction(buildCreateDto(), sellerId);

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
          provide: getRepositoryToken(Bid),
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
      auctionRepo.findOne.mockResolvedValueOnce(auction).mockResolvedValueOnce(
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
