import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { PaginatedUsersDto, UserResponseDto } from './dto/user-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existingUser = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const user = this.usersRepository.create({
      ...dto,
      email: normalizedEmail,
    });
    const savedUser = await this.usersRepository.save(user);

    return this.toUserResponse(savedUser);
  }

  async findAll(query: FindUsersQueryDto): Promise<PaginatedUsersDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.usersRepository.createQueryBuilder('user');

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(user.name) LIKE :search OR LOWER(user.email) LIKE :search)',
        {
          search: `%${query.search.toLowerCase()}%`,
        },
      );
    }

    qb.orderBy('user.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [users, total] = await qb.getManyAndCount();

    return {
      data: users.map((user) => this.toUserResponse(user)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOneById(id: number): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} was not found`);
    }

    return this.toUserResponse(user);
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} was not found`);
    }

    if (dto.email) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      const existingUser = await this.usersRepository.findOne({
        where: { email: normalizedEmail },
      });

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('A user with this email already exists');
      }

      dto.email = normalizedEmail;
    }

    const updatedUser = await this.usersRepository.save({
      ...user,
      ...dto,
    });

    return this.toUserResponse(updatedUser);
  }

  async remove(id: number): Promise<void> {
    const result = await this.usersRepository.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`User with id ${id} was not found`);
    }
  }

  private toUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      fullName: user.name,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
