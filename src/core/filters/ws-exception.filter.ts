import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import E, { StandardError, normalizeError } from '../../common/error';

/**
 * WebSocket异常过滤器
 * 处理WebSocket通信中的异常，将其转换为标准格式
 */
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: WsException | StandardError | any, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const event = host.switchToWs().getPattern() as string;
    
    // 记录错误日志
    this.logger.error(`WebSocket异常 [${event}]`, {
      clientId: client.id,
      event,
      error: exception instanceof Error ? exception.message : exception,
      stack: exception instanceof Error ? exception.stack : undefined
    });

    // 处理标准错误
    if (exception && typeof exception.error === 'number') {
      const standardError = exception as StandardError;
      
      return {
        success: false,
        error: standardError.error,
        message: standardError.message,
        data: standardError.data
      };
    }

    // 处理WsException
    if (exception instanceof WsException) {
      const error = exception.getError();
      
      return {
        success: false,
        error: E.WS_CONNECTION_ERROR.error,
        message: typeof error === 'string' 
          ? error 
          : (error as Record<string, any>)?.message || '未知WebSocket错误',
        data: typeof error === 'string' ? { error } : error
      };
    }

    // 处理其他未知异常
    this.logger.error('未处理的WebSocket异常类型', { 
      type: exception?.constructor?.name || typeof exception,
      message: exception?.message,
      stack: exception?.stack
    });
    
    // 将未知异常转换为标准错误
    const normalizedError = normalizeError(exception, E.WS_CONNECTION_ERROR);
    
    return {
      success: false,
      error: normalizedError.error,
      message: normalizedError.message,
      data: normalizedError.data
    };
  }
} 