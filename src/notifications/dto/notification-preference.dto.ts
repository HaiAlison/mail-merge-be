import { IsBoolean, IsEnum } from 'class-validator';
import { SubscribableNotificationType } from 'src/entity/enums';

export class UpdateNotificationPreferenceDto {
  @IsEnum(SubscribableNotificationType)
  notificationType: SubscribableNotificationType;

  @IsBoolean()
  isEnabled: boolean;
}
