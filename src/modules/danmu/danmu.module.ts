import { Module } from '@nestjs/common';
import { DanmuGateway } from './danmu.gateway';
import { DanmuService } from './danmu.service';
import { SequelizeModule } from '@nestjs/sequelize'; 
import { Danmu } from '../../model/danmu.model';

@Module({
  imports: [SequelizeModule.forFeature([Danmu])],
  providers: [DanmuGateway, DanmuService],
})

export class DanmuModule {}