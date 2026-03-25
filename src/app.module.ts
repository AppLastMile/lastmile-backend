import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { getTypeOrmConfig } from './config/database.config';
import { validateEnv } from './config/env.validation';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EventsModule } from './modules/events/events.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { DonationsModule } from './modules/donations/donations.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { ChatModule } from './modules/chat/chat.module';
import { AuctionsModule } from './modules/auctions/auctions.module';
import { ProductsModule } from './modules/products/products.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { PickupPointsModule } from './modules/pickup-points/pickup-points.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...getTypeOrmConfig(configService),

        autoLoadEntities: true,
      }),
    }),

    EventEmitterModule.forRoot(),

    AuthModule,
    UsersModule,
    EventsModule,
    CampaignsModule,
    DonationsModule,
    AuctionsModule,
    ProductsModule,
    LogisticsModule,
    ChatModule,
    RealtimeModule,

    PickupPointsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
