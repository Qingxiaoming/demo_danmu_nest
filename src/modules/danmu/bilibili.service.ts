import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class BilibiliService {
  private readonly logger = new Logger(BilibiliService.name);
  private readonly apiUrl = 'https://api.live.bilibili.com/xlive/web-room/v1/dM/gethistory';
  private readonly headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  }; 
   
  /**
   * 获取B站直播间的历史弹幕
   * @param roomId B站直播间ID
   * @returns 弹幕数据数组
   */
  async getDanmu(roomId: number): Promise<any[]> {
    try {
      const response = await axios.get(this.apiUrl, {
        params: {
          roomid: roomId,
          limit: 20
        },
        headers: this.headers
      });
       
      if (response.data && response.data.code === 0 && response.data.data && response.data.data.room) {
        return response.data.data.room;
      } else {
        this.logger.warn('获取B站弹幕失败,API返回格式异常', response.data);
        return [];
      }
    } catch (error) {
      this.logger.error('获取B站弹幕时发生错误:', error);
      return [];
    }
  }
}