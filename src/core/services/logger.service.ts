import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { inspect } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

/**
 * 增强的日志服务
 * 支持控制台和文件日志输出，以及格式化
 */
@Injectable()
export class EnhancedLoggerService implements LoggerService {
  private logger: winston.Logger;
  private context: string = 'Application';
  private static instance: EnhancedLoggerService;

  constructor() {
    // 确保日志目录存在
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // 创建Winston日志记录器
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          return `[${timestamp}] [${level.toUpperCase()}] [${context || this.context}] ${message} ${
            Object.keys(meta).length ? `- ${inspect(meta, { depth: 5, colors: false })}` : ''
          }`;
        })
      ),
      transports: [
        // 控制台输出
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
              // 检查是否是弹幕消息
              if (typeof message === 'string' && message.includes('收到B站弹幕')) {
                // 只有当有弹幕内容时才显示
                if (meta && typeof meta === 'object') {
                  const nickname = meta.nickname || '未知用户';
                  const text = meta.text || '';
                  if (text) {
                    return `【弹幕】${nickname}: ${text}`;
                  }
                }
                // 如果没有弹幕内容，则不显示任何内容
                return '';
              }
              
              // 检查是否是包含关键词的弹幕
              if (typeof message === 'string' && message.includes('弹幕包含关键词')) {
                // 只有当有弹幕内容时才显示
                if (meta && typeof meta === 'object') {
                  const nickname = meta.nickname || '未知用户';
                  const text = meta.text || '';
                  if (text) {
                    return `【保存】${nickname}: ${text}`;
                  }
                }
                // 如果没有弹幕内容，则不显示任何内容
                return '';
              }
              
              // 对于其他日志，使用简化格式
              const metaKeys = Object.keys(meta);
              let metaStr = '';
              
              // 只显示clientId和关键操作信息，忽略其他元数据
              if (metaKeys.length > 0) {
                const simplifiedMeta: Record<string, any> = {};
                if ('clientId' in meta) simplifiedMeta.clientId = meta.clientId;
                if ('danmuId' in meta) simplifiedMeta.danmuId = meta.danmuId;
                
                // 只有当有简化后的元数据时才显示
                if (Object.keys(simplifiedMeta).length > 0) {
                  metaStr = ` - ${JSON.stringify(simplifiedMeta)}`;
                }
              }
              
              return `[${level.toUpperCase()}] [${context || this.context}] ${message}${metaStr}`;
            })
          ),
        }),
        // 按日期轮转的文件日志
        new winston.transports.DailyRotateFile({
          filename: path.join(logDir, 'application-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.json()
          ),
        }),
        // 错误日志单独存储
        new winston.transports.DailyRotateFile({
          filename: path.join(logDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.json()
          ),
        }),
      ],
    });

    // 单例模式
    if (!EnhancedLoggerService.instance) {
      EnhancedLoggerService.instance = this;
    }

    return EnhancedLoggerService.instance;
  }

  /**
   * 设置日志上下文
   * @param context 上下文名称
   */
  setContext(context: string): this {
    this.context = context;
    return this;
  }

  /**
   * 记录调试级别日志
   */
  debug(message: any, ...optionalParams: any[]): void {
    this.logWithLevel('debug', message, ...optionalParams);
  }

  /**
   * 记录普通级别日志
   */
  log(message: any, ...optionalParams: any[]): void {
    this.logWithLevel('info', message, ...optionalParams);
  }

  /**
   * 记录警告级别日志
   */
  warn(message: any, ...optionalParams: any[]): void {
    this.logWithLevel('warn', message, ...optionalParams);
  }

  /**
   * 记录错误级别日志
   */
  error(message: any, ...optionalParams: any[]): void {
    this.logWithLevel('error', message, ...optionalParams);
  }

  /**
   * 记录严重错误级别日志
   */
  fatal(message: any, ...optionalParams: any[]): void {
    this.logWithLevel('error', `FATAL: ${message}`, ...optionalParams);
  }

  /**
   * 记录详细级别日志
   */
  verbose(message: any, ...optionalParams: any[]): void {
    this.logWithLevel('verbose', message, ...optionalParams);
  }

  /**
   * 通用日志记录方法
   */
  private logWithLevel(level: string, message: any, ...optionalParams: any[]): void {
    let meta = {};
    let formattedMessage = message;

    // 处理错误对象
    if (message instanceof Error) {
      meta = {
        error: {
          name: message.name,
          message: message.message,
          stack: process.env.NODE_ENV === 'development' ? message.stack : undefined,
        },
      };
      formattedMessage = message.message;
    }

    // 处理可选参数
    if (optionalParams.length > 0) {
      // 如果最后一个参数是对象，将其作为元数据
      const lastParam = optionalParams[optionalParams.length - 1];
      if (lastParam && typeof lastParam === 'object' && !(lastParam instanceof Error)) {
        meta = { ...meta, ...lastParam };
        optionalParams.pop();
      }

      // 将剩余参数添加到消息中
      if (optionalParams.length > 0) {
        formattedMessage = `${formattedMessage} ${optionalParams.map(p => 
          typeof p === 'object' ? inspect(p, { depth: 3, colors: false }) : p
        ).join(' ')}`;
      }
    }

    // 记录日志
    this.logger.log({
      level,
      message: formattedMessage,
      context: this.context,
      ...meta,
    });
  }
} 