import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { DanmuService } from './danmu.service';
import { Injectable, Logger } from '@nestjs/common';

/**
 * 弹幕系统WebSocket网关
 * 处理实时弹幕通信、状态更新和账号管理
 * 默认监听5052端口，支持跨域访问
 */
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
 
  /**
   * 处理弹幕删除事件
   * @param data.index 要删除的弹幕ID
   * @returns {Promise<{success: boolean}>} 删除操作的结果
   * @emits delete 广播删除结果给所有客户端
   */
  @SubscribeMessage('delete')
  async handleDelete(@MessageBody() data: { index: string }) {
    const result = await this.danmuService.updateStatus(data.index, 'deleted');
    this.server.emit('delete', result);
    return { success: true };
  }

  /**
   * 处理弹幕完成事件
   * @param data.index 要标记为完成的弹幕ID
   * @returns {Promise<{success: boolean}>} 标记完成操作的结果
   * @emits completed 广播完成状态给所有客户端
   */
  @SubscribeMessage('completed')
  async handleCompleted(@MessageBody() data: { index: string }) {
    const result = await this.danmuService.updateStatus(data.index, 'completed');
    this.server.emit('completed', result);
    return { success: true };
  }

  /**
   * 处理弹幕编辑事件
   * @param data.index 要编辑的弹幕ID
   * @param data.text 新的弹幕内容
   * @returns {Promise<{success: boolean}>} 编辑操作的结果
   * @emits edit 广播编辑结果给所有客户端
   */
  @SubscribeMessage('edit')
  async handleEdit(@MessageBody() data: { index: string; text: string }) {
    const result = await this.danmuService.updateText(data.index, data.text);
    this.server.emit('edit', result);
    return { success: true };
  }

  /**
   * 获取账号密码信息
   * @param data.index 弹幕ID
   * @returns {Promise<{success: boolean}>} 获取操作的结果
   * @emits get_acps 广播账号密码信息给所有客户端
   */
  @SubscribeMessage('get_acps')
  async handleGetAcps(@MessageBody() data: { index: string }) {
    const result = await this.danmuService.getAccountPassword(data.index);
    console.log('handleGetAcps函数返回值:', result);
    this.server.emit('get_acps', result);
    return { success: true };
  }

  /**
   * 验证管理员密码
   * @param data.password 待验证的密码
   * @returns {Promise<{success: boolean}>} 验证结果
   * @emits verify_password 广播验证结果给所有客户端
   */
  @SubscribeMessage('verify_password')
  async handleVerifyPassword(@MessageBody() data: { password: string }) {
    const result = await this.danmuService.verifyPassword(data.password);
    this.server.emit('verify_password', result);
    return { success: true };
  }

  /**
   * 更新账号密码信息
   * @param data.index 弹幕ID
   * @param data.text 新的账号密码信息，格式为"account / password"
   * @returns {Promise<{success: boolean}>} 更新操作的结果
   * @emits update_acps 广播更新结果给所有客户端
   */
  @SubscribeMessage('update_acps')
  async handleUpdateAcps(@MessageBody() data: { index: string; text: string }) {
    const [account, password] = data.text.split(' / ');
    const result = await this.danmuService.updateAccountPassword(data.index, account, password);
    this.server.emit('update_acps', result);
    return { success: true };
  }

  /**
   * 处理添加弹幕事件
   * @param data.nickname 弹幕昵称
   * @param data.text 弹幕内容
   * @returns {Promise<{success: boolean}>} 添加操作的结果
   * @emits add_danmu 广播添加结果给所有客户端
   */
  @SubscribeMessage('add_danmu')
  async handleAddDanmu(@MessageBody() data: { nickname: string; text: string }) {
    try {
      const result = await this.danmuService.addDanmu(data.nickname, data.text);
      this.server.emit('add_danmu', { success: true, message: '添加弹幕成功' });
      return { success: true };
    } catch (error) {
      this.logger.error('添加弹幕失败:', error);
      this.server.emit('add_danmu', { success: false, message: error.message || '添加弹幕失败' });
      return { success: false };
    }
  }

  /**
   * 启动定时更新任务
   * 每2秒从数据库获取最新弹幕数据并广播给所有客户端
   * @private
   */
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