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
    return await this.danmuService.updateStatus(data.index, 'deleted');
  }

  @SubscribeMessage('completed')
  async handleCompleted(@MessageBody() data: { index: string }) {
    return await this.danmuService.updateStatus(data.index, 'completed');
  }

  @SubscribeMessage('edit')
  async handleEdit(@MessageBody() data: { index: string; text: string }) {
    return await this.danmuService.updateText(data.index, data.text);
  }

  @SubscribeMessage('get_acps')
  async handleGetAcps(@MessageBody() data: { index: string }) {
    const result = await this.danmuService.getAccountPassword(data.index);
    console.log('handleGetAcps函数返回值:', result);
    // 只使用server.emit发送事件，不通过return返回数据
    this.server.emit('get_acps', result);
    return { success: true };
  }

  @SubscribeMessage('update_acps')
  async handleUpdateAcps(@MessageBody() data: { index: string; text: string }) {
    const [account, password] = data.text.split(' / ');
    return await this.danmuService.updateAccountPassword(data.index, account, password);
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
    }, 500);
  }
}