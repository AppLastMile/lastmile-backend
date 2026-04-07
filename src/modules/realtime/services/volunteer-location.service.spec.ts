import { VolunteerLocationService } from './volunteer-location.service';

describe('VolunteerLocationService', () => {
  let service: VolunteerLocationService;

  beforeEach(() => {
    service = new VolunteerLocationService();
  });

  it('stores and returns latest locations', () => {
    service.upsertLocation({
      volunteerId: 10,
      lat: 4.6,
      lng: -74.1,
      recordedAt: '2026-04-07T10:00:00.000Z',
      name: 'Ana',
    });

    const snapshot = service.getAllLocations();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toEqual({
      volunteerId: 10,
      lat: 4.6,
      lng: -74.1,
      recordedAt: '2026-04-07T10:00:00.000Z',
      name: 'Ana',
    });
  });

  it('keeps only the latest location per volunteer', () => {
    service.upsertLocation({
      volunteerId: 10,
      lat: 4.6,
      lng: -74.1,
      recordedAt: '2026-04-07T10:00:00.000Z',
    });

    service.upsertLocation({
      volunteerId: 10,
      lat: 4.7,
      lng: -74.2,
      recordedAt: '2026-04-07T10:01:00.000Z',
      campaignId: 5,
      shipmentId: 12,
    });

    const snapshot = service.getAllLocations();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].lat).toBe(4.7);
    expect(snapshot[0].campaignId).toBe(5);
    expect(snapshot[0].shipmentId).toBe(12);
  });

  it('filters by campaign when building campaign snapshot', () => {
    service.upsertLocation({
      volunteerId: 11,
      lat: 5,
      lng: -73,
      recordedAt: '2026-04-07T10:01:00.000Z',
      campaignId: 2,
    });

    service.upsertLocation({
      volunteerId: 12,
      lat: 6,
      lng: -72,
      recordedAt: '2026-04-07T10:02:00.000Z',
      campaignId: 3,
    });

    const campaignSnapshot = service.getCampaignLocations(2);
    expect(campaignSnapshot).toHaveLength(1);
    expect(campaignSnapshot[0].volunteerId).toBe(11);
  });

  it('removes volunteer location on disconnect', () => {
    service.upsertLocation({
      volunteerId: 20,
      lat: 7,
      lng: -71,
      recordedAt: '2026-04-07T10:00:00.000Z',
    });

    expect(service.removeLocation(20)).toBe(true);
    expect(service.getAllLocations()).toHaveLength(0);
  });
});
