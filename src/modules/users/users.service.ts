import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
	constructor(
		@InjectRepository(User)
		private readonly usersRepository: Repository<User>,
	) {}

	async findAll(page = 1, limit = 100) {
		const safePage = Number.isFinite(page) && page > 0 ? page : 1;
		const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 100;

		const [data, total] = await this.usersRepository.findAndCount({
			order: { id: 'DESC' },
			skip: (safePage - 1) * safeLimit,
			take: safeLimit,
		});

		return {
			data,
			meta: {
				total,
				page: safePage,
				limit: safeLimit,
				totalPages: Math.max(1, Math.ceil(total / safeLimit)),
			},
		};
	}

	create(dto: CreateUserDto) {
		const user = this.usersRepository.create(dto);
		return this.usersRepository.save(user).then((saved) => ({
			id: saved.id,
			name: saved.name,
			email: saved.email,
			role: saved.role,
			createdAt: saved.createdAt,
		}));
	}
}
