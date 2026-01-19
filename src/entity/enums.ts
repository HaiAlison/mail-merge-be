export enum CampaignStatus {
    DRAFT = 'draft',
    SCHEDULED = 'scheduled',
    SENDING = 'sending',
    SENT = 'sent',
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
