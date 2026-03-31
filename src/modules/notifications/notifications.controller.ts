import {
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
}
