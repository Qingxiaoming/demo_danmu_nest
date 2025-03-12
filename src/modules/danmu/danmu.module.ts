import { Module } from '@nestjs/common';
import { DanmuGateway } from './danmu.gateway';
import { DanmuService } from './danmu.service';
import { SequelizeModule } from '@nestjs/sequelize'; 
import { Danmu } from '../../model/danmu.model';
import { BilibiliService } from './bilibili.service';
import { DanmuTaskService } from './danmu.task.service';
import { SecurityLoggerService } from '../../core/services/security-logger.service';


@Module({
  imports: [SequelizeModule.forFeature([Danmu])],
  providers: [DanmuGateway, DanmuService, BilibiliService, DanmuTaskService, SecurityLoggerService],
  exports: [DanmuService]
})

export class DanmuModule {} 