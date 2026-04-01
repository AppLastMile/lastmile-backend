import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { TokenPayload } from '../auth/services/token.service';
import { NotificationsService } from './notifications.service';
import { FindNotificationsQueryDto } from './dto/find-notifications-query.dto';
import {
  NotificationResponseDto,
  PaginatedNotificationsDto,
} from './dto/notification-response.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(AuthGuard)
  findAll(
    @Query() query: FindNotificationsQueryDto,
  ): Promise<PaginatedNotificationsDto> {
    return this.notificationsService.findAll(query);
  }

  @Patch(':id/read')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('test/me')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  createTestForCurrentUser(
    @CurrentUser() user: TokenPayload,
    @Body() body?: { message?: string },
  ): Promise<NotificationResponseDto> {
    const message = body?.message?.trim() || 'Notificación de prueba';
    return this.notificationsService.create(user.userId, message, null);
  }
}
