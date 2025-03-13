import { Module } from '@nestjs/common';
import { MusicService } from './music.service';
import { MusicController } from './music.controller';
import { QQMusicService } from './platforms/qq.service';
import { NeteaseMusicService } from './platforms/netease.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule,
  ],
  controllers: [MusicController],
  providers: [
    MusicService,
    QQMusicService,
    NeteaseMusicService,
  ],
  exports: [MusicService],
})
export class MusicModule {} 