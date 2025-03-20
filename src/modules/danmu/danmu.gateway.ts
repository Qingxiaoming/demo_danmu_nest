import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, OnGatewayInit, OnGatewayConnection, WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DanmuService } from './danmu.service';
import { Injectable, Logger, UseGuards } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { SecurityLoggerService } from '../../core/services/security-logger.service';
import E, { normalizeError } from '../../common/error';
import { EnhancedLoggerService } from '../../core/services/logger.service';
import { BilibiliService } from './bilibili.service';
import { MusicService } from '../music/music.service';
import { Song } from '../music/music.types';
import { Interval } from '@nestjs/schedule';
import { DanmuConfig } from '../../config/danmu.config';

/**
 * 处理WebSocket错误并返回标准格式
 * @param error 错误对象
 * @returns 标准格式的错误响应
 */
function handleWsError(error: any) {
  // 使用normalizeError函数处理错误
  const standardError = normalizeError(error);
  
  return { 
    success: false, 
    error: standardError.error,
    message: standardError.message,
    data: standardError.data
  };
}

/**
 * 弹幕系统WebSocket网关
 * 处理实时弹幕通信、状态更新和账号管理
 * 默认监听5052端口，支持跨域访问
 */
@Injectable() 
@WebSocketGateway(DanmuConfig.websocket.port, DanmuConfig.websocket)
export class DanmuGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger: EnhancedLoggerService;
  private authenticatedClients = new Set<string>();
  // 跟踪客户端连接状态，避免重复认证
  private clientConnectionState = new Map<string, {
    ip: string;
    authenticated: boolean;
    lastAuth: number;
    reconnectCount: number;
  }>();
  // 认证冷却时间（毫秒）
  private readonly AUTH_COOLDOWN_MS = DanmuConfig.auth.cooldownMs; // 5分钟
  
  // B站弹幕相关
  private readonly roomId = DanmuConfig.bilibili.roomId; // B站直播间ID，与原始b.js保持一致
  private readonly printedDanmuIds = new Set(); // 存储已处理的弹幕ID，避免重复处理
  private readonly filterKeyword = DanmuConfig.bilibili.filterKeyword; // 需要过滤的关键词，只有包含此关键词的弹幕才会被保存
  
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly danmuService: DanmuService,
    private readonly securityLogger: SecurityLoggerService,
    private readonly bilibiliService: BilibiliService,
    private readonly musicService: MusicService,
    loggerService: EnhancedLoggerService
  ) {
    this.logger = loggerService.setContext('DanmuGateway');
  }

  afterInit() {
    this.logger.log('WebSocket 服务器初始化');
    this.startUpdateInterval();
    
    // 定期清理断开连接的客户端状态
    setInterval(() => this.cleanupDisconnectedClients(), DanmuConfig.system.clientCleanupInterval);
  }
  
  /**
   * 每30秒从B站获取一次弹幕数据
   */
  @Interval(30000)
  async fetchBilibiliDanmu() {
    try {
      const danmuList = await this.bilibiliService.getDanmu(this.roomId);
      if (danmuList && danmuList.length > 0) {
        for (const danmu of danmuList) {
          const danmuId = danmu.id_str || danmu.uid; // 弹幕的唯一标识符
          
          // 避免重复处理同一条弹幕
          if (!this.printedDanmuIds.has(danmuId)) {
            // 记录弹幕内容
            this.logger.log('收到B站弹幕', { 
              nickname: danmu.nickname, 
              time: new Date().toLocaleString(), 
              text: danmu.text 
            });
            
            // 检查是否是点歌请求
            if (danmu.text.startsWith('点歌') || danmu.text.startsWith('点歌 ')) {
              await this.handleBilibiliSongRequest(danmu);
            }
            
            // 检查弹幕内容是否包含指定关键词
            if (danmu.text.includes(this.filterKeyword)) {
              this.logger.log(`弹幕包含关键词"${this.filterKeyword}"，保存到数据库`, {
                nickname: danmu.nickname,
                text: danmu.text
              });
              
              await this.danmuService.createDanmu({
                uid: danmu.uid.toString(), // 直接使用B站弹幕的原始uid
                nickname: danmu.nickname,
                text: danmu.text,
                status: 'waiting', 
                createtime: new Date()
              });
            }
            // 将弹幕ID添加到已处理集合中
            this.printedDanmuIds.add(danmuId);
          }
        }
      } else {
        this.logger.debug('没有新的B站弹幕数据');
      }
    } catch (error) {
      this.logger.error('获取并保存B站弹幕时发生错误', { 
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * 处理B站弹幕中的点歌请求
   * @param danmu B站弹幕数据
   */
  private async handleBilibiliSongRequest(danmu: any) {
    const songName = danmu.text.substring(danmu.text.startsWith('点歌 ') ? 3 : 2).trim();
    if (!songName) return;
    
    try {
      // 搜索歌曲
      this.logger.log(`收到B站点歌请求: "${songName}" 来自: ${danmu.nickname}`);
      const searchResult = await this.musicService.searchSong(songName);
      
      if (searchResult && searchResult.defaultSong) {
        this.logger.log(`找到匹配歌曲: ${searchResult.defaultSong.name} - ${searchResult.defaultSong.artist} (${searchResult.defaultSong.platform})`);
        
        // 发送搜索结果到前端，让用户选择
        const allSongs = [];
        searchResult.results.forEach(platformResult => {
          if (platformResult.songs && platformResult.songs.length > 0) {
            platformResult.songs.forEach(song => allSongs.push(song));
          }
        });
        
        if (allSongs.length > 0) {
          this.logger.log(`发送${allSongs.length}首歌曲搜索结果到前端`);
          this.server.emit('song_search_results', {
            success: true,
            keyword: searchResult.keyword,
            songs: allSongs
          });
        } else {
          this.logger.warn(`B站点歌失败: 未找到可播放的歌曲 "${songName}"`);
        }
      } else {
        this.logger.warn(`B站点歌失败: 未找到歌曲 "${songName}"`);
      }
    } catch (error) {
      this.logger.error(`B站点歌过程中发生错误: ${error.message}`, { 
        songName, 
        nickname: danmu.nickname,
        errorCode: error.error || 'UNKNOWN_ERROR'
      });
    }
  }

  // 清理长时间未活动的客户端状态
  private cleanupDisconnectedClients() {
    const now = Date.now();
    
    for (const [clientId, state] of this.clientConnectionState.entries()) {
      if (now - state.lastAuth > DanmuConfig.system.clientExpireTime) {
        this.clientConnectionState.delete(clientId);
        this.authenticatedClients.delete(clientId);
      }
    }
    
    this.logger.log('已清理长时间未活动的客户端状态', {
      remainingClients: this.clientConnectionState.size,
      authenticatedClients: this.authenticatedClients.size
    });
  }

  async handleConnection(client: Socket) {
    const clientIp = client.handshake.address;
    const clientId = client.id;
    const now = Date.now();
    
    // 检查是否是已知客户端的重连
    const existingState = this.clientConnectionState.get(clientId);
    const isReconnect = existingState !== undefined;
    
    // 连接信息
    const connectionInfo = {
      clientId,
      ip: clientIp,
      isReconnect,
      reconnectCount: isReconnect ? existingState.reconnectCount + 1 : 0,
      timestamp: new Date().toISOString()
    };
    
    this.logger.log('客户端连接', connectionInfo);
    
    // 验证连接
    const token = client.handshake.auth.token;
    
    // 更新或创建客户端状态
    if (isReconnect) {
      // 更新重连次数
      existingState.reconnectCount++;
      
      // 如果是短时间内的重连，且认证状态未变，则不重新记录认证日志
      const isAuthStatusUnchanged = 
        (!!token === existingState.authenticated) && 
        (now - existingState.lastAuth < DanmuConfig.auth.cooldownMs);
      
      if (isAuthStatusUnchanged) {
        // 仅在认证状态变化或超过冷却时间时记录日志
        if (token) {
          try {
            const decoded = jwt.verify(token, DanmuConfig.auth.jwtSecret);
            this.authenticatedClients.add(clientId);
            this.logger.log('客户端重连，保持认证状态', { 
              clientId, 
              role: decoded['role'],
              reconnectCount: existingState.reconnectCount
            });
          } catch (err) {
            this.authenticatedClients.delete(clientId);
            this.logger.error('客户端重连，令牌验证失败', { 
              clientId, 
              error: err.message
            });
            await this.securityLogger.logAuthAttempt(clientIp, false, err.message);
          }
        }
        
        // 更新最后认证时间
        existingState.lastAuth = now;
        return;
      }
    }
    
    // 处理新连接或认证状态变化的重连
    if (!token) {
      this.logger.warn('客户端未提供认证令牌，以访客模式连接', { clientId });
      await this.securityLogger.logAuthAttempt(clientIp, true, 'Guest mode connection');
      
      this.clientConnectionState.set(clientId, {
        ip: clientIp,
        authenticated: false,
        lastAuth: now,
        reconnectCount: isReconnect ? existingState.reconnectCount : 0
      });
      
      return;
    }

    try {
      const decoded = jwt.verify(token, DanmuConfig.auth.jwtSecret);
      this.authenticatedClients.add(clientId);
      this.logger.log('客户端认证成功', { 
        clientId, 
        role: decoded['role'],
        exp: new Date(decoded['exp'] * 1000).toISOString()
      });
      
      await this.securityLogger.logAuthAttempt(clientIp, true);
      
      this.clientConnectionState.set(clientId, {
        ip: clientIp,
        authenticated: true,
        lastAuth: now,
        reconnectCount: isReconnect ? existingState.reconnectCount : 0
      });
      
    } catch (err) {
      this.authenticatedClients.delete(clientId);
      this.logger.error('客户端认证失败', { 
        clientId, 
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
      
      // 使用标准错误格式
      await this.securityLogger.logAuthAttempt(clientIp, false, err.message);
      
      this.clientConnectionState.set(clientId, {
        ip: clientIp,
        authenticated: false,
        lastAuth: now,
        reconnectCount: isReconnect ? existingState.reconnectCount : 0
      });
    }
  }

  // 处理客户端断开连接
  handleDisconnect(client: Socket) {
    const clientId = client.id;
    const state = this.clientConnectionState.get(clientId);
    
    if (state) {
      this.logger.log('客户端断开连接', { 
        clientId,
        authenticated: state.authenticated,
        reconnectCount: state.reconnectCount
      });
    } else {
      this.logger.log('未知客户端断开连接', { clientId });
    }
    
    // 不立即删除状态，以便处理重连
  }

  private isAuthenticated(client: Socket): boolean {
    return this.authenticatedClients.has(client.id);
  }

  /**
   * 处理弹幕删除事件
   */
  @SubscribeMessage('delete')
  async handleDelete(client: Socket, payload: any) {
    try {
      const index = payload?.index;
      
      if (!index) {
        this.logger.warn('删除请求缺少必要参数', { 
          clientId: client.id, 
          payload,
          errorCode: E.INVALID_PARAMS.error
        });
        throw E.INVALID_PARAMS;
      }
      
      this.logger.log('处理删除请求', { 
        clientId: client.id, 
        danmuId: index 
      });
      
      if (!this.isAuthenticated(client)) {
        this.logger.warn('未授权的删除操作', { 
          clientId: client.id, 
          danmuId: index,
          errorCode: E.AUTH_FAILED.error
        });
        throw E.AUTH_FAILED;
      }

      const result = await this.danmuService.updateStatus(index, 'deleted');
      this.server.emit('delete', result);
      this.logger.log('删除操作成功', { 
        clientId: client.id, 
        danmuId: index 
      });
      return { success: true };
    } catch (error) {
      const errorInfo = {
        clientId: client.id,
        danmuId: payload?.index,
        errorCode: error.error || E.UNDEFINED.error,
        errorMessage: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
      
      this.logger.error('删除操作失败', errorInfo);
      return handleWsError(error);
    }
  }

  /**
   * 处理弹幕完成事件
   */
  @SubscribeMessage('completed')
  async handleCompleted(client: Socket, payload: any) {
    try {
      const index = payload?.index;
      
      if (!index) {
        this.logger.warn('完成请求缺少必要参数', { 
          clientId: client.id, 
          payload,
          errorCode: E.INVALID_PARAMS.error
        });
        throw E.INVALID_PARAMS;
      }
      
      if (!this.isAuthenticated(client)) {
        this.logger.warn('未授权的完成操作', { 
          clientId: client.id, 
          danmuId: index,
          errorCode: E.AUTH_FAILED.error
        });
        throw E.AUTH_FAILED;
      }

      const result = await this.danmuService.updateStatus(index, 'completed');
      this.server.emit('completed', result);
      this.logger.log('完成操作成功', { 
        clientId: client.id, 
        danmuId: index 
      });
      return { success: true };
    } catch (error) {
      const errorInfo = {
        clientId: client.id,
        danmuId: payload?.index,
        errorCode: error.error || E.UNDEFINED.error,
        errorMessage: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
      
      this.logger.error('完成操作失败', errorInfo);
      return handleWsError(error);
    }
  }

  /**
   * 处理弹幕编辑事件
   */
  @SubscribeMessage('edit')
  async handleEdit(client: Socket, payload: any) {
    try {
      const { index, text } = payload || {};
      
      if (!index || text === undefined) {
        this.logger.warn('编辑请求缺少必要参数', { 
          clientId: client.id, 
          payload,
          errorCode: E.INVALID_PARAMS.error
        });
        throw E.INVALID_PARAMS;
      }
      
      if (!this.isAuthenticated(client)) {
        this.logger.warn('未授权的编辑操作', { 
          clientId: client.id, 
          danmuId: index,
          errorCode: E.AUTH_FAILED.error
        });
        throw E.AUTH_FAILED;
      }

      const result = await this.danmuService.updateText(index, text);
      this.server.emit('edit', result);
      this.logger.log('编辑操作成功', { 
        clientId: client.id, 
        danmuId: index 
      });
      return { success: true };
    } catch (error) {
      const errorInfo = {
        clientId: client.id,
        danmuId: payload?.index,
        errorCode: error.error || E.UNDEFINED.error,
        errorMessage: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
      
      this.logger.error('编辑操作失败', errorInfo);
      return handleWsError(error);
    }
  }

  /**
   * 获取账号密码信息
   */
  @SubscribeMessage('get_acps')
  async handleGetAcps(client: Socket, payload: any) {
    try {
      const index = payload?.index;
      
      if (!index) {
        this.logger.warn('获取账密请求缺少必要参数', { 
          clientId: client.id, 
          payload,
          errorCode: E.INVALID_PARAMS.error
        });
        throw E.INVALID_PARAMS;
      }
      
      if (!this.isAuthenticated(client)) {
        this.logger.warn('未授权的账密获取操作', { 
          clientId: client.id, 
          danmuId: index,
          errorCode: E.AUTH_FAILED.error
        });
        throw E.AUTH_FAILED;
      }

      const result = await this.danmuService.getAccountPassword(index);
      this.server.emit('get_acps', result);
      this.logger.log('获取账密操作成功', { 
        clientId: client.id, 
        danmuId: index 
      });
      return { success: true };
    } catch (error) {
      const errorInfo = {
        clientId: client.id,
        danmuId: payload?.index,
        errorCode: error.error || E.UNDEFINED.error,
        errorMessage: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
      
      this.logger.error('获取账密信息失败', errorInfo);
      return handleWsError(error);
    }
  }

  /**
   * 验证管理员密码
   * @param payload.password 待验证的SHA-256哈希密码
   * @returns {Promise<{success: boolean}>} 验证结果
   * @emits verify_password 广播验证结果给所有客户端
   */
  @SubscribeMessage('verify_password')
  async handleVerifyPassword(client: Socket, payload: any) {
    try {
      const password = payload?.password;
      
      if (!password) {
        this.logger.warn('验证请求缺少必要参数', { 
          clientId: client.id, 
          errorCode: E.INVALID_PARAMS.error
        });
        // 使用更具体的错误
        E.DANMU_PASSWORD_INVALID.throw('密码参数不能为空');
      }
      
      const result = await this.danmuService.verifyPassword(password);
      if (result.success) {
        // 生成更长有效期的令牌，减少重新认证次数
        const token = jwt.sign({ role: 'owner' }, DanmuConfig.auth.jwtSecret, { expiresIn: '12h' });
        this.logger.log('密码验证成功，已生成JWT令牌', {
          clientId: client.id,
          tokenExp: new Date(Date.now() + 12 * 3600000).toISOString()
        });
        
        // 立即将客户端添加到已认证集合中
        this.authenticatedClients.add(client.id);
        
        // 更新客户端连接状态
        const now = Date.now();
        this.clientConnectionState.set(client.id, {
          ip: client.handshake.address,
          authenticated: true,
          lastAuth: now,
          reconnectCount: this.clientConnectionState.get(client.id)?.reconnectCount || 0
        });
        
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
        this.logger.warn('密码验证失败', { 
          clientId: client.id,
          errorCode: E.INVALID_PASSWORD.error
        });
        // 使用throw方法
        E.INVALID_PASSWORD.throw();
      }
    } catch (error) {
      const errorInfo = {
        clientId: client.id,
        errorCode: error.error || E.UNDEFINED.error,
        errorMessage: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
      
      this.logger.error('验证过程发生错误', errorInfo);
      
      const errorResponse = handleWsError(error);
      this.server.emit('verify_password', errorResponse);
      return errorResponse;
    }
  }

  /**
   * 更新账号密码信息
   */
  @SubscribeMessage('update_acps')
  async handleUpdateAcps(client: Socket, payload: any) {
    try {
      const { index, text } = payload || {};
      
      if (!index || !text) {
        this.logger.warn('更新账密请求缺少必要参数', { 
          clientId: client.id, 
          payload,
          errorCode: E.INVALID_PARAMS.error
        });
        throw E.INVALID_PARAMS;
      }
      
      if (!this.isAuthenticated(client)) {
        this.logger.warn('未授权的账密更新操作', { 
          clientId: client.id, 
          danmuId: index,
          errorCode: E.AUTH_FAILED.error
        });
        throw E.AUTH_FAILED;
      }

      const [account, password] = text.split(' / ');
      if (!account || !password) {
        this.logger.warn('账号密码格式错误', { 
          clientId: client.id, 
          danmuId: index,
          errorCode: E.INVALID_PARAMS.error
        });
        // 使用更具体的错误
        E.DANMU_ACCOUNT_INVALID.throw('账号密码格式错误，应为"账号 / 密码"格式');
      }
      
      const result = await this.danmuService.updateAccountPassword(index, account, password);
      this.server.emit('update_acps', result);
      this.logger.log('更新账密操作成功', { 
        clientId: client.id, 
        danmuId: index 
      });
      return { success: true };
    } catch (error) {
      const errorInfo = {
        clientId: client.id,
        danmuId: payload?.index,
        errorCode: error.error || E.UNDEFINED.error,
        errorMessage: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
      
      this.logger.error('更新账密信息失败', errorInfo);
      return handleWsError(error);
    }
  }

  /**
   * 处理添加弹幕事件
   */
  @SubscribeMessage('add_danmu')
  async handleAddDanmu(client: Socket, payload: any) {
    try {
      const { nickname, text } = payload || {};
      
      if (!nickname) {
        this.logger.warn('添加弹幕请求缺少昵称参数', { 
          clientId: client.id, 
          errorCode: E.DANMU_NICKNAME_INVALID.error
        });
        throw E.DANMU_NICKNAME_INVALID;
      }
      
      if (!text) {
        this.logger.warn('添加弹幕请求缺少内容参数', { 
          clientId: client.id, 
          errorCode: E.DANMU_TEXT_EMPTY.error
        });
        throw E.DANMU_TEXT_EMPTY;
      }
      
      if (!this.isAuthenticated(client)) {
        this.logger.warn('未授权的添加弹幕操作', { 
          clientId: client.id,
          errorCode: E.AUTH_FAILED.error
        });
        throw E.AUTH_FAILED;
      }

      const result = await this.danmuService.addDanmu(nickname, text);
      
      // 检查是否是点歌请求
      if (text.startsWith('点歌') || text.startsWith('点歌 ')) {
        const songName = text.substring(text.startsWith('点歌 ') ? 3 : 2).trim();
        if (songName) {
          // 如果有搜索结果，发送到前端
          if (result.searchResult && result.searchResult.results) {
            // 收集所有平台的歌曲
            const allSongs = [];
            result.searchResult.results.forEach(platformResult => {
              if (platformResult.songs && platformResult.songs.length > 0) {
                platformResult.songs.forEach(song => allSongs.push(song));
              }
            });
            
            if (allSongs.length > 0) {
              this.logger.log(`发送${allSongs.length}首歌曲搜索结果到前端`);
              this.server.emit('song_search_results', {
                success: true,
                keyword: result.searchResult.keyword,
                songs: allSongs
              });
              
              // 发送添加/更新成功的消息
              const successMessage = result.isUpdate ? '更新弹幕成功' : '添加弹幕成功';
              this.server.emit('add_danmu', { 
                success: true, 
                message: successMessage,
                isUpdate: result.isUpdate
              });
              
              this.logger.log(`${result.isUpdate ? '更新' : '添加'}弹幕操作成功`, { 
                clientId: client.id, 
                nickname,
                textLength: text.length,
                isSongRequest: true,
                isUpdate: result.isUpdate
              });
              
              return { success: true, isUpdate: result.isUpdate };
            }
          }
          
          // 如果没有找到歌曲，发送空结果
          this.server.emit('song_search_results', {
            success: false,
            message: '未找到相关歌曲'
          });
        }
      }
      
      // 发送添加/更新成功的消息
      const successMessage = result.isUpdate ? '更新弹幕成功' : '添加弹幕成功';
      this.server.emit('add_danmu', { 
        success: true, 
        message: successMessage,
        isUpdate: result.isUpdate
      });
      
      this.logger.log(`${result.isUpdate ? '更新' : '添加'}弹幕操作成功`, { 
        clientId: client.id, 
        nickname,
        textLength: text.length,
        isSongRequest: text.startsWith('点歌'),
        isUpdate: result.isUpdate
      });
      
      return { success: true, isUpdate: result.isUpdate };
    } catch (error) {
      const errorInfo = {
        clientId: client.id,
        nickname: payload?.nickname,
        errorCode: error.error || E.UNDEFINED.error,
        errorMessage: error.message
      };
      
      this.logger.error('添加弹幕失败', errorInfo);
      const errorResponse = handleWsError(error);
      this.server.emit('add_danmu', errorResponse);
      return errorResponse;
    }
  }

  /**
   * 处理播放选中歌曲事件
   */
  @SubscribeMessage('play_selected_song')
  async handlePlaySelectedSong(client: Socket, payload: any) {
    try {
      const { songId, platform } = payload || {};
      
      // 记录详细的请求信息
      this.logger.log('收到播放选中歌曲请求', { 
        clientId: client.id, 
        songId,
        platform
      });
      
      if (!songId || !platform) {
        this.logger.warn('播放选中歌曲请求缺少必要参数', { 
          clientId: client.id, 
          errorCode: E.INVALID_PARAMS.error
        });
        
        // 发送错误响应到客户端
        this.server.emit('play_song', {
          success: false,
          message: '请求缺少必要参数(songId或platform)',
          song: { id: songId, platform }
        });
        
        throw E.INVALID_PARAMS;
      }
      
      if (!this.isAuthenticated(client)) {
        this.logger.warn('未授权的播放歌曲操作', { 
          clientId: client.id,
          errorCode: E.AUTH_FAILED.error
        });
        
        // 发送错误响应到客户端
        this.server.emit('play_song', {
          success: false,
          message: '未授权的操作',
          song: { id: songId, platform }
        });
        
        throw E.AUTH_FAILED;
      }

      this.logger.log(`处理播放选中歌曲请求: ${songId} (${platform})`);
      
      // 根据ID和平台获取完整歌曲信息
      try {
        // 创建符合Song类型的最小化对象，使用占位符值
        this.logger.log(`开始获取歌曲URL和歌词: ${songId} (${platform})`);
        
        const song: Song = {
          id: songId,
          platform: platform,
          name: '加载中...',
          artist: '未知歌手',
          album: '',
          duration: 0,
          cover: ''
        };
        
        const fullSongInfo = await this.musicService.getFullSongInfo(song);
        
        if (fullSongInfo.url) {
          this.logger.log(`获取歌曲URL成功: ${songId} (${platform})`);
          this.server.emit('play_song', {
            success: true,
            song: {
              id: songId,
              platform: platform,
              url: fullSongInfo.url,
              lrc: fullSongInfo.lrc || ''
            }
          });
          return { success: true };
        } else {
          this.logger.warn(`获取歌曲URL失败: ${songId} (${platform})`, { 
            errorCode: fullSongInfo.error?.code || E.API_ERROR.error,
            errorMessage: fullSongInfo.error?.message || '未知错误'
          });
          
          this.server.emit('play_song', {
            success: false,
            song: {
              id: songId,
              platform: platform,
              error: {
                code: fullSongInfo.error?.code || E.API_ERROR.error,
                message: fullSongInfo.error?.message || '无法获取歌曲播放地址'
              }
            },
            message: fullSongInfo.error?.message || '无法获取歌曲播放地址'
          });
          return { success: false, message: '无法获取歌曲播放地址' };
        }
      } catch (error) {
        this.logger.error(`获取歌曲URL和歌词失败: ${error.message}`, {
          songId,
          platform,
          errorCode: error.error || E.API_ERROR.error
        });
        
        this.server.emit('play_song', {
          success: false,
          song: {
            id: songId,
            platform: platform,
            error: {
              code: error.error || E.API_ERROR.error,
              message: error.message || '获取歌曲信息失败'
            }
          },
          message: '获取歌曲信息失败: ' + error.message
        });
        
        return { success: false, message: '获取歌曲信息失败' };
      }
    } catch (error) {
      const errorInfo = {
        clientId: client.id,
        songId: payload?.songId,
        platform: payload?.platform,
        errorCode: error.error || E.UNDEFINED.error,
        errorMessage: error.message
      };
      
      this.logger.error('播放选中歌曲失败', errorInfo);
      return handleWsError(error);
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
        this.logger.error('更新数据时发生错误', {
          errorMessage: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }, DanmuConfig.system.updateInterval);
  }

}