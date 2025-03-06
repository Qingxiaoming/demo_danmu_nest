import { applyDecorators, Controller, UseGuards } from '@nestjs/common';
import { PLATFORM } from 'src/common/enum';
import { H5AuthGuard } from '../guards/h5.guard';



export function H5Controller(prefix: string) {
  return applyDecorators(
    Controller(`${PLATFORM.h5}/v1/${prefix}`),
    UseGuards(H5AuthGuard),
  );
}
