import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmAsyncConfig } from './utils/config/database/config.service';
import { CampaignsModule } from './campaigns/campaigns.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), TypeOrmModule.forRootAsync(typeOrmAsyncConfig), AuthModule, CampaignsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
