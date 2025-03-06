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

@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: 'mysql',
      host: '127.0.0.1',
      port: 3306,
      username: 'root',
      password: 'admin123',
      database: 'b_schema',
      models: [User, Danmu],
      autoLoadModels: true,
      synchronize: true,
    }),
    UserModule,
    DanmuModule
  ],
  controllers: [AppController],
  providers: [AppService, ExceptionCatchFilter]
})
export class AppModule {}