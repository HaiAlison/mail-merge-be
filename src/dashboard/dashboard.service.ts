import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Campaign } from '../entity/campaign.entity';
import { Repository } from 'typeorm';
import { CampaignStatus } from 'src/entity/enums';
import { GetDashboardSerializer } from './dashboard.dto';

@Injectable()
export class DashboardService {
    constructor(
        @InjectRepository(Campaign)
        private readonly campaignRepository: Repository<Campaign>,
    ) { }

    async getDashboardData(userId: string): Promise<GetDashboardSerializer> {
        return this.campaignRepository
            .createQueryBuilder('campaign')
            .leftJoin('campaign.recipients', 'recipient')
            .leftJoin('campaign.emailLogs', 'emailLog')
            .select([
                'count(distinct campaign.id)::int as "campaignCount"',
                `count(distinct campaign.id) filter (where campaign.created_at >=  date_trunc('month',CURRENT_DATE)::date)::int as "monthCampaignCount"`,
                'count(distinct recipient.id)::int as "recipientCount"',
                `COUNT(distinct emailLog.id) FILTER (WHERE emailLog.status = '${CampaignStatus.SENT}')::int as "sentCount"`,
                `COUNT(distinct emailLog.id) FILTER (WHERE emailLog.status = '${CampaignStatus.FAILED}')::int as "failedCount"`,
                `COUNT(distinct emailLog.id) FILTER (WHERE emailLog.status = '${CampaignStatus.DRAFT}')::int as "draftCount"`,
                `COUNT(distinct emailLog.id) FILTER (WHERE emailLog.status = '${CampaignStatus.SCHEDULED}')::int as "scheduledCount"`,
            ])
            .addSelect(
                `
                (
                    SELECT 
                        CASE
                            WHEN previous_sent = 0 AND current_sent > 0 THEN 100
                            WHEN previous_sent = 0 AND current_sent = 0 THEN 0
                            ELSE ((current_sent - previous_sent) * 100.0 / previous_sent)::int
                        END
                    FROM (
                        SELECT
                            COUNT(DISTINCT emailLog.id) FILTER (
                                WHERE emailLog.status = '${CampaignStatus.SENT}'
                                AND emailLog.created_at >= date_trunc('month', CURRENT_DATE)
                            ) AS current_sent,
                            COUNT(DISTINCT emailLog.id) FILTER (
                                WHERE emailLog.status = '${CampaignStatus.SENT}'
                                AND emailLog.created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                                AND emailLog.created_at < date_trunc('month', CURRENT_DATE)
                            ) AS previous_sent
                    ) s
                )`,
                'percentSentEmail',
            )
            .where('campaign.userId = :userId', { userId })
            .getRawOne();
    }
}
