import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ExceptionCatchFilter } from './core/filter/exception';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: '*' }); // 允许跨域
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // 增加swagger文档
  const config = new DocumentBuilder()
    .addBearerAuth()
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  // 统一异常处理
  const iocContext = app.select(AppModule);
  app.useGlobalFilters(iocContext.get(ExceptionCatchFilter));
  //监听线程异常
  process.on('uncaughtException', function (err) {
    console.error('线程出现异常=>>',err);
  });
  process.on('unhandledRejection', function (reason, promise) {
    console.error('线程异常未处理=>>',reason);
    console.error('注:该异常系统容易崩溃');
  });
  await app.listen(process.env.PORT ?? 5051);
  console.log(
    '[server start]',
    `http://127.0.0.1:${process.env.PORT ?? 5051}/`,
  );
}
bootstrap();
