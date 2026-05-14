import { Injectable } from '@nestjs/common';

export type VolunteerLocationDto = {
  volunteerId: number;
  lat: number;
  lng: number;
  recordedAt: string;
  correlationId?: string;
  normalizedCoordinates?: boolean;
  stale?: boolean;
  serverReceivedAt?: string;
  name?: string;
  campaignId?: number;
  shipmentId?: number;
};

export type VolunteerLocationsSnapshotDto = {
  volunteers: VolunteerLocationDto[];
};

export type VolunteerDisconnectedDto = {
  volunteerId: number;
};

@Injectable()
export class VolunteerLocationService {
  private readonly latestLocationByVolunteerId = new Map<
    number,
    VolunteerLocationDto
  >();

  upsertLocation(location: VolunteerLocationDto): VolunteerLocationDto {
    this.latestLocationByVolunteerId.set(location.volunteerId, location);
    return location;
  }

  getByVolunteerId(volunteerId: number): VolunteerLocationDto | undefined {
    return this.latestLocationByVolunteerId.get(volunteerId);
  }

  removeLocation(volunteerId: number): boolean {
    return this.latestLocationByVolunteerId.delete(volunteerId);
  }

  getAllLocations(): VolunteerLocationDto[] {
    return Array.from(this.latestLocationByVolunteerId.values()).sort(
      (a, b) => a.volunteerId - b.volunteerId,
    );
  }

  getCampaignLocations(campaignId: number): VolunteerLocationDto[] {
    return this.getAllLocations().filter(
      (location) => location.campaignId === campaignId,
    );
  }
}
