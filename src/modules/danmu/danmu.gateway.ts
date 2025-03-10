import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { DanmuService } from './danmu.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable() 
@WebSocketGateway(5052, {
  cors: {
    origin: '*',
  },
})
export class DanmuGateway implements OnGatewayInit {
  private readonly logger = new Logger(DanmuGateway.name);
  
  @WebSocketServer()
  server: Server;

  constructor(private readonly danmuService: DanmuService) {}

  afterInit() {
    this.logger.log('WebSocket 服务器初始化');
    this.startUpdateInterval();
  }

  handleConnection(client: any) {
    this.logger.log('客户端已连接');
  }
 
  @SubscribeMessage('delete')
  async handleDelete(@MessageBody() data: { index: string }) {
    const result = await this.danmuService.updateStatus(data.index, 'deleted');
    this.server.emit('delete', result);
    return { success: true };
  }

  @SubscribeMessage('completed')
  async handleCompleted(@MessageBody() data: { index: string }) {
    const result = await this.danmuService.updateStatus(data.index, 'completed');
    this.server.emit('completed', result);
    return { success: true };
  }

  @SubscribeMessage('edit')
  async handleEdit(@MessageBody() data: { index: string; text: string }) {
    const result = await this.danmuService.updateText(data.index, data.text);
    this.server.emit('edit', result);
    return { success: true };
  }

  @SubscribeMessage('get_acps')
  async handleGetAcps(@MessageBody() data: { index: string }) {
    const result = await this.danmuService.getAccountPassword(data.index);
    console.log('handleGetAcps函数返回值:', result);
    this.server.emit('get_acps', result);
    return { success: true };
  }

  @SubscribeMessage('verify_password')
  async handleVerifyPassword(@MessageBody() data: { password: string }) {
    const result = await this.danmuService.verifyPassword(data.password);
    this.server.emit('verify_password', result);
    return { success: true };
  }

  @SubscribeMessage('update_acps')
  async handleUpdateAcps(@MessageBody() data: { index: string; text: string }) {
    const [account, password] = data.text.split(' / ');
    const result = await this.danmuService.updateAccountPassword(data.index, account, password);
    this.server.emit('update_acps', result);
    return { success: true };
  }

  private startUpdateInterval() {
    setInterval(async () => {
      try {
        if (this.server) {
          const data = await this.danmuService.getAllDanmu();
          this.server.emit('update', data);
        }
      } catch (error) {
        this.logger.error('更新数据时发生错误:', error);
      }
    }, 2000);
  }
}