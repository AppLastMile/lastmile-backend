import { ForbiddenException } from '@nestjs/common';
import { RoomAuthorizationService } from './room-authorization.service';
import { UserRole } from '../../users/entities/user.entity';

const makeService = (overrides: any = {}) => {
  const campaignsRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 1 }),
    ...overrides.campaigns,
  };
  const shipmentsRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 1, assignedVolunteerId: 10 }),
    ...overrides.shipments,
  };
  const eventsRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 1, createdBy: 5 }),
    ...overrides.events,
  };
  const svc = new RoomAuthorizationService(
    campaignsRepo,
    shipmentsRepo,
    eventsRepo,
  );
  return { svc, campaignsRepo, shipmentsRepo, eventsRepo };
};

const organizer = (userId = 5) => ({ userId, role: UserRole.ORGANIZER });
const volunteer = (userId = 10) => ({ userId, role: UserRole.VOLUNTEER });
const donor = (userId = 2) => ({ userId, role: UserRole.DONOR });

describe('RoomAuthorizationService', () => {
  describe('volunteers:locations / volunteers:tracking', () => {
    it('allows organizer to join volunteers:locations', async () => {
      const { svc } = makeService();
      const room = await svc.validateAndNormalizeRoom(
        'volunteers:locations',
        organizer(),
      );
      expect(room).toBe('volunteers:locations');
    });

    it('allows organizer to join volunteers:tracking', async () => {
      const { svc } = makeService();
      const room = await svc.validateAndNormalizeRoom(
        'volunteers:tracking',
        organizer(),
      );
      expect(room).toBe('volunteers:tracking');
    });

    it('throws ForbiddenException for non-organizer on volunteers:locations', async () => {
      const { svc } = makeService();
      await expect(
        svc.validateAndNormalizeRoom('volunteers:locations', volunteer()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for non-organizer on volunteers:tracking', async () => {
      const { svc } = makeService();
      await expect(
        svc.validateAndNormalizeRoom('volunteers:tracking', donor()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('campaign:N:chat', () => {
    it('allows any user when campaign exists', async () => {
      const { svc } = makeService();
      const room = await svc.validateAndNormalizeRoom(
        'campaign:1:chat',
        donor(),
      );
      expect(room).toBe('campaign:1:chat');
    });

    it('throws ForbiddenException when campaign not found', async () => {
      const { svc } = makeService({
        campaigns: { findOne: jest.fn().mockResolvedValue(null) },
      });
      await expect(
        svc.validateAndNormalizeRoom('campaign:1:chat', donor()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('campaign:N:auctions', () => {
    it('allows any user when campaign exists', async () => {
      const { svc } = makeService();
      const room = await svc.validateAndNormalizeRoom(
        'campaign:1:auctions',
        donor(),
      );
      expect(room).toBe('campaign:1:auctions');
    });

    it('throws ForbiddenException when campaign not found', async () => {
      const { svc } = makeService({
        campaigns: { findOne: jest.fn().mockResolvedValue(null) },
      });
      await expect(
        svc.validateAndNormalizeRoom('campaign:1:auctions', donor()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('campaign:N:inventory', () => {
    it('allows any user when campaign exists', async () => {
      const { svc } = makeService();
      const room = await svc.validateAndNormalizeRoom(
        'campaign:1:inventory',
        donor(),
      );
      expect(room).toBe('campaign:1:inventory');
    });

    it('throws ForbiddenException when campaign not found', async () => {
      const { svc } = makeService({
        campaigns: { findOne: jest.fn().mockResolvedValue(null) },
      });
      await expect(
        svc.validateAndNormalizeRoom('campaign:1:inventory', volunteer()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('campaign:N:volunteers:tracking', () => {
    it('allows organizer when campaign exists', async () => {
      const { svc } = makeService();
      const room = await svc.validateAndNormalizeRoom(
        'campaign:1:volunteers:tracking',
        organizer(),
      );
      expect(room).toBe('campaign:1:volunteers:tracking');
    });

    it('throws ForbiddenException when campaign not found', async () => {
      const { svc } = makeService({
        campaigns: { findOne: jest.fn().mockResolvedValue(null) },
      });
      await expect(
        svc.validateAndNormalizeRoom(
          'campaign:1:volunteers:tracking',
          organizer(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when non-organizer', async () => {
      const { svc } = makeService();
      await expect(
        svc.validateAndNormalizeRoom(
          'campaign:1:volunteers:tracking',
          volunteer(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('auction:N:bids', () => {
    it('allows any user (public room)', async () => {
      const { svc } = makeService();
      const room = await svc.validateAndNormalizeRoom(
        'auction:1:bids',
        donor(),
      );
      expect(room).toBe('auction:1:bids');
    });
  });

  describe('shipment:N:tracking', () => {
    it('allows organizer regardless of assignment', async () => {
      const { svc } = makeService();
      const room = await svc.validateAndNormalizeRoom(
        'shipment:1:tracking',
        organizer(),
      );
      expect(room).toBe('shipment:1:tracking');
    });

    it('allows assigned volunteer', async () => {
      const { svc } = makeService();
      const room = await svc.validateAndNormalizeRoom(
        'shipment:1:tracking',
        volunteer(10),
      );
      expect(room).toBe('shipment:1:tracking');
    });

    it('throws ForbiddenException when volunteer not assigned to shipment', async () => {
      const { svc } = makeService();
      await expect(
        svc.validateAndNormalizeRoom('shipment:1:tracking', volunteer(99)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when shipment not found', async () => {
      const { svc } = makeService({
        shipments: { findOne: jest.fn().mockResolvedValue(null) },
      });
      await expect(
        svc.validateAndNormalizeRoom('shipment:1:tracking', organizer()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for donor role on shipment', async () => {
      const { svc } = makeService();
      await expect(
        svc.validateAndNormalizeRoom('shipment:1:tracking', donor()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('event:N:ops', () => {
    it('allows organizer who owns the event', async () => {
      const { svc } = makeService();
      const room = await svc.validateAndNormalizeRoom(
        'event:1:ops',
        organizer(5),
      );
      expect(room).toBe('event:1:ops');
    });

    it('throws ForbiddenException when event not found', async () => {
      const { svc } = makeService({
        events: { findOne: jest.fn().mockResolvedValue(null) },
      });
      await expect(
        svc.validateAndNormalizeRoom('event:1:ops', organizer(5)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when organizer does not own the event', async () => {
      const { svc } = makeService();
      await expect(
        svc.validateAndNormalizeRoom('event:1:ops', organizer(99)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for non-organizer on event ops', async () => {
      const { svc } = makeService();
      await expect(
        svc.validateAndNormalizeRoom('event:1:ops', volunteer()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('invalid rooms', () => {
    it('throws ForbiddenException for unknown room format', async () => {
      const { svc } = makeService();
      await expect(
        svc.validateAndNormalizeRoom('unknown:room', donor()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for empty room string', async () => {
      const { svc } = makeService();
      await expect(svc.validateAndNormalizeRoom('', donor())).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
