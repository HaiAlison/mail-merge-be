import { Body, Controller, Get, Patch, Param, UseGuards, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/entity/user.entity';
import { CursorPaginationDto } from 'src/utils/common/dto';
import { UpdateNotificationPreferenceDto } from './dto/notification-preference.dto';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ─── Notifications ────────────────────────────────────────────────────────

  @Get()
  async getNotifications(
    @CurrentUser() user: User,
    @Query() cursor: CursorPaginationDto,
  ) {
    return this.notificationsService.getNotifications(user.id, cursor);
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: User) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @CurrentUser() user: User) {
    await this.notificationsService.markAsRead(id, user.id);
    return { success: true };
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: User) {
    await this.notificationsService.markAllAsRead(user.id);
    return { success: true };
  }

  // ─── Preferences ──────────────────────────────────────────────────────────

  /**
   * GET /notifications/preferences
   * Lấy tất cả notification preferences của user hiện tại.
   * Response: { "campaign.completed": true, "campaign.failed": true, "weekly.summary": false, ... }
   */
  @Get('preferences')
  async getPreferences(@CurrentUser() user: User) {
    return this.notificationsService.getPreferences(user.id);
  }

  /**
   * PATCH /notifications/preferences
   * Cập nhật (bật/tắt) một loại notification.
   * Body: { "notificationType": "campaign.completed", "isEnabled": false }
   */
  @Patch('preferences')
  async updatePreference(
    @CurrentUser() user: User,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.notificationsService.updatePreference(user.id, dto);
  }
}
