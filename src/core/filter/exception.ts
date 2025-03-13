import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request, Response } from 'express';
import { StandardError } from '../../common/error';
import E from '../../common/error';

@Catch()
export class ExceptionCatchFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(ExceptionCatchFilter.name);

  catch(exception: HttpException | StandardError | any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response: Response = ctx.getResponse<Response>();
    const request: Request = ctx.getRequest<Request>();

    // 记录错误日志
    this.logger.error('捕获到异常', {
      path: request.url,
      method: request.method,
      error: exception instanceof Error ? exception.message : exception,
      stack: exception instanceof Error ? exception.stack : undefined
    });

    // 处理标准错误
    if (exception && typeof exception.error === 'number') {
      const standardError = exception as StandardError;
      const statusCode = standardError.statusCode || 400;
      
      response.status(statusCode).json({
        success: false,
        statusCode: statusCode,
        error: standardError.error,
        message: standardError.message,
        timestamp: new Date().toISOString(),
        path: request.url,
        data: standardError.data
      });
      return;
    }

    // 处理 HTTP 异常
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const responseBody = exception.getResponse();
      
      response.status(status).json({
        success: false,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        ...(typeof responseBody === 'object' ? responseBody : { message: responseBody }),
      });
      return;
    }

    // 处理其他未知异常
    this.logger.error('未处理的异常类型', { 
      type: exception?.constructor?.name || typeof exception,
      message: exception?.message,
      stack: exception?.stack
    });
    
    response.status(500).json({
      success: false,
      statusCode: 500,
      error: E.UNDEFINED.error,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception?.message || 'Internal Server Error',
    });
  }
}