// src/danmu/danmu.module.ts
import { Module } from '@nestjs/common';
import { DanmuService } from './danmu.service';
import { DanmuController } from './danmu.controller';
import { DatabaseModule } from '../database/database.module'; // 导入 DatabaseModule

@Module({
  imports: [DatabaseModule], // 确保导入 DatabaseModule
  providers: [DanmuService],
  controllers: [DanmuController],
})
export class DanmuModule {}