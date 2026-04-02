import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from '../auth/guards/auth.guard';
import { TokenService, TokenPayload } from '../auth/services/token.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventSupportService } from './event-support.service';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';

describe('Event support endpoints (in-memory)', () => {
  let app: INestApplication;

  const tokenServiceMock: Pick<TokenService, 'verify'> = {
    verify: jest.fn((token: string): TokenPayload => {
      if (token === 'valid-token') {
        return { userId: 7, role: 'donor' };
      }
      return { userId: 999, role: 'donor' };
    }),
  };

  const eventsServiceMock: Partial<EventsService> = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOneById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const usersServiceMock: Partial<UsersService> = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOneById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [EventsController, UsersController],
      providers: [
        EventSupportService,
        AuthGuard,
        {
          provide: TokenService,
          useValue: tokenServiceMock,
        },
        {
          provide: EventsService,
          useValue: eventsServiceMock,
        },
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Join exitoso', async () => {
    const res = await request(app.getHttpServer())
      .post('/events/10/join')
      .set('Authorization', 'Bearer valid-token')
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ eventId: 10, userId: 7 });
  });

  it('Join duplicado => 409', async () => {
    await request(app.getHttpServer())
      .post('/events/11/join')
      .set('Authorization', 'Bearer valid-token')
      .expect(201);

    const duplicate = await request(app.getHttpServer())
      .post('/events/11/join')
      .set('Authorization', 'Bearer valid-token')
      .expect(409);

    expect(duplicate.body.success).toBe(false);
    expect(duplicate.body.message).toBe('Ya estás apoyando este evento.');
  });

  it('Leave exitoso', async () => {
    await request(app.getHttpServer())
      .post('/events/20/join')
      .set('Authorization', 'Bearer valid-token')
      .expect(201);

    const leaveRes = await request(app.getHttpServer())
      .delete('/events/20/join')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(leaveRes.body.success).toBe(true);
    expect(leaveRes.body.data).toEqual({ eventId: 20, userId: 7 });
  });

  it('Leave sin asociacion => 404', async () => {
    const res = await request(app.getHttpServer())
      .delete('/events/21/join')
      .set('Authorization', 'Bearer valid-token')
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('No estabas apoyando este evento.');
  });

  it('Get my events devuelve solo los eventos unidos', async () => {
    await request(app.getHttpServer())
      .post('/events/30/join')
      .set('Authorization', 'Bearer valid-token')
      .expect(201);

    await request(app.getHttpServer())
      .post('/events/31/join')
      .set('Authorization', 'Bearer valid-token')
      .expect(201);

    await request(app.getHttpServer())
      .post('/events/40/join')
      .set('Authorization', 'Bearer another-token')
      .expect(201);

    const myEvents = await request(app.getHttpServer())
      .get('/users/me/events')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(myEvents.body.success).toBe(true);
    expect(myEvents.body.data.eventIds).toEqual([30, 31]);
  });

  it('Sin token => 401', async () => {
    await request(app.getHttpServer()).post('/events/50/join').expect(401);
  });
});
