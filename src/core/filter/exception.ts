import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request, Response } from 'express';

@Catch()
export class ExceptionCatchFilter extends BaseExceptionFilter {
  catch(exception: HttpException | any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response: Response = ctx.getResponse<Response>();
    const request: Request = ctx.getRequest<Request>();

    console.error(exception);
    // 处理自定义错误
    if (exception.error && exception.message) {
      response.status(400).json({
        statusCode: exception.error,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: exception.message,
        code: exception.error
      });
      return;
    }

    // 处理 HTTP 异常
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: exception.message || 'Internal Server Error',
      });
      return;
    }

    // 处理其他未知异常
    response.status(500).json({
      statusCode: 500,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: 'Internal Server Error',
    });
  }
}