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
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5051', 'http://127.0.0.1:5051'],
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'auth_token']
  },
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
    const clientIp = client.handshake.address;
    this.logger.log(`客户端尝试连接: ${clientIp}`);
    
    // 验证连接
    const token = client.handshake.auth.token;
    if (!token) {
      this.logger.warn(`客户端未提供认证令牌，以访客模式连接: ${clientIp}`);
      await this.securityLogger.logAuthAttempt(clientIp, true, 'Guest mode connection');
      // 允许未认证用户连接，但不添加到authenticatedClients列表
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      this.authenticatedClients.add(client.id);
      this.logger.log(`客户端认证成功: ${clientIp}`);
      await this.securityLogger.logAuthAttempt(clientIp, true);
    } catch (err) {
      this.logger.error(`客户端认证失败: ${clientIp}`, err);
      await this.securityLogger.logAuthAttempt(clientIp, false, err.message);
      // 允许连接，但不添加到authenticatedClients列表
      // client.disconnect(); // 不再断开连接
    }
  }

  private isAuthenticated(client: Socket): boolean {
    return this.authenticatedClients.has(client.id);
  }

  /**
   * 处理弹幕删除事件
   * @param data.index 要删除的弹幕ID
   * @returns {Promise<{success: boolean}>} 删除操作的结果
   * @emits delete 广播删除结果给所有客户端
   */
  @SubscribeMessage('delete')
  async handleDelete(@MessageBody() data: { index: string }, client: Socket) {
    const clientIp = client.handshake.address;
    if (!this.isAuthenticated(client)) {
      await this.securityLogger.logUnauthorizedAccess(clientIp, 'delete', `Attempted to delete danmu ${data.index}`);
      return { success: false, message: '未授权的操作' };
    }
    const result = await this.danmuService.updateStatus(data.index, 'deleted');
    await this.securityLogger.logSecurityEvent('delete', `Danmu ${data.index} deleted by ${clientIp}`);
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
  async handleCompleted(@MessageBody() data: { index: string }, client: Socket) {
    if (!this.isAuthenticated(client)) {
      return { success: false, message: '未授权的操作' };
    }
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
  async handleEdit(@MessageBody() data: { index: string; text: string }, client: Socket) {
    if (!this.isAuthenticated(client)) {
      return { success: false, message: '未授权的操作' };
    }
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
  async handleGetAcps(@MessageBody() data: { index: string }, client: Socket) {
    if (!this.isAuthenticated(client)) {
      return { success: false, message: '未授权的操作' };
    }
    const result = await this.danmuService.getAccountPassword(data.index);
    this.server.emit('get_acps', result);
    return { success: true };
  }

  /**
   * 验证管理员密码
   * @param data.password 待验证的SHA-256哈希密码
   * @returns {Promise<{success: boolean}>} 验证结果
   * @emits verify_password 广播验证结果给所有客户端
   */
  @SubscribeMessage('verify_password')
  async handleVerifyPassword(@MessageBody() data: { password: string }, client: Socket) {
    const clientIp = client?.handshake?.address || 'unknown';
    this.logger.log(`收到密码验证请求，客户端IP: ${clientIp}`);
    // 验证密码
    this.logger.log('调用DanmuService.verifyPassword进行验证');
    const result = await this.danmuService.verifyPassword(data.password);
    
    if (result.success) {
      this.logger.log('密码验证成功，生成JWT令牌');
      // 生成JWT令牌
      const token = jwt.sign({ role: 'owner' }, JWT_SECRET, { expiresIn: '1h' });
      this.logger.log(`生成的JWT令牌: ${token.substring(0, 20)}...`);
      
      if (client) {
        this.logger.log(`将客户端 ${client.id} 添加到已认证客户端列表`);
        this.authenticatedClients.add(client.id);
      }
      
      // 确保token字段被正确设置
      result.token = token;
      this.logger.log('令牌已添加到验证结果中');
      
      await this.securityLogger.logAuthAttempt(clientIp, true, 'Password verification successful');
      this.logger.log(`密码验证成功，客户端IP: ${clientIp}`);
    } else {
      this.logger.warn(`密码验证失败，客户端IP: ${clientIp}`);
      await this.securityLogger.logAuthAttempt(clientIp, false, 'Invalid password');
    }
    
    if (client) {
      this.logger.log('向客户端发送验证结果');
      this.logger.log(`验证结果包含令牌: ${result.token ? '是' : '否'}`);
      client.emit('verify_password', result);
    }
    
    return result;
  }

  /**
   * 更新账号密码信息
   * @param data.index 弹幕ID
   * @param data.text 新的账号密码信息，格式为"account / password"
   * @returns {Promise<{success: boolean}>} 更新操作的结果
   * @emits update_acps 广播更新结果给所有客户端
   */
  @SubscribeMessage('update_acps')
  async handleUpdateAcps(@MessageBody() data: { index: string; text: string }, client: Socket) {
    const clientIp = client.handshake.address;
    if (!this.isAuthenticated(client)) {
      await this.securityLogger.logUnauthorizedAccess(clientIp, 'update_acps', `Attempted to update account/password for danmu ${data.index}`);
      return { success: false, message: '未授权的操作' };
    }
    const [account, password] = data.text.split(' / ');
    const result = await this.danmuService.updateAccountPassword(data.index, account, password);
    await this.securityLogger.logSecurityEvent('update_acps', `Account/password updated for danmu ${data.index} by ${clientIp}`);
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
  async handleAddDanmu(@MessageBody() data: { nickname: string; text: string }, client: Socket) {
    try {
      // 添加弹幕需要认证
      if (!this.isAuthenticated(client)) {
        return { success: false, message: '未授权的操作' };
      }
      
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