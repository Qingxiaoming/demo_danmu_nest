import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

@Injectable()
export class SecurityLoggerService {
  private readonly logger = new Logger(SecurityLoggerService.name);
  private readonly logDir = 'logs';
  private readonly securityLogPath: string;
  private readonly winstonLogger: winston.Logger;
  
  // 用于跟踪最近的认证记录，避免重复记录
  private recentAuthAttempts: Map<string, {
    timestamp: number;
    success: boolean;
    count: number;
    lastLogged: number;
  }> = new Map();
  
  // 重复日志的时间窗口（毫秒）
  private readonly AUTH_WINDOW_MS = 60000; // 1分钟
  // 记录阈值，超过这个次数才会再次记录
  private readonly AUTH_THRESHOLD = 5;

  constructor() {
    // 确保日志目录存在
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir);
    }
    this.securityLogPath = path.join(this.logDir, 'security.log');
    
    // 配置Winston日志
    this.winstonLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        // 按日期轮转的文件传输
        new winston.transports.DailyRotateFile({
          filename: path.join(this.logDir, 'security-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }),
        // 保留原始的单文件日志，兼容现有代码
        new winston.transports.File({
          filename: this.securityLogPath,
          format: winston.format.printf(({ timestamp, message }) => {
            return `[${timestamp}] ${message}`;
          })
        })
      ]
    });
    
    // 每天午夜清理记忆缓存
    this.scheduleCacheCleaning();
  }
  
  private scheduleCacheCleaning() {
    const now = new Date();
    const tonight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 0, 0
    );
    const timeToMidnight = tonight.getTime() - now.getTime();
    
    setTimeout(() => {
      this.recentAuthAttempts.clear();
      this.scheduleCacheCleaning();
    }, timeToMidnight);
  }

  private async writeLog(message: string, level: string = 'info', meta: any = {}) {
    const timestamp = new Date().toISOString();
    
    try {
      this.winstonLogger.log({
        level,
        message,
        timestamp,
        ...meta
      });
    } catch (error) {
      this.logger.error(`Failed to write security log: ${error.message}`);
    }
  }

  async logAuthAttempt(ip: string, success: boolean, details?: string) {
    // 创建唯一键，用于识别相似的认证尝试
    const key = `${ip}:${success}:${details || ''}`;
    const now = Date.now();
    
    // 检查是否存在最近的相似记录
    const recent = this.recentAuthAttempts.get(key);
    
    if (recent) {
      // 更新计数和时间戳
      recent.count++;
      recent.timestamp = now;
      
      // 检查是否需要记录
      // 1. 如果已经超过时间窗口，记录
      // 2. 如果计数达到阈值，记录
      if (now - recent.lastLogged > this.AUTH_WINDOW_MS || 
          recent.count >= this.AUTH_THRESHOLD) {
        
        // 构建消息，包含重复次数
        let message = `Authentication attempt from ${ip}: ${success ? 'SUCCESS' : 'FAILURE'}`;
        if (details) message += ` - ${details}`;
        if (recent.count > 1) {
          message += ` (repeated ${recent.count} times in the last ${Math.floor((now - recent.lastLogged) / 1000)} seconds)`;
        }
        
        await this.writeLog(message, success ? 'info' : 'warn', { 
          ip, 
          success, 
          details,
          repeated: recent.count
        });
        
        // 重置计数和最后记录时间
        recent.count = 0;
        recent.lastLogged = now;
      }
    } else {
      // 首次记录
      const message = `Authentication attempt from ${ip}: ${success ? 'SUCCESS' : 'FAILURE'}${details ? ` - ${details}` : ''}`;
      await this.writeLog(message, success ? 'info' : 'warn', { ip, success, details });
      
      // 添加到最近记录
      this.recentAuthAttempts.set(key, {
        timestamp: now,
        success,
        count: 0,
        lastLogged: now
      });
    }
  }

  async logUnauthorizedAccess(ip: string, resource: string, details?: string) {
    const message = `Unauthorized access attempt from ${ip} to ${resource}${details ? ` - ${details}` : ''}`;
    await this.writeLog(message, 'warn', { ip, resource, details });
  }

  async logSecurityEvent(eventType: string, details: string) {
    const message = `Security event - ${eventType}: ${details}`;
    await this.writeLog(message, 'info', { eventType, details });
  }

  async logSuspiciousActivity(ip: string, activity: string, details?: string) {
    const message = `Suspicious activity detected from ${ip}: ${activity}${details ? ` - ${details}` : ''}`;
    await this.writeLog(message, 'warn', { ip, activity, details });
  }

  async getRecentLogs(hours: number = 24): Promise<string[]> {
    try {
      const content = await fs.promises.readFile(this.securityLogPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      const now = new Date();
      const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

      return lines.filter(line => {
        const timestamp = new Date(line.slice(1, 25));
        return timestamp >= cutoff;
      });
    } catch (error) {
      this.logger.error(`Failed to read security logs: ${error.message}`);
      return [];
    }
  }
} 