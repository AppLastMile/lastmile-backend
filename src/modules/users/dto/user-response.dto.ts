import { UserRole } from '../entities/user.entity';

export class UserResponseDto {
  id!: number;
  fullName?: string;
  name!: string;
  email!: string;
  role!: UserRole;
  createdAt!: Date;
}

export class PaginatedUsersDto {
  data!: UserResponseDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
