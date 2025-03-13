import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { BilibiliService } from './bilibili.service';
import { DanmuService } from './danmu.service';
import { EnhancedLoggerService } from '../../core/services/logger.service';

@Injectable()
export class DanmuTaskService {
  private readonly logger: EnhancedLoggerService;
  private readonly roomId = 23415751; // B站直播间ID，与原始b.js保持一致
  private readonly printedDanmuIds = new Set(); // 存储已处理的弹幕ID，避免重复处理
  private readonly filterKeyword = "花"; // 需要过滤的关键词，只有包含此关键词的弹幕才会被保存
  
  constructor(
    private readonly bilibiliService: BilibiliService,
    private readonly danmuService: DanmuService,
    loggerService: EnhancedLoggerService
  ) {
    this.logger = loggerService.setContext('DanmuTaskService');
  }
  
  /**
   * 每30秒从B站获取一次弹幕数据
   */
  @Interval(30000)
  async fetchDanmuTask() {
    try {
      const danmuList = await this.bilibiliService.getDanmu(this.roomId);
      if (danmuList && danmuList.length > 0) {
        for (const danmu of danmuList) {
          const danmuId = danmu.id_str || danmu.uid; // 弹幕的唯一标识符
          
          // 避免重复处理同一条弹幕
          if (!this.printedDanmuIds.has(danmuId)) {
            // 记录弹幕内容
            this.logger.log( '收到B站弹幕', { 
              nickname: danmu.nickname, 
              time: new Date().toLocaleString(), 
              text: danmu.text 
            });
            
            // 检查弹幕内容是否包含指定关键词
            if (danmu.text.includes(this.filterKeyword)) {
              this.logger.log(`弹幕包含关键词"${this.filterKeyword}"，保存到数据库`, {
                nickname: danmu.nickname,
                text: danmu.text
              });
              
              await this.danmuService.createDanmu({
                uid: danmu.uid.toString(), // 直接使用B站弹幕的原始uid
                nickname: danmu.nickname,
                text: danmu.text,
                account: '',
                password: '',
                status: 'waiting', // 与b.js保持一致，使用waiting状态
                createtime: new Date()
              });
            }
            // 将弹幕ID添加到已处理集合中
            this.printedDanmuIds.add(danmuId);
          }
        }
      } else {
        this.logger.debug('没有新的B站弹幕数据');
      }
    } catch (error) {
      this.logger.error('获取并保存B站弹幕时发生错误', { 
        error: error.message,
        stack: error.stack
      });
    }
  }
}