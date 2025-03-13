import { Global, Module } from '@nestjs/common';
import { EnhancedLoggerService } from '../services/logger.service';

@Global()
@Module({
  providers: [
    {
      provide: EnhancedLoggerService,
      useClass: EnhancedLoggerService,
    },
  ],
  exports: [EnhancedLoggerService],
})
export class LoggerModule {} 