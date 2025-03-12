// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from './model/user.model';
import { Danmu } from './model/danmu.model';
import { ExceptionCatchFilter } from './core/filter/exception';
import { UserModule } from './modules/user/user.module';
import { DanmuModule } from './modules/danmu/danmu.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    SequelizeModule.forRoot({
      dialect: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      models: [User, Danmu],
      autoLoadModels: true,
      synchronize: true,
      logging: false,
    }),
    UserModule,
    DanmuModule
  ],
  controllers: [AppController],
  providers: [AppService, ExceptionCatchFilter]
})
export class AppModule {}