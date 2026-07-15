import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entity/notification.entity';
import { NotificationPreference } from '../entity/notification-preference.entity';
import { NotificationType, SubscribableNotificationType } from '../entity/enums';
import { NotificationsGateway } from './notifications.gateway';
import { cursorPagination, CursorPaginationResponse } from 'src/utils/common/cursor-pagination';
import { CursorPaginationDto } from 'src/utils/common/dto';
import { UpdateNotificationPreferenceDto } from './dto/notification-preference.dto';

export interface CreateNotificationDto {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  metadata?: Record<string, any>;
}

/** Default state: tất cả subscribable types đều bật */
const DEFAULT_PREFERENCE: Record<SubscribableNotificationType, boolean> = {
  [SubscribableNotificationType.CAMPAIGN_COMPLETED]: true,
  [SubscribableNotificationType.CAMPAIGN_FAILED]: true,
  [SubscribableNotificationType.WEEKLY_SUMMARY]: true,
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // ─── Notifications ────────────────────────────────────────────────────────

  async createNotification(dto: CreateNotificationDto): Promise<Notification | null> {
    try {
      const type = dto.type || NotificationType.SYSTEM_INFO;

      // Kiểm tra preference nếu là subscribable type
      const isSubscribable = Object.values(SubscribableNotificationType).includes(
        type as unknown as SubscribableNotificationType,
      );

      if (isSubscribable) {
        const enabled = await this.isNotificationEnabled(
          dto.userId,
          type as unknown as SubscribableNotificationType,
        );
        if (!enabled) {
          this.logger.debug(
            `Skipped notification type '${type}' for user ${dto.userId} (unsubscribed)`,
          );
          return null;
        }
      }

      const notification = this.notificationRepository.create({
        userId: dto.userId,
        title: dto.title,
        message: dto.message,
        type,
        metadata: dto.metadata || {},
      });

      const savedNotification = await this.notificationRepository.save(notification);

      // Push real-time event to the user
      this.notificationsGateway.sendToUser(dto.userId, 'notification.new', savedNotification);

      return savedNotification;
    } catch (error) {
      this.logger.error(`Error creating notification for user ${dto.userId}:`, error);
      throw error;
    }
  }

  async getNotifications(
    userId: string,
    cursor: CursorPaginationDto,
  ): Promise<CursorPaginationResponse<Notification>> {
    return await cursorPagination(this.notificationRepository, cursor, { userId });
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    return {
      count: await this.notificationRepository.count({
        where: { userId, isRead: false },
      }),
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.update(
      { id: notificationId, userId },
      { isRead: true },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  // ─── Preferences ──────────────────────────────────────────────────────────

  /**
   * Lấy tất cả preferences của user.
   * Các type chưa có record trong DB sẽ dùng default (enabled = true).
   */
  async getPreferences(
    userId: string,
  ): Promise<Record<SubscribableNotificationType, boolean>> {
    const rows = await this.preferenceRepository.find({ where: { userId } });

    const result = { ...DEFAULT_PREFERENCE };
    for (const row of rows) {
      result[row.notificationType] = row.isEnabled;
    }
    return result;
  }

  /**
   * Upsert một preference cho user.
   */
  async updatePreference(
    userId: string,
    dto: UpdateNotificationPreferenceDto,
  ): Promise<Record<SubscribableNotificationType, boolean>> {
    await this.preferenceRepository.upsert(
      {
        userId,
        notificationType: dto.notificationType,
        isEnabled: dto.isEnabled,
      },
      {
        conflictPaths: ['userId', 'notificationType'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    return this.getPreferences(userId);
  }

  /**
   * Kiểm tra xem user có bật nhận một loại notification không.
   * Nếu chưa có record → default true.
   */
  async isNotificationEnabled(
    userId: string,
    type: SubscribableNotificationType,
  ): Promise<boolean> {
    const pref = await this.preferenceRepository.findOne({
      where: { userId, notificationType: type },
    });
    return pref ? pref.isEnabled : true;
  }
}
