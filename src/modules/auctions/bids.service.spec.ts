import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { Product } from '../products/entities/product.entity';
import { CreateBidDto } from './dto/create-bid.dto';
import { AuctionBuyIdempotencyRecord } from './entities/auction-buy-idempotency-record.entity';
import { Bid } from './entities/bid.entity';
import { Auction, AuctionStatus } from './entities/auction.entity';
import { AuctionsService } from './auctions.service';

// ─── helpers ────────────────────────────────────────────────────────────────

function buildAuction(overrides: Partial<Auction> = {}): Auction {
  return {
    id: 1,
    productId: 1,
    campaignId: null,
    sellerId: 5,
    itemName: 'Humanitarian Kit',
    description: null,
    initialPrice: 100,
    currentPrice: 100,
    currency: 'COP',
    durationMinutes: 60,
    status: AuctionStatus.ACTIVE,
    buyerId: null,
    startedAt: new Date(),
    endAt: new Date(Date.now() + 60 * 60 * 1000),
    soldAt: null,
    version: 1,
    createdAt: new Date(),
    ...overrides,
  } as Auction;
}

function buildBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: 10,
    auctionId: 1,
    userId: 7,
    amount: 150,
    createdAt: new Date(),
    ...overrides,
  } as Bid;
}

function buildCreateBidDto(
  overrides: Partial<CreateBidDto> = {},
): CreateBidDto {
  return { userId: 7, amount: 150, ...overrides };
}

// ─── mock factories ──────────────────────────────────────────────────────────

/**
 * Returns a mock DataSource that executes the transaction callback
 * using an in-memory manager built from provided repo mocks.
 */
function buildMockDataSource(
  auctionFindOne: jest.Mock,
  auctionUpdate: jest.Mock,
  bidSave: jest.Mock,
  bidCreate: jest.Mock,
) {
  return {
    transaction: jest
      .fn()
      .mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const manager = {
            getRepository: (entity: unknown) => {
              if (entity === Auction) {
                return { findOne: auctionFindOne, update: auctionUpdate };
              }
              if (entity === Bid) {
                return { create: bidCreate, save: bidSave };
              }
              return {};
            },
          };
          return cb(manager);
        },
      ),
  };
}

// ─── test suite ─────────────────────────────────────────────────────────────

describe('AuctionsService — placeBid', () => {
  let service: AuctionsService;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  // per-test mocks so we can configure them individually
  let auctionFindOne: jest.Mock;
  let auctionUpdate: jest.Mock;
  let bidSave: jest.Mock;
  let bidCreate: jest.Mock;

  beforeEach(async () => {
    auctionFindOne = jest.fn();
    auctionUpdate = jest.fn().mockResolvedValue(undefined);
    bidCreate = jest.fn().mockImplementation((data) => data);
    bidSave = jest.fn().mockImplementation(async (b) => ({
      ...b,
      id: 10,
      createdAt: new Date(),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionsService,
        {
          provide: getRepositoryToken(Auction),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Product),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Campaign),
          useValue: { findOne: jest.fn() },
        },
        { provide: getRepositoryToken(Bid), useValue: {} },
        {
          provide: getRepositoryToken(AuctionBuyIdempotencyRecord),
          useValue: {},
        },
        {
          provide: getDataSourceToken(),
          useValue: buildMockDataSource(
            auctionFindOne,
            auctionUpdate,
            bidSave,
            bidCreate,
          ),
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuctionsService>(AuctionsService);
    eventEmitter = module.get(EventEmitter2);
  });

  // ── CA1 — Register bid ──────────────────────────────────────────────────

  describe('CA1 — bid is registered when auction is active', () => {
    it('saves the bid and returns it with updated auction price', async () => {
      auctionFindOne.mockResolvedValue(buildAuction({ currentPrice: 100 }));

      const result = await service.placeBid(
        1,
        buildCreateBidDto({ amount: 150 }),
      );

      expect(bidSave).toHaveBeenCalledTimes(1);
      expect(result.amount).toBe(150);
      expect(result.auctionId).toBe(1);
    });

    it('emits bid.placed event after saving', async () => {
      auctionFindOne.mockResolvedValue(buildAuction({ currentPrice: 100 }));

      await service.placeBid(1, buildCreateBidDto({ amount: 200 }));

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'bid.placed',
        expect.objectContaining({
          auctionId: 1,
          amount: 200,
        }),
      );
    });
  });

  // ── CA2 — Bid validation ────────────────────────────────────────────────

  describe('CA2 — bid is rejected when amount is not greater than current price', () => {
    it('rejects a bid equal to the current price', async () => {
      auctionFindOne.mockResolvedValue(buildAuction({ currentPrice: 100 }));

      await expect(
        service.placeBid(1, buildCreateBidDto({ amount: 100 })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a bid lower than the current price', async () => {
      auctionFindOne.mockResolvedValue(buildAuction({ currentPrice: 100 }));

      await expect(
        service.placeBid(1, buildCreateBidDto({ amount: 50 })),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a bid strictly greater than the current price', async () => {
      auctionFindOne.mockResolvedValue(buildAuction({ currentPrice: 100 }));

      await expect(
        service.placeBid(1, buildCreateBidDto({ amount: 101 })),
      ).resolves.not.toThrow();
    });
  });

  // ── CA3 — Price update ──────────────────────────────────────────────────

  describe('CA3 — current price is updated after a valid bid', () => {
    it('updates the auction currentPrice to the new bid amount', async () => {
      auctionFindOne.mockResolvedValue(buildAuction({ currentPrice: 100 }));

      const result = await service.placeBid(
        1,
        buildCreateBidDto({ amount: 250 }),
      );

      expect(auctionUpdate).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ currentPrice: 250 }),
      );
      expect(result.currentAuctionPrice).toBe(250);
    });

    it('increments the auction version on each bid (optimistic lock)', async () => {
      auctionFindOne.mockResolvedValue(buildAuction({ currentPrice: 100 }));

      await service.placeBid(1, buildCreateBidDto({ amount: 200 }));

      const updateCall = auctionUpdate.mock.calls[0][1];
      expect(updateCall).toHaveProperty('version');
    });
  });

  // ── Error cases ─────────────────────────────────────────────────────────

  describe('Error cases', () => {
    it('throws NotFoundException when auction does not exist', async () => {
      auctionFindOne.mockResolvedValue(null);

      await expect(service.placeBid(999, buildCreateBidDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when auction is in CREATED state', async () => {
      auctionFindOne.mockResolvedValue(
        buildAuction({ status: AuctionStatus.CREATED }),
      );

      await expect(service.placeBid(1, buildCreateBidDto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when auction is CLOSED', async () => {
      auctionFindOne.mockResolvedValue(
        buildAuction({ status: AuctionStatus.CLOSED }),
      );

      await expect(service.placeBid(1, buildCreateBidDto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when auction is SOLD', async () => {
      auctionFindOne.mockResolvedValue(
        buildAuction({ status: AuctionStatus.SOLD }),
      );

      await expect(service.placeBid(1, buildCreateBidDto())).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
