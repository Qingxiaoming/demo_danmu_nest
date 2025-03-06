// src/danmu/danmu.controller.ts
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { DanmuService } from './danmu.service';

@Controller('danmu')
export class DanmuController {
  constructor(private readonly danmuService: DanmuService) {}

  @Get()
  async getDanmu(@Query('roomid') roomid: string) {
    return this.danmuService.getDanmuData(roomid);
  }

  @Post('update-status')
  async updateStatus(@Body('uid') uid: string, @Body('status') status: string) {
    return this.danmuService.updateDanmuStatus(uid, status);
  }

  @Post('update-text')
  async updateText(@Body('uid') uid: string, @Body('text') text: string) {
    return this.danmuService.updateDanmuText(uid, text);
  }

  @Post('get-acps')
  async getAccountPassword(@Body('uid') uid: string) {
    return this.danmuService.getAccountPassword(uid);
  }

  @Post('update-acps')
  async updateAccountPassword(
    @Body('uid') uid: string,
    @Body('account') account: string,
    @Body('password') password: string,
  ) {
    return this.danmuService.updateAccountPassword(uid, account, password);
  }
}