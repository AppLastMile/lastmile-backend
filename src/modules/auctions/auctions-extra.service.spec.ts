import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import {
  Auction,
  AuctionBidMode,
  AuctionStatus,
} from './entities/auction.entity';
import { AuctionBuyIdempotencyRecord } from './entities/auction-buy-idempotency-record.entity';

const makeAuction = (o: any = {}): Auction =>
  ({
    id: 1,
    productId: 1,
    campaignId: null,
    sellerId: 5,
    itemName: 'Kit',
    description: '',
    initialPrice: 100 as any,
    currentPrice: 100 as any,
    currency: 'COP',
    durationMinutes: 60,
    status: AuctionStatus.ACTIVE,
    bidMode: AuctionBidMode.FREE,
    bidIncrement: null,
    buyerId: null,
    winnerId: null,
    startedAt: new Date(),
    endAt: new Date(Date.now() + 60000),
    soldAt: null,
    version: 1,
    createdAt: new Date(),
    ...o,
  }) as Auction;

const makeQb = (result: any = null) => ({
  andWhere: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  into: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  orIgnore: jest.fn().mockReturnThis(),
  execute: jest
    .fn()
    .mockResolvedValue({
      raw: [
        makeAuction({
          status: AuctionStatus.SOLD,
          buyerId: 2,
          soldAt: new Date(),
        }),
      ],
      affected: 1,
    }),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  getOne: jest.fn().mockResolvedValue(null),
});

const makeService = (repoOverrides: any = {}) => {
  const auctionQb = makeQb();
  const auctionRepo = {
    create: jest.fn((d: any) => ({ ...makeAuction(), ...d })),
    save: jest.fn(async (d: any) => ({ ...makeAuction(), ...d })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(makeAuction()),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue(auctionQb),
    ...repoOverrides.auctionRepo,
  };
  const bidQb = makeQb();
  const bidRepo = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({ id: 1, ...d, createdAt: new Date() })),
    find: jest
      .fn()
      .mockResolvedValue([
        { id: 1, auctionId: 1, userId: 2, amount: 200, createdAt: new Date() },
      ]),
    findOne: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn().mockReturnValue(bidQb),
    ...repoOverrides.bidRepo,
  };
  const productRepo = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({ id: 1, ...d })),
    ...repoOverrides.productRepo,
  };
  const campaignRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 1 }),
    ...repoOverrides.campaignRepo,
  };

  const makeManagerMock = (transactionResult: any) => ({
    getRepository: jest.fn().mockReturnValue({
      create: jest.fn((d: any) => ({ ...makeAuction(), ...d })),
      findOne: jest.fn().mockResolvedValue(transactionResult),
      save: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
    }),
    createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
  });

  const dataSource = {
    transaction: jest.fn(async (cb: any) => cb(makeManagerMock(null))),
    ...repoOverrides.dataSource,
  };

  const eventEmitter = { emit: jest.fn() };

  const svc = new AuctionsService(
    auctionRepo as any,
    bidRepo as any,
    productRepo as any,
    campaignRepo as any,
    dataSource as any,
    eventEmitter as any,
  );

  return {
    svc,
    auctionRepo,
    bidRepo,
    productRepo,
    campaignRepo,
    dataSource,
    eventEmitter,
    auctionQb,
    bidQb,
  };
};

describe('AuctionsService — extra coverage', () => {
  describe('onModuleInit', () => {
    it('schedules close for active auction with future endAt', async () => {
      const { svc, auctionRepo } = makeService();
      auctionRepo.find.mockResolvedValue([
        makeAuction({ endAt: new Date(Date.now() + 5000) }),
      ]);
      await svc.onModuleInit();
    });

    it('immediately closes auction with past endAt', async () => {
      const { svc, auctionRepo, dataSource } = makeService();
      auctionRepo.find.mockResolvedValue([
        makeAuction({ endAt: new Date(Date.now() - 1000) }),
      ]);
      await svc.onModuleInit();
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('skips auction with null endAt', async () => {
      const { svc, auctionRepo } = makeService();
      auctionRepo.find.mockResolvedValue([makeAuction({ endAt: null })]);
      await svc.onModuleInit();
    });
  });

  describe('onModuleDestroy', () => {
    it('clears all scheduled timers', async () => {
      const { svc, auctionRepo } = makeService();
      auctionRepo.find.mockResolvedValue([
        makeAuction({ endAt: new Date(Date.now() + 10000) }),
      ]);
      await svc.onModuleInit();
      svc.onModuleDestroy();
    });
  });

  describe('findAll', () => {
    it('returns paginated list', async () => {
      const { svc } = makeService();
      const result = await svc.findAll({});
      expect(result.data).toEqual([]);
    });

    it('applies productId filter', async () => {
      const { svc, auctionQb } = makeService();
      await svc.findAll({ productId: 1 } as any);
      expect(auctionQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('productId'),
        expect.any(Object),
      );
    });

    it('applies status filter when not "all"', async () => {
      const { svc, auctionQb } = makeService();
      await svc.findAll({ status: AuctionStatus.ACTIVE } as any);
      expect(auctionQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.any(Object),
      );
    });

    it('does not apply status filter when status is "all"', async () => {
      const { svc, auctionQb } = makeService();
      await svc.findAll({ status: 'all' } as any);
      expect(auctionQb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.any(Object),
      );
    });
  });

  describe('findOne', () => {
    it('returns auction when found', async () => {
      const { svc } = makeService();
      const result = await svc.findOne(1);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      const { svc, auctionRepo } = makeService();
      auctionRepo.findOne.mockResolvedValue(null);
      await expect(svc.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBidsByAuction', () => {
    it('returns bids for existing auction', async () => {
      const { svc } = makeService();
      const result = await svc.findBidsByAuction(1);
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException when auction not found', async () => {
      const { svc, auctionRepo } = makeService();
      auctionRepo.findOne.mockResolvedValue(null);
      await expect(svc.findBidsByAuction(99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createAuction — bidMode branches', () => {
    it('throws BadRequestException when FIXED_INCREMENT without bidIncrement', async () => {
      const { svc } = makeService();
      await expect(
        svc.createAuction(
          {
            itemName: 'Kit',
            initialPrice: 100,
            durationMinutes: 60,
            bidMode: AuctionBidMode.FIXED_INCREMENT,
          } as any,
          5,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates auction with FIXED_INCREMENT and bidIncrement', async () => {
      const { svc, auctionRepo } = makeService();
      auctionRepo.save.mockResolvedValue(
        makeAuction({
          bidMode: AuctionBidMode.FIXED_INCREMENT,
          bidIncrement: 10 as any,
        }),
      );
      const result = await svc.createAuction(
        {
          itemName: 'Kit',
          initialPrice: 100,
          durationMinutes: 60,
          bidMode: AuctionBidMode.FIXED_INCREMENT,
          bidIncrement: 10,
        } as any,
        5,
      );
      expect(result).toBeDefined();
    });

    it('creates auction with currency override', async () => {
      const { svc } = makeService();
      const result = await svc.createAuction(
        {
          itemName: 'Kit',
          initialPrice: 100,
          durationMinutes: 60,
          currency: 'usd',
        } as any,
        5,
      );
      expect(result).toBeDefined();
    });
  });

  describe('placeBid', () => {
    const makeTransactionManager = (auction: any, bid: any) => ({
      getRepository: jest.fn().mockImplementation((entity: any) => {
        if (entity === Auction)
          return {
            findOne: jest.fn().mockResolvedValue(auction),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          };
        return {
          create: jest.fn((d: any) => d),
          save: jest.fn(async (d: any) => ({
            id: 1,
            ...d,
            createdAt: new Date(),
          })),
        };
      }),
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
    });

    it('places bid on FREE auction', async () => {
      const { svc, dataSource, eventEmitter } = makeService();
      const auction = makeAuction({
        status: AuctionStatus.ACTIVE,
        bidMode: AuctionBidMode.FREE,
        currentPrice: 100,
      });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeTransactionManager(auction, {})),
      );
      const result = await svc.placeBid(1, { userId: 2, amount: 200 } as any);
      expect(result).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'bid.placed',
        expect.any(Object),
      );
    });

    it('places bid on FIXED_INCREMENT auction', async () => {
      const { svc, dataSource } = makeService();
      const auction = makeAuction({
        status: AuctionStatus.ACTIVE,
        bidMode: AuctionBidMode.FIXED_INCREMENT,
        currentPrice: 100,
        bidIncrement: 10,
      });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeTransactionManager(auction, {})),
      );
      const result = await svc.placeBid(1, { userId: 2 } as any);
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when auction not found in transaction', async () => {
      const { svc, dataSource } = makeService();
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeTransactionManager(null, null)),
      );
      await expect(
        svc.placeBid(99, { userId: 2, amount: 200 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when auction is not ACTIVE', async () => {
      const { svc, dataSource } = makeService();
      const auction = makeAuction({ status: AuctionStatus.CREATED });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeTransactionManager(auction, null)),
      );
      await expect(
        svc.placeBid(1, { userId: 2, amount: 200 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when bid amount is not greater than current price', async () => {
      const { svc, dataSource } = makeService();
      const auction = makeAuction({
        status: AuctionStatus.ACTIVE,
        bidMode: AuctionBidMode.FREE,
        currentPrice: 200,
      });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeTransactionManager(auction, null)),
      );
      await expect(
        svc.placeBid(1, { userId: 2, amount: 100 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when amount is missing on FREE bid auction', async () => {
      const { svc, dataSource } = makeService();
      const auction = makeAuction({
        status: AuctionStatus.ACTIVE,
        bidMode: AuctionBidMode.FREE,
        currentPrice: 100,
      });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeTransactionManager(auction, null)),
      );
      await expect(svc.placeBid(1, { userId: 2 } as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('buyAuction', () => {
    const makeIdempotencyRepo = (existing: any = null) => ({
      findOne: jest.fn().mockResolvedValue(existing),
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
    });

    const makeBuyManager = (
      soldRaw: any,
      idempotencyExisting: any = null,
      auctionExists = true,
    ) => {
      const idRepo = makeIdempotencyRepo(idempotencyExisting);
      const auctionQbForBuy = {
        ...makeQb(),
        execute: jest
          .fn()
          .mockResolvedValue({
            raw: soldRaw ? [soldRaw] : [],
            affected: soldRaw ? 1 : 0,
          }),
      };
      return {
        getRepository: jest.fn().mockImplementation((entity: any) => {
          if (entity === AuctionBuyIdempotencyRecord) return idRepo;
          if (entity === Auction)
            return {
              create: jest.fn((d: any) => d),
              findOne: jest
                .fn()
                .mockResolvedValue(auctionExists ? { id: 1 } : null),
            };
          return {
            create: jest.fn((d: any) => d),
            save: jest.fn().mockResolvedValue({}),
          };
        }),
        createQueryBuilder: jest.fn().mockReturnValue({
          ...makeQb(),
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          returning: jest.fn().mockReturnThis(),
          execute: jest
            .fn()
            .mockResolvedValue({
              raw: soldRaw ? [soldRaw] : [],
              affected: soldRaw ? 1 : 0,
            }),
          insert: jest.fn().mockReturnThis(),
          into: jest.fn().mockReturnThis(),
          values: jest.fn().mockReturnThis(),
          orIgnore: jest.fn().mockReturnThis(),
          setParameters: jest.fn().mockReturnThis(),
        }),
      };
    };

    it('buys auction successfully', async () => {
      const { svc, dataSource, eventEmitter } = makeService();
      const sold = makeAuction({
        status: AuctionStatus.SOLD,
        buyerId: 2,
        soldAt: new Date(),
      });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeBuyManager(sold)),
      );
      const result = await svc.buyAuction(1, { buyerId: 2 } as any);
      expect(result).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auction.sold',
        expect.any(Object),
      );
    });

    it('throws NotFoundException when auction not found in db', async () => {
      const { svc, dataSource } = makeService();
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeBuyManager(null, null, false)),
      );
      await expect(svc.buyAuction(99, { buyerId: 2 } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when auction already sold', async () => {
      const { svc, dataSource } = makeService();
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeBuyManager(null, null, true)),
      );
      await expect(svc.buyAuction(1, { buyerId: 2 } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('returns cached response when idempotency key matches with status 200', async () => {
      const { svc, dataSource } = makeService();
      const cached = {
        statusCode: 200,
        responsePayload: {
          id: 1,
          productId: 1,
          campaignId: null,
          sellerId: 5,
          buyerId: 2,
          soldAt: new Date().toISOString(),
          price: 100,
          currency: 'COP',
          itemName: 'Kit',
          version: 1,
        },
      };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeBuyManager(null, cached)),
      );
      const result = await svc.buyAuction(1, {
        buyerId: 2,
        idempotencyKey: 'key-123',
      } as any);
      expect(result).toBeDefined();
    });

    it('throws NotFoundException when idempotency key matches with status 404', async () => {
      const { svc, dataSource } = makeService();
      const cached = { statusCode: 404, responsePayload: {} };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeBuyManager(null, cached)),
      );
      await expect(
        svc.buyAuction(1, { buyerId: 2, idempotencyKey: 'key-123' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when idempotency key matches with other status', async () => {
      const { svc, dataSource } = makeService();
      const cached = { statusCode: 409, responsePayload: {} };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeBuyManager(null, cached)),
      );
      await expect(
        svc.buyAuction(1, { buyerId: 2, idempotencyKey: 'key-123' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('buys auction with campaignId creating donation', async () => {
      const { svc, dataSource, eventEmitter } = makeService();
      const sold = makeAuction({
        campaignId: 1,
        status: AuctionStatus.SOLD,
        buyerId: 2,
        soldAt: new Date(),
      });
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(makeBuyManager(sold)),
      );
      const result = await svc.buyAuction(1, { buyerId: 2 } as any);
      expect(result).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auction.sold',
        expect.any(Object),
      );
    });
  });
});
