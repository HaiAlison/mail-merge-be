export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
  PAUSED = 'paused',
}

export enum ParseStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
}

export enum RecipientStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  BOUNCED = 'bounced',
}

export enum EmailLogStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  OPENED = 'opened',
  CLICKED = 'clicked',
  BOUNCED = 'bounced',
  FAILED = 'failed',
}

export enum NotificationType {
  CAMPAIGN_SENT = 'campaign.sent',
  CAMPAIGN_FAILED = 'campaign.failed',
  CAMPAIGN_SCHEDULED = 'campaign.scheduled',
  CAMPAIGN_COMPLETED = 'campaign.completed',
  SYSTEM_INFO = 'system.info',
  SYSTEM_WARNING = 'system.warning',
  WEEKLY_SUMMARY = 'weekly.summary',
}

/** Các notification type mà user có thể subscribe/unsubscribe */
export enum SubscribableNotificationType {
  CAMPAIGN_COMPLETED = 'campaign.completed',
  CAMPAIGN_FAILED = 'campaign.failed',
  WEEKLY_SUMMARY = 'weekly.summary',
}
