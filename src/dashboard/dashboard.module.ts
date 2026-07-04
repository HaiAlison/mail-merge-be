import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from 'src/entity/campaign.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
