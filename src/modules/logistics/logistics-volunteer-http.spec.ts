import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AuthGuard } from '../auth/guards/auth.guard';
import { TokenPayload, TokenService } from '../auth/services/token.service';
import { LogisticsController } from './logistics.controller';
import { LogisticsService } from './logistics.service';
import { PickupPoint } from './entities/pickup-point.entity';
import { ShipmentLocationHistory } from './entities/shipment-location-history.entity';
import { Shipment, ShipmentStatus } from './entities/shipment.entity';

type MutableShipment = {
  id: number;
  campaignId: number;
  pickupPointId: number;
  assignedVolunteerId: number | null;
  status: ShipmentStatus;
  createdAt: Date;
};

describe('Logistics volunteer flow (HTTP)', () => {
  let app: INestApplication;
  let shipments: MutableShipment[];

  const tokenServiceMock: Pick<TokenService, 'verify'> = {
    verify: jest.fn((token: string): TokenPayload => {
      if (token === 'token-v7') return { userId: 7, role: 'volunteer' };
      if (token === 'token-v8') return { userId: 8, role: 'volunteer' };
      return { userId: 999, role: 'volunteer' };
    }),
  };

  const pickupPointRepositoryMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const shipmentLocationsRepositoryMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const shipmentRepositoryMock = {
    findOne: jest.fn(async ({ where }: { where: { id: number } }) => {
      return shipments.find((shipment) => shipment.id === where.id) ?? null;
    }),
    save: jest.fn(async (entity: Partial<MutableShipment>) => {
      const current = shipments.find((shipment) => shipment.id === entity.id);
      if (!current) {
        return entity as Shipment;
      }

      Object.assign(current, entity);
      return current as Shipment;
    }),
    createQueryBuilder: jest.fn(() => {
      const filters: {
        campaignId?: number;
        pickupPointId?: number;
        assignedVolunteerId?: number;
        status?: ShipmentStatus;
      } = {};
      let skip = 0;
      let take = 20;

      const qb = {
        andWhere: (
          condition: string,
          params: {
            campaignId?: number;
            pickupPointId?: number;
            assignedVolunteerId?: number;
            status?: ShipmentStatus;
          },
        ) => {
          if (condition.includes('shipment.campaignId')) {
            filters.campaignId = params.campaignId;
          }
          if (condition.includes('shipment.pickupPointId')) {
            filters.pickupPointId = params.pickupPointId;
          }
          if (condition.includes('shipment.assignedVolunteerId')) {
            filters.assignedVolunteerId = params.assignedVolunteerId;
          }
          if (condition.includes('shipment.status')) {
            filters.status = params.status;
          }
          return qb;
        },
        orderBy: () => qb,
        skip: (value: number) => {
          skip = value;
          return qb;
        },
        take: (value: number) => {
          take = value;
          return qb;
        },
        getManyAndCount: async () => {
          let result = [...shipments];

          if (filters.campaignId !== undefined) {
            result = result.filter(
              (shipment) => shipment.campaignId === filters.campaignId,
            );
          }
          if (filters.pickupPointId !== undefined) {
            result = result.filter(
              (shipment) => shipment.pickupPointId === filters.pickupPointId,
            );
          }
          if (filters.assignedVolunteerId !== undefined) {
            result = result.filter(
              (shipment) =>
                shipment.assignedVolunteerId === filters.assignedVolunteerId,
            );
          }
          if (filters.status !== undefined) {
            result = result.filter((shipment) => shipment.status === filters.status);
          }

          result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          const total = result.length;
          const paginated = result.slice(skip, skip + take);
          return [paginated, total];
        },
      };

      return qb;
    }),
  };

  beforeEach(async () => {
    shipments = [
      {
        id: 1,
        campaignId: 11,
        pickupPointId: 101,
        assignedVolunteerId: 7,
        status: ShipmentStatus.ASSIGNED,
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
      },
      {
        id: 2,
        campaignId: 12,
        pickupPointId: 102,
        assignedVolunteerId: 8,
        status: ShipmentStatus.ASSIGNED,
        createdAt: new Date('2026-04-01T09:00:00.000Z'),
      },
      {
        id: 3,
        campaignId: 13,
        pickupPointId: 103,
        assignedVolunteerId: 7,
        status: ShipmentStatus.IN_TRANSIT,
        createdAt: new Date('2026-04-01T08:00:00.000Z'),
      },
    ];

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [LogisticsController],
      providers: [
        LogisticsService,
        AuthGuard,
        { provide: TokenService, useValue: tokenServiceMock },
        {
          provide: getRepositoryToken(PickupPoint),
          useValue: pickupPointRepositoryMock,
        },
        {
          provide: getRepositoryToken(Shipment),
          useValue: shipmentRepositoryMock,
        },
        {
          provide: getRepositoryToken(ShipmentLocationHistory),
          useValue: shipmentLocationsRepositoryMock,
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET mis envios con token valido retorna solo envios del voluntario', async () => {
    const response = await request(app.getHttpServer())
      .get('/logistics/shipments?assignedVolunteerId=me')
      .set('Authorization', 'Bearer token-v7')
      .expect(200);

    const ids = response.body.data.map((shipment: { id: number }) => shipment.id);
    expect(ids).toEqual([1, 3]);
  });

  it('GET sin token retorna 401', async () => {
    await request(app.getHttpServer())
      .get('/logistics/shipments?assignedVolunteerId=me')
      .expect(401);
  });

  it('PATCH assigned -> in_transit exitoso (200)', async () => {
    const response = await request(app.getHttpServer())
      .patch('/logistics/shipments/1/status')
      .set('Authorization', 'Bearer token-v7')
      .send({ status: 'in_transit' })
      .expect(200);

    expect(response.body.id).toBe(1);
    expect(response.body.status).toBe('in_transit');
  });

  it('PATCH in_transit -> delivered exitoso (200)', async () => {
    const response = await request(app.getHttpServer())
      .patch('/logistics/shipments/3/status')
      .set('Authorization', 'Bearer token-v7')
      .send({ status: 'delivered' })
      .expect(200);

    expect(response.body.id).toBe(3);
    expect(response.body.status).toBe('delivered');
  });

  it('PATCH por voluntario diferente retorna 403', async () => {
    const response = await request(app.getHttpServer())
      .patch('/logistics/shipments/1/status')
      .set('Authorization', 'Bearer token-v8')
      .send({ status: 'in_transit' })
      .expect(403);

    expect(response.body.message).toBe(
      'No tienes permisos para actualizar este envío.',
    );
  });

  it('PATCH con transicion invalida retorna 409', async () => {
    const response = await request(app.getHttpServer())
      .patch('/logistics/shipments/1/status')
      .set('Authorization', 'Bearer token-v7')
      .send({ status: 'delivered' })
      .expect(409);

    expect(response.body.message).toBe('Transición de estado no permitida.');
  });

  it('PATCH shipment inexistente retorna 404', async () => {
    const response = await request(app.getHttpServer())
      .patch('/logistics/shipments/999/status')
      .set('Authorization', 'Bearer token-v7')
      .send({ status: 'in_transit' })
      .expect(404);

    expect(response.body.message).toBe('Envío no encontrado.');
  });
});
