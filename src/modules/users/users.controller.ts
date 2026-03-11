import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get()
	findAll(
		@Query('page') page = '1',
		@Query('limit') limit = '100',
	) {
		return this.usersService.findAll(Number(page), Number(limit));
	}

	@Post()
	create(@Body() dto: CreateUserDto) {
		return this.usersService.create(dto);
	}
}
