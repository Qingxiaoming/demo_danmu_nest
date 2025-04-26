import { Module } from '@nestjs/common';
import { FileTransferGateway } from './filetransfer.gateway';

@Module({
  providers: [FileTransferGateway]
})
export class FileTransferModule {} 