import { VolunteerPresenceService } from './volunteer-presence.service';

describe('VolunteerPresenceService', () => {
  let service: VolunteerPresenceService;

  beforeEach(() => {
    service = new VolunteerPresenceService();
  });

  it('tracks connections by user and socket', () => {
    service.registerConnection('socket-1', 100, 'volunteer');
    expect(service.isConnected(100)).toBe(true);
  });

  it('keeps user connected while at least one socket is open', () => {
    service.registerConnection('socket-1', 100, 'volunteer');
    service.registerConnection('socket-2', 100, 'volunteer');

    const firstDisconnect = service.unregisterConnection('socket-1');
    expect(firstDisconnect).toEqual({
      userId: 100,
      role: 'volunteer',
      stillConnected: true,
    });
    expect(service.isConnected(100)).toBe(true);

    const secondDisconnect = service.unregisterConnection('socket-2');
    expect(secondDisconnect).toEqual({
      userId: 100,
      role: 'volunteer',
      stillConnected: false,
    });
    expect(service.isConnected(100)).toBe(false);
  });

  it('returns null when unregistering an unknown socket', () => {
    expect(service.unregisterConnection('missing')).toBeNull();
  });
});
