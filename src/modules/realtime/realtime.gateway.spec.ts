import { RealtimeGateway } from './realtime.gateway';
import { ShipmentStatus } from '../logistics/entities/shipment.entity';
import { UserRole } from '../users/entities/user.entity';

const makeSocket = (overrides: any = {}) => ({
  id: 'socket-1',
  handshake: { headers: {}, auth: {} },
  data: {
    userId: 1,
    userName: 'Alice',
    role: UserRole.VOLUNTEER,
    rateLimit: {},
    isAuthenticated: true,
  },
  join: jest.fn().mockResolvedValue(undefined),
  leave: jest.fn().mockResolvedValue(undefined),
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
  disconnect: jest.fn(),
  ...overrides,
});

const makeServer = () => ({
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  adapter: jest.fn(),
});

const makeShipment = (o: any = {}) => ({
  id: 1,
  campaignId: 1,
  assignedVolunteerId: 1,
  status: ShipmentStatus.ASSIGNED,
  ...o,
});

const makeLocation = (o: any = {}) => ({
  id: 1,
  shipmentId: 1,
  lat: 4.6,
  lng: -74.0,
  speed: null,
  heading: null,
  recordedAt: new Date(),
  ...o,
});

const makeGateway = (overrides: any = {}) => {
  const messagesRepo = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({
      id: 1,
      ...d,
      createdAt: new Date(),
      message: d.message || 'msg',
    })),
    findOne: jest.fn().mockResolvedValue({
      id: 1,
      campaignId: 1,
      userId: 1,
      message: 'hi',
      createdAt: new Date(),
    }),
    ...overrides.messagesRepo,
  };
  const campaignsRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 1 }),
    ...overrides.campaignsRepo,
  };
  const usersRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue({ id: 1, name: 'Alice', role: UserRole.VOLUNTEER }),
    ...overrides.usersRepo,
  };
  const shipmentsRepo = {
    findOne: jest.fn().mockResolvedValue(makeShipment()),
    save: jest.fn(async (d: any) => ({ ...makeShipment(), ...d })),
    find: jest.fn().mockResolvedValue([]),
    ...overrides.shipmentsRepo,
  };
  const shipmentLocationsRepo = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({ ...makeLocation(), ...d })),
    findOne: jest.fn().mockResolvedValue(makeLocation()),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
    ...overrides.shipmentLocationsRepo,
  };
  const realtimeAuthService = {
    verifyToken: jest
      .fn()
      .mockReturnValue({ userId: 1, role: UserRole.VOLUNTEER }),
    ...overrides.realtimeAuthService,
  };
  const roomAuthService = {
    validateAndNormalizeRoom: jest.fn().mockResolvedValue('campaign:1:chat'),
    ...overrides.roomAuthService,
  };
  const volunteerPresenceService = {
    registerConnection: jest.fn(),
    unregisterConnection: jest.fn().mockReturnValue(null),
    getLinkedUser: jest.fn().mockReturnValue(null),
    isConnected: jest.fn().mockReturnValue(false),
    ...overrides.volunteerPresenceService,
  };
  const volunteerLocationService = {
    upsertLocation: jest.fn(),
    removeLocation: jest.fn(),
    getAllLocations: jest.fn().mockReturnValue([]),
    getCampaignLocations: jest.fn().mockReturnValue([]),
    getByVolunteerId: jest.fn().mockReturnValue(null),
    ...overrides.volunteerLocationService,
  };
  const eventEmitter = { emit: jest.fn(), ...overrides.eventEmitter };

  const gw = new RealtimeGateway(
    messagesRepo,
    campaignsRepo,
    usersRepo,
    shipmentsRepo,
    shipmentLocationsRepo,
    realtimeAuthService,
    roomAuthService,
    volunteerPresenceService,
    volunteerLocationService,
    eventEmitter,
  );
  gw.server = makeServer() as any;
  return {
    gw,
    messagesRepo,
    campaignsRepo,
    usersRepo,
    shipmentsRepo,
    shipmentLocationsRepo,
    realtimeAuthService,
    roomAuthService,
    volunteerPresenceService,
    volunteerLocationService,
    eventEmitter,
  };
};

describe('RealtimeGateway', () => {
  describe('afterInit', () => {
    it('does not configure Redis adapter when REDIS_URL is not set', async () => {
      const { gw } = makeGateway();
      const server = makeServer();
      delete process.env.REDIS_URL;
      await gw.afterInit(server as any);
      expect(server.adapter).not.toHaveBeenCalled();
    });
  });

  describe('handleConnection', () => {
    it('authenticates and joins user room', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        handshake: { headers: { authorization: 'Bearer token123' }, auth: {} },
      });
      await gw.handleConnection(socket);
      expect(socket.join).toHaveBeenCalledWith('user:1');
    });

    it('disconnects when no token provided', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({ handshake: { headers: {}, auth: {} } });
      await gw.handleConnection(socket);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.objectContaining({ code: 'AUTH_REQUIRED' }),
      );
    });

    it('disconnects when token is invalid', async () => {
      const { gw, realtimeAuthService } = makeGateway();
      realtimeAuthService.verifyToken.mockImplementation(() => {
        throw new Error('invalid');
      });
      const socket = makeSocket({
        handshake: { headers: { authorization: 'Bearer bad-token' }, auth: {} },
      });
      await gw.handleConnection(socket);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.objectContaining({ code: 'AUTH_INVALID' }),
      );
    });

    it('disconnects when user not found in db', async () => {
      const { gw, usersRepo } = makeGateway();
      usersRepo.findOne.mockResolvedValue(null);
      const socket = makeSocket({
        handshake: { headers: { authorization: 'Bearer token' }, auth: {} },
      });
      await gw.handleConnection(socket);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('joins organizer to volunteers rooms', async () => {
      const { gw, usersRepo } = makeGateway();
      usersRepo.findOne.mockResolvedValue({
        id: 1,
        name: 'Org',
        role: UserRole.ORGANIZER,
      });
      const socket = makeSocket({
        handshake: { headers: { authorization: 'Bearer token' }, auth: {} },
      });
      await gw.handleConnection(socket);
      expect(socket.join).toHaveBeenCalledWith('volunteers:locations');
      expect(socket.join).toHaveBeenCalledWith('volunteers:tracking');
    });

    it('extracts token from auth.token when no Authorization header', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        handshake: { headers: {}, auth: { token: 'mytoken' } },
      });
      await gw.handleConnection(socket);
      expect(socket.join).toHaveBeenCalledWith('user:1');
    });
  });

  describe('handleDisconnect', () => {
    it('does nothing when socket was unknown', () => {
      const { gw } = makeGateway();
      const socket = makeSocket();
      gw.handleDisconnect(socket);
      expect(gw.server.to).not.toHaveBeenCalled();
    });

    it('emits volunteer.disconnected when volunteer fully disconnects', () => {
      const { gw, volunteerPresenceService } = makeGateway();
      volunteerPresenceService.unregisterConnection.mockReturnValue({
        userId: 2,
        role: UserRole.VOLUNTEER,
        stillConnected: false,
      });
      const socket = makeSocket();
      gw.handleDisconnect(socket);
      expect(gw.server.to).toHaveBeenCalledWith('volunteers:locations');
    });

    it('does not emit when volunteer still has connections', () => {
      const { gw, volunteerPresenceService } = makeGateway();
      volunteerPresenceService.unregisterConnection.mockReturnValue({
        userId: 2,
        role: UserRole.VOLUNTEER,
        stillConnected: true,
      });
      const socket = makeSocket();
      gw.handleDisconnect(socket);
      expect(gw.server.emit).not.toHaveBeenCalled();
    });
  });

  describe('joinRoom (system.join_room)', () => {
    it('joins room successfully and emits system.joined', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket();
      await gw.joinRoom(socket, { room: 'campaign:1:chat' });
      expect(socket.join).toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        'system.joined',
        expect.any(Object),
      );
    });

    it('emits system.error when room is missing', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket();
      await gw.joinRoom(socket, {} as any);
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('emits system.error when room authorization fails', async () => {
      const { gw, roomAuthService } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockRejectedValue(
        new Error('forbidden'),
      );
      const socket = makeSocket();
      await gw.joinRoom(socket, { room: 'volunteers:locations' });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('emits volunteers snapshot when joining volunteers:locations', async () => {
      const { gw, roomAuthService } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockResolvedValue(
        'volunteers:locations',
      );
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.ORGANIZER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.joinRoom(socket, { room: 'volunteers:locations' });
      expect(socket.emit).toHaveBeenCalledWith(
        'volunteers.locations.snapshot',
        expect.any(Object),
      );
    });

    it('emits chat.join event when joining a chat room', async () => {
      const { gw, eventEmitter } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.joinRoom(socket, { room: 'campaign:1:chat' });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'chat.join',
        expect.any(Object),
      );
    });
  });

  describe('leaveRoom (system.leave_room)', () => {
    it('leaves room and emits system.left', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket();
      await gw.leaveRoom(socket, { room: 'campaign:1:chat' });
      expect(socket.leave).toHaveBeenCalledWith('campaign:1:chat');
      expect(socket.emit).toHaveBeenCalledWith(
        'system.left',
        expect.any(Object),
      );
    });

    it('emits system.error when room is missing', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket();
      await gw.leaveRoom(socket, {} as any);
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });
  });

  describe('sendChatMessage (chat.send)', () => {
    it('saves message and emits to room', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.sendChatMessage(socket, {
        campaignId: 1,
        message: 'Hello!',
      });
      expect(gw.server.to).toHaveBeenCalledWith('campaign:1:chat');
    });

    it('emits chat.message.error on invalid campaignId', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.sendChatMessage(socket, {
        campaignId: -1,
        message: 'Hello!',
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'chat.message.error',
        expect.any(Object),
      );
    });

    it('emits chat.message.error when message is empty', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.sendChatMessage(socket, { campaignId: 1, message: '' });
      expect(socket.emit).toHaveBeenCalledWith(
        'chat.message.error',
        expect.any(Object),
      );
    });

    it('emits chat.message.error when campaign not found', async () => {
      const { gw, campaignsRepo } = makeGateway();
      campaignsRepo.findOne.mockResolvedValue(null);
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.sendChatMessage(socket, { campaignId: 1, message: 'Hi' });
      expect(socket.emit).toHaveBeenCalledWith(
        'chat.message.error',
        expect.any(Object),
      );
    });

    it('emits chat.message.error when user not found', async () => {
      const { gw, usersRepo } = makeGateway();
      usersRepo.findOne.mockResolvedValue(null);
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.sendChatMessage(socket, { campaignId: 1, message: 'Hi' });
      expect(socket.emit).toHaveBeenCalledWith(
        'chat.message.error',
        expect.any(Object),
      );
    });
  });

  describe('subscribeShipment (shipment.subscribe)', () => {
    it('joins shipment tracking room and sends snapshot', async () => {
      const { gw, roomAuthService } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockResolvedValue(
        'shipment:1:tracking',
      );
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.subscribeShipment(socket, { shipmentId: 1 });
      expect(socket.join).toHaveBeenCalledWith('shipment:1:tracking');
      expect(socket.emit).toHaveBeenCalledWith(
        'system.joined',
        expect.any(Object),
      );
    });

    it('emits location snapshot when latest location exists', async () => {
      const { gw, roomAuthService, shipmentLocationsRepo } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockResolvedValue(
        'shipment:1:tracking',
      );
      shipmentLocationsRepo.findOne.mockResolvedValue(makeLocation());
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.subscribeShipment(socket, { shipmentId: 1 });
      expect(socket.emit).toHaveBeenCalledWith(
        'shipment.location.snapshot',
        expect.any(Object),
      );
    });

    it('emits system.error on invalid shipmentId', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket();
      await gw.subscribeShipment(socket, { shipmentId: -1 });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('emits system.error when authorization fails', async () => {
      const { gw, roomAuthService } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockRejectedValue(
        new Error('forbidden'),
      );
      const socket = makeSocket();
      await gw.subscribeShipment(socket, { shipmentId: 1 });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });
  });

  describe('subscribeCampaignVolunteers (campaign.volunteers.subscribe)', () => {
    it('joins campaign volunteers room', async () => {
      const { gw, roomAuthService } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockResolvedValue(
        'campaign:1:volunteers:tracking',
      );
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.ORGANIZER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.subscribeCampaignVolunteers(socket, { campaignId: 1 });
      expect(socket.join).toHaveBeenCalledWith(
        'campaign:1:volunteers:tracking',
      );
    });

    it('emits system.error on invalid campaignId', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket();
      await gw.subscribeCampaignVolunteers(socket, { campaignId: -1 });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });
  });

  describe('handleVolunteerSnapshotRequest (volunteers.locations.snapshot.request)', () => {
    it('emits snapshot for organizer', () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.ORGANIZER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      gw.handleVolunteerSnapshotRequest(socket);
      expect(socket.emit).toHaveBeenCalledWith(
        'volunteers.locations.snapshot',
        expect.any(Object),
      );
    });

    it('does not emit for non-organizer', () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      gw.handleVolunteerSnapshotRequest(socket);
      expect(socket.emit).not.toHaveBeenCalled();
    });
  });

  describe('volunteerLocationUpdate (volunteer.location.update)', () => {
    it('sends ack on valid location update', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, { lat: 4.6, lng: -74.0 });
      expect(socket.emit).toHaveBeenCalledWith(
        'volunteer.location.ack',
        expect.any(Object),
      );
    });

    it('emits system.error when not volunteer', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.ORGANIZER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, { lat: 4.6, lng: -74.0 });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('emits system.error when coords are missing', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, {} as any);
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('handles latitude/longitude aliases', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, {
        latitude: 4.6,
        longitude: -74.0,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'volunteer.location.ack',
        expect.any(Object),
      );
    });

    it('handles coords nested object', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, {
        coords: { lat: 4.6, lng: -74.0 },
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'volunteer.location.ack',
        expect.any(Object),
      );
    });

    it('saves location for linked shipmentId', async () => {
      const { gw, shipmentsRepo } = makeGateway();
      shipmentsRepo.findOne.mockResolvedValue(
        makeShipment({ assignedVolunteerId: 1 }),
      );
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, {
        lat: 4.6,
        lng: -74.0,
        shipmentId: 1,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'volunteer.location.ack',
        expect.any(Object),
      );
    });

    it('emits system.error when shipment does not exist', async () => {
      const { gw, shipmentsRepo } = makeGateway();
      shipmentsRepo.findOne.mockResolvedValue(null);
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, {
        lat: 4.6,
        lng: -74.0,
        shipmentId: 1,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('emits system.error when volunteer not assigned to shipment', async () => {
      const { gw, shipmentsRepo } = makeGateway();
      shipmentsRepo.findOne.mockResolvedValue(
        makeShipment({ assignedVolunteerId: 99 }),
      );
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, {
        lat: 4.6,
        lng: -74.0,
        shipmentId: 1,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });
  });

  describe('shipmentLocationUpdate (shipment.location.update)', () => {
    it('saves and emits location', async () => {
      const { gw, roomAuthService } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockResolvedValue(
        'shipment:1:tracking',
      );
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.shipmentLocationUpdate(socket, {
        shipmentId: 1,
        lat: 4.6,
        lng: -74.0,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'shipment.location.ack',
        expect.any(Object),
      );
    });

    it('emits system.error when not volunteer role', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.ORGANIZER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.shipmentLocationUpdate(socket, {
        shipmentId: 1,
        lat: 4.6,
        lng: -74.0,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('emits system.error when shipmentId is invalid', async () => {
      const { gw, roomAuthService } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockResolvedValue(
        'shipment:0:tracking',
      );
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.shipmentLocationUpdate(socket, {
        shipmentId: 0,
        lat: 4.6,
        lng: -74.0,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });
  });

  describe('shipmentStatusUpdate (shipment.status.update)', () => {
    it('updates status and emits change', async () => {
      const { gw, roomAuthService, shipmentsRepo } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockResolvedValue(
        'shipment:1:tracking',
      );
      shipmentsRepo.findOne.mockResolvedValue(
        makeShipment({ status: ShipmentStatus.ASSIGNED }),
      );
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.shipmentStatusUpdate(socket, {
        shipmentId: 1,
        status: ShipmentStatus.IN_TRANSIT,
      });
      expect(gw.server.to).toHaveBeenCalledWith('shipment:1:tracking');
    });

    it('does nothing when status is unchanged', async () => {
      const { gw, roomAuthService } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockResolvedValue(
        'shipment:1:tracking',
      );
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.shipmentStatusUpdate(socket, {
        shipmentId: 1,
        status: ShipmentStatus.ASSIGNED,
      });
      expect(gw.server.emit).not.toHaveBeenCalled();
    });

    it('emits system.error on invalid shipmentId', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket();
      await gw.shipmentStatusUpdate(socket, {
        shipmentId: -1,
        status: ShipmentStatus.IN_TRANSIT,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('emits system.error on invalid status', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket();
      await gw.shipmentStatusUpdate(socket, {
        shipmentId: 1,
        status: 'not_valid' as any,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('emits system.error when shipment not found', async () => {
      const { gw, roomAuthService, shipmentsRepo } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockResolvedValue(
        'shipment:1:tracking',
      );
      shipmentsRepo.findOne.mockResolvedValue(null);
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.shipmentStatusUpdate(socket, {
        shipmentId: 1,
        status: ShipmentStatus.IN_TRANSIT,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });
  });

  describe('@OnEvent handlers', () => {
    it('onMessageSent() emits chat.message.created when message found', async () => {
      const { gw } = makeGateway();
      await gw.onMessageSent({ messageId: 1, campaignId: 1, userId: 1 });
      expect(gw.server.to).toHaveBeenCalledWith('campaign:1:chat');
    });

    it('onMessageSent() does nothing when message not found', async () => {
      const { gw, messagesRepo } = makeGateway();
      messagesRepo.findOne.mockResolvedValue(null);
      await gw.onMessageSent({ messageId: 99, campaignId: 1, userId: 1 });
      expect(gw.server.to).not.toHaveBeenCalled();
    });

    it('onShipmentStatusChanged() emits to shipment room', () => {
      const { gw } = makeGateway();
      gw.onShipmentStatusChanged({
        shipmentId: 1,
        campaignId: 1,
        previousStatus: ShipmentStatus.ASSIGNED,
        status: ShipmentStatus.IN_TRANSIT,
        updatedBy: 1,
        updatedAt: new Date(),
      });
      expect(gw.server.to).toHaveBeenCalledWith('shipment:1:tracking');
    });

    it('onShipmentAssigned() emits shipment.assignment.changed', () => {
      const { gw } = makeGateway();
      gw.onShipmentAssigned({ shipmentId: 1, campaignId: 1, volunteerId: 2 });
      expect(gw.server.to).toHaveBeenCalledWith('shipment:1:tracking');
    });

    it('onShipmentDelivered() emits shipment.status.changed', () => {
      const { gw } = makeGateway();
      gw.onShipmentDelivered({
        shipmentId: 1,
        campaignId: 1,
        deliveredAt: new Date(),
      });
      expect(gw.server.to).toHaveBeenCalledWith('shipment:1:tracking');
    });

    it('onShipmentLocationChanged() emits to shipment room and updates locations', () => {
      const { gw, volunteerLocationService } = makeGateway();
      gw.onShipmentLocationChanged({
        shipmentId: 1,
        campaignId: 1,
        lat: 4.6,
        lng: -74.0,
        speed: null,
        heading: null,
        recordedAt: new Date(),
        updatedBy: 1,
      });
      expect(gw.server.to).toHaveBeenCalledWith('shipment:1:tracking');
      expect(volunteerLocationService.upsertLocation).toHaveBeenCalled();
    });

    it('onAuctionCreated() emits to campaign auctions room', () => {
      const { gw } = makeGateway();
      gw.onAuctionCreated({
        auctionId: 1,
        campaignId: 1,
        sellerId: 2,
        price: 100,
        currency: 'USD',
      });
      expect(gw.server.to).toHaveBeenCalledWith('campaign:1:auctions');
    });

    it('onAuctionSold() emits to campaign auctions room', () => {
      const { gw } = makeGateway();
      gw.onAuctionSold({
        auctionId: 1,
        campaignId: 1,
        buyerId: 2,
        soldAt: new Date(),
        price: 50,
        currency: 'USD',
        itemName: 'Book',
      });
      expect(gw.server.to).toHaveBeenCalledWith('campaign:1:auctions');
    });

    it('onBidPlaced() emits to auction bids room', () => {
      const { gw } = makeGateway();
      gw.onBidPlaced({ bidId: 1, auctionId: 1, userId: 2, amount: 50 });
      expect(gw.server.to).toHaveBeenCalledWith('auction:1:bids');
    });

    it('onAuctionClosed() emits to auction bids room', () => {
      const { gw } = makeGateway();
      gw.onAuctionClosed({
        auctionId: 1,
        winnerId: 2,
        winningAmount: 100,
        currency: 'USD',
        closedAt: new Date(),
      });
      expect(gw.server.to).toHaveBeenCalledWith('auction:1:bids');
    });

    it('onCampaignInventoryUpdated() emits to campaign inventory room', () => {
      const { gw } = makeGateway();
      gw.onCampaignInventoryUpdated({
        campaignId: 1,
        itemType: 'food',
        quantity: 10,
      });
      expect(gw.server.to).toHaveBeenCalledWith('campaign:1:inventory');
    });

    it('onNotificationCreated() emits to user room', () => {
      const { gw } = makeGateway();
      gw.onNotificationCreated({
        userId: 1,
        notificationId: 1,
        message: 'test',
        auctionId: null,
        createdAt: new Date(),
      });
      expect(gw.server.to).toHaveBeenCalledWith('user:1');
    });
  });

  describe('chatTyping (chat.typing)', () => {
    it('emits typing update when campaignId is valid', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      });
      await gw.chatTyping(socket, { campaignId: 1, isTyping: true });
      expect(socket.to).toHaveBeenCalledWith('campaign:1:chat');
    });

    it('returns early when campaignId is invalid', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket();
      await gw.chatTyping(socket, { campaignId: -1 });
      expect(socket.emit).not.toHaveBeenCalled();
    });
  });

  describe('volunteerLocationUpdate — edge cases', () => {
    it('emits system.error when coords are out of range after no swap', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, { lat: 200, lng: -74.0 });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('normalizes swapped coordinates (lat > 90 with lng <= 90)', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, { lat: -74.0, lng: 4.6 });
      expect(socket.emit).toHaveBeenCalledWith(
        'volunteer.location.ack',
        expect.any(Object),
      );
    });

    it('emits system.error on invalid recordedAt', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, {
        lat: 4.6,
        lng: -74.0,
        recordedAt: 'not-a-date',
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('uses provided correlationId when non-empty string', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, {
        lat: 4.6,
        lng: -74.0,
        correlationId: 'my-id-123',
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'volunteer.location.ack',
        expect.objectContaining({ correlationId: 'my-id-123' }),
      );
    });

    it('throws system.error when implausible jump detected', async () => {
      const { gw, volunteerLocationService } = makeGateway();
      volunteerLocationService.getByVolunteerId.mockReturnValue({
        volunteerId: 1,
        lat: 4.6,
        lng: -74.0,
        recordedAt: new Date(Date.now() - 1000).toISOString(),
      });
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, {
        lat: -34.6,
        lng: 150.0,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('emits system.error when rate limit exceeded', async () => {
      const { gw } = makeGateway();
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, { lat: 4.6, lng: -74.0 });
      await gw.volunteerLocationUpdate(socket, { lat: 4.6, lng: -74.0 });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('resolves active shipment when no shipmentId provided', async () => {
      const { gw, shipmentsRepo } = makeGateway();
      shipmentsRepo.findOne.mockResolvedValue(
        makeShipment({ id: 2, campaignId: 5 }),
      );
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.volunteerLocationUpdate(socket, { lat: 4.6, lng: -74.0 });
      expect(socket.emit).toHaveBeenCalledWith(
        'volunteer.location.ack',
        expect.any(Object),
      );
    });
  });

  describe('shipmentLocationUpdate — edge cases', () => {
    it('emits system.error when volunteer not assigned to shipment', async () => {
      const { gw, roomAuthService, shipmentsRepo } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockResolvedValue(
        'shipment:1:tracking',
      );
      shipmentsRepo.findOne.mockResolvedValue(
        makeShipment({ assignedVolunteerId: 99 }),
      );
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.shipmentLocationUpdate(socket, {
        shipmentId: 1,
        lat: 4.6,
        lng: -74.0,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('emits system.error when shipment does not exist', async () => {
      const { gw, roomAuthService, shipmentsRepo } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockResolvedValue(
        'shipment:1:tracking',
      );
      shipmentsRepo.findOne.mockResolvedValue(null);
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.shipmentLocationUpdate(socket, {
        shipmentId: 1,
        lat: 4.6,
        lng: -74.0,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'system.error',
        expect.any(Object),
      );
    });

    it('handles latitude/longitude aliases in shipment update', async () => {
      const { gw, roomAuthService } = makeGateway();
      roomAuthService.validateAndNormalizeRoom.mockResolvedValue(
        'shipment:1:tracking',
      );
      const socket = makeSocket({
        data: {
          userId: 1,
          role: UserRole.VOLUNTEER,
          rateLimit: {},
          isAuthenticated: true,
        },
      });
      await gw.shipmentLocationUpdate(socket, {
        shipmentId: 1,
        latitude: 4.6,
        longitude: -74.0,
        speed: 10,
        heading: 90,
      });
      expect(socket.emit).toHaveBeenCalledWith(
        'shipment.location.ack',
        expect.any(Object),
      );
    });
  });
});
