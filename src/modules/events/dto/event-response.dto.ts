export class EventResponseDto {
  id!: number;
  name!: string;
  disasterType!: string;
  city!: string;
  description!: string;
  date!: Date;
  createdBy!: number;
}

export class PaginatedEventsDto {
  data!: EventResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
