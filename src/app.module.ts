// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Danmu } from './model/danmu.model';
import { ExceptionCatchFilter } from './core/filter/exception';
import { DanmuModule } from './modules/danmu/danmu.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './core/modules/logger.module';
import { APP_FILTER } from '@nestjs/core';
import { WsExceptionFilter } from './core/filters/ws-exception.filter';
import { EnhancedLoggerService } from './core/services/logger.service';
import { MusicModule } from './modules/music/music.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule,
    ScheduleModule.forRoot(),
    SequelizeModule.forRoot({
      dialect: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      models: [Danmu],
      autoLoadModels: true,
      synchronize: true,
      logging: false,
    }),
    DanmuModule,
    MusicModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    EnhancedLoggerService,
    // 注册HTTP异常过滤器
    {
      provide: APP_FILTER,
      useClass: ExceptionCatchFilter,
    },
    // 注册WebSocket异常过滤器
    {
      provide: APP_FILTER,
      useClass: WsExceptionFilter,
    }
  ]
})
export class AppModule {}