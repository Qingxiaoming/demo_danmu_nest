// src/database/database.module.ts
import { Module } from '@nestjs/common';
import * as mysql from 'mysql';

@Module({
  providers: [
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: () => {
        return mysql.createConnection({
          host: '127.0.0.1',
          user: 'root',
          password: 'admin123',
          database: 'b_schema',
        });
      },
    },
  ],
  exports: ['DATABASE_CONNECTION'],
})
export class DatabaseModule {}