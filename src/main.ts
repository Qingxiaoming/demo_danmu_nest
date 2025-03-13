import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as csurf from 'csurf';
import { EnhancedLoggerService } from './core/services/logger.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: '*' }); // 允许跨域
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // 启用CSRF保护
  app.use(csurf());

  // 增加swagger文档
  const config = new DocumentBuilder()
    .addBearerAuth()
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

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
}
bootstrap();
