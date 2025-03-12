import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, OnGatewayInit, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DanmuService } from './danmu.service';
import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { SecurityLoggerService } from '../../core/services/security-logger.service';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * 弹幕系统WebSocket网关
 * 处理实时弹幕通信、状态更新和账号管理
 * 默认监听5052端口，支持跨域访问
 */
@Injectable() 
@WebSocketGateway(5052, {
  cors: {
    origin: '*', // 临时允许所有来源
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'auth_token', 'content-type']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class DanmuGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(DanmuGateway.name);
  private authenticatedClients = new Set<string>();
  
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly danmuService: DanmuService,
    private readonly securityLogger: SecurityLoggerService
  ) {}

  afterInit() {
    this.logger.log('WebSocket 服务器初始化');
    this.startUpdateInterval();
  }

  async handleConnection(client: Socket) {
    this.logger.log(`新的客户端连接: ${client.id}`);
    this.logger.log(`客户端IP: ${client.handshake.address}`);
    this.logger.log(`客户端Headers: ${JSON.stringify(client.handshake.headers)}`);
    
    // 验证连接
    const token = client.handshake.auth.token;
    if (!token) {
      this.logger.warn(`客户端未提供认证令牌，以访客模式连接: ${client.id}`);
      await this.securityLogger.logAuthAttempt(client.handshake.address, true, 'Guest mode connection');
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      this.authenticatedClients.add(client.id);
      this.logger.log(`客户端认证成功: ${client.id}`);
      await this.securityLogger.logAuthAttempt(client.handshake.address, true);
    } catch (err) {
      this.logger.error(`客户端认证失败: ${client.id}`, err);
      await this.securityLogger.logAuthAttempt(client.handshake.address, false, err.message);
    }
  }

  private isAuthenticated(client: Socket): boolean {
    return this.authenticatedClients.has(client.id);
  }

  /**
   * 处理弹幕删除事件
   */
  @SubscribeMessage('delete')
  async handleDelete(@MessageBody() data: { index: string }, client: Socket) {
    try {
      if (!this.isAuthenticated(client)) {
        this.logger.warn(`未授权的删除操作，客户端ID: ${client.id}`);
        return { success: false, message: '未授权的操作' };
      }

      const result = await this.danmuService.updateStatus(data.index, 'deleted');
      this.server.emit('delete', result);
      return { success: true };
    } catch (error) {
      this.logger.error(`删除操作失败: ${error.message}`);
      return { success: false, message: '操作失败' };
    }
  }

  /**
   * 处理弹幕完成事件
   */
  @SubscribeMessage('completed')
  async handleCompleted(@MessageBody() data: { index: string }, client: Socket) {
    try {
      if (!this.isAuthenticated(client)) {
        this.logger.warn(`未授权的完成操作，客户端ID: ${client.id}`);
        return { success: false, message: '未授权的操作' };
      }

      const result = await this.danmuService.updateStatus(data.index, 'completed');
      this.server.emit('completed', result);
      return { success: true };
    } catch (error) {
      this.logger.error(`完成操作失败: ${error.message}`);
      return { success: false, message: '操作失败' };
    }
  }

  /**
   * 处理弹幕编辑事件
   */
  @SubscribeMessage('edit')
  async handleEdit(@MessageBody() data: { index: string; text: string }, client: Socket) {
    try {
      if (!this.isAuthenticated(client)) {
        this.logger.warn(`未授权的编辑操作，客户端ID: ${client.id}`);
        return { success: false, message: '未授权的操作' };
      }

      const result = await this.danmuService.updateText(data.index, data.text);
      this.server.emit('edit', result);
      return { success: true };
    } catch (error) {
      this.logger.error(`编辑操作失败: ${error.message}`);
      return { success: false, message: '操作失败' };
    }
  }

  /**
   * 获取账号密码信息
   */
  @SubscribeMessage('get_acps')
  async handleGetAcps(@MessageBody() data: { index: string }, client: Socket) {
    try {
      if (!this.isAuthenticated(client)) {
        this.logger.warn(`未授权的账密获取操作，客户端ID: ${client.id}`);
        return { success: false, message: '未授权的操作' };
      }

      const result = await this.danmuService.getAccountPassword(data.index);
      this.server.emit('get_acps', result);
      return { success: true };
    } catch (error) {
      this.logger.error(`获取账密信息失败: ${error.message}`);
      return { success: false, message: '操作失败' };
    }
  }

  /**
   * 验证管理员密码
   * @param data.password 待验证的SHA-256哈希密码
   * @returns {Promise<{success: boolean}>} 验证结果
   * @emits verify_password 广播验证结果给所有客户端
   */
  @SubscribeMessage('verify_password')
  async handleVerifyPassword(@MessageBody() data: { password: string }, client: Socket) {
    try {
      const result = await this.danmuService.verifyPassword(data.password);
      if (result.success) {
        const token = jwt.sign({ role: 'owner' }, JWT_SECRET, { expiresIn: '1h' });
        this.logger.log('密码验证成功，已生成JWT令牌');
        
        // 构建响应对象
        const response = {
          success: true,
          token: token,
          message: '验证成功'
        };
        
        // 使用server.emit发送响应
        this.server.emit('verify_password', response);
        
        return response;
      } else {
        const response = {
          success: false,
          message: '密码验证失败'
        };
        
        this.server.emit('verify_password', response);
        return response;
      }
    } catch (error) {
      this.logger.error(`验证过程发生错误: ${error.message}`);
      
      const errorResponse = {
        success: false,
        message: '验证过程发生错误'
      };
      
      this.server.emit('verify_password', errorResponse);
      return errorResponse;
    }
  }

  /**
   * 更新账号密码信息
   */
  @SubscribeMessage('update_acps')
  async handleUpdateAcps(@MessageBody() data: { index: string; text: string }, client: Socket) {
    try {
      if (!this.isAuthenticated(client)) {
        this.logger.warn(`未授权的账密更新操作，客户端ID: ${client.id}`);
        return { success: false, message: '未授权的操作' };
      }

      const [account, password] = data.text.split(' / ');
      const result = await this.danmuService.updateAccountPassword(data.index, account, password);
      this.server.emit('update_acps', result);
      return { success: true };
    } catch (error) {
      this.logger.error(`更新账密信息失败: ${error.message}`);
      return { success: false, message: '操作失败' };
    }
  }

  /**
   * 处理添加弹幕事件
   */
  @SubscribeMessage('add_danmu')
  async handleAddDanmu(@MessageBody() data: { nickname: string; text: string }, client: Socket) {
    try {
      if (!this.isAuthenticated(client)) {
        this.logger.warn(`未授权的添加弹幕操作，客户端ID: ${client.id}`);
        return { success: false, message: '未授权的操作' };
      }

      const result = await this.danmuService.addDanmu(data.nickname, data.text);
      this.server.emit('add_danmu', { success: true, message: '添加弹幕成功' });
      return { success: true };
    } catch (error) {
      this.logger.error(`添加弹幕失败: ${error.message}`);
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

  /**
   * 重置管理员密码
   * @param data.newPassword 新的管理员密码
   * @returns {Promise<{success: boolean}>} 重置操作的结果
   */
  @SubscribeMessage('reset_admin_password')
  async handleResetAdminPassword(@MessageBody() data: { newPassword: string }, client: Socket) {
    const clientIp = client?.handshake?.address || 'unknown';
    
    // 只允许已认证的用户重置密码
    if (!this.isAuthenticated(client)) {
      await this.securityLogger.logUnauthorizedAccess(clientIp, 'reset_admin_password', 'Attempted to reset admin password without authentication');
      return { success: false, message: '未授权的操作' };
    }
    
    // 验证新密码的强度
    if (!data.newPassword || data.newPassword.length < 8) {
      return { success: false, message: '密码长度必须至少为8个字符' };
    }
    
    try {
      const result = await this.danmuService.resetAdminPassword(data.newPassword);
      
      if (result.success) {
        await this.securityLogger.logSecurityEvent('reset_admin_password', `Admin password reset by ${clientIp}`);
        this.logger.log(`管理员密码重置成功，客户端IP: ${clientIp}`);
      } else {
        await this.securityLogger.logSuspiciousActivity(clientIp, 'reset_admin_password_failed', result.message);
        this.logger.error(`管理员密码重置失败，客户端IP: ${clientIp}`, result.message);
      }
      
      return result;
    } catch (error) {
      this.logger.error('重置管理员密码时发生错误:', error);
      return { success: false, message: '重置密码时发生错误' };
    }
  }
}