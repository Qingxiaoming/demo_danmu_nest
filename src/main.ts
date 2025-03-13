import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as csurf from 'csurf';
import { EnhancedLoggerService } from './core/services/logger.service';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // 启用全局验证管道
  app.useGlobalPipes(new ValidationPipe());
  
  // 配置跨域
  app.enableCors();
  
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // 配置 Swagger 文档
  const config = new DocumentBuilder()
    .setTitle('音乐弹幕 API')
    .setDescription('音乐弹幕系统 API 文档')
    .setVersion('1.0')
    .addTag('音乐', '音乐搜索和播放相关接口')
    .addTag('弹幕', '弹幕发送和管理相关接口')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  
  // 自定义 Swagger UI 选项，简化示例显示
  const customOptions = {
    swaggerOptions: {
      defaultModelsExpandDepth: -1, // 默认不展开模型
      docExpansion: 'list',         // 默认折叠所有接口
      persistAuthorization: true,
      displayRequestDuration: true,
    }
  };
  
  SwaggerModule.setup('api/docs', app, document, customOptions);

  // 启用CSRF保护，但排除Swagger文档路径
  // 注意：在开发环境中，可以考虑暂时禁用CSRF保护以方便测试
  // 生产环境中应该正确配置CSRF保护
  // app.use(csurf({ cookie: true, ignoreMethods: ['GET', 'HEAD', 'OPTIONS'], ignorePath: (req) => req.url.startsWith('/api/docs') }));
  
  // 获取日志服务
  const logger = app.get(EnhancedLoggerService).setContext('Application');

  // 监听线程异常
  process.on('uncaughtException', function (err) {
    logger.error('未捕获的异常', { error: err.message, stack: err.stack });
  });
  
  process.on('unhandledRejection', function (reason: any, promise) {
    logger.error('未处理的Promise拒绝', { 
      reason: reason?.message || reason, 
      stack: reason?.stack
    });
  });
  
  const port = process.env.PORT ?? 5051;
  await app.listen(port);
  logger.log(`服务器已启动`, { url: `http://127.0.0.1:${port}/` });
  console.log(`API 文档: http://localhost:${port}/api/docs`);
}
bootstrap();
