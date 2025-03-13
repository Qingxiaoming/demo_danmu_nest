import { Injectable } from '@nestjs/common';
import { EnhancedLoggerService } from '../../core/services/logger.service';

/**
 * 弹幕任务服务
 * 该服务已被重构，WebSocket相关功能已移至DanmuGateway
 */
@Injectable()
export class DanmuTaskService {
  private readonly logger: EnhancedLoggerService;
  
  constructor(
    loggerService: EnhancedLoggerService
  ) {
    this.logger = loggerService.setContext('DanmuTaskService');
    this.logger.log('DanmuTaskService初始化，WebSocket相关功能已移至DanmuGateway');
  }
}