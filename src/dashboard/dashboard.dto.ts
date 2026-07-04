import { Expose } from 'class-transformer';

export class GetDashboardSerializer {
  @Expose()
  campaignCount: number;

  @Expose()
  monthCampaignCount: number;

  @Expose()
  recipientCount: number;

  @Expose()
  percentSentEmail: number;

  @Expose()
  sentCount: number;

  @Expose()
  failedCount: number;

  @Expose()
  draftCount: number;

  @Expose()
  scheduledCount: number;
}
