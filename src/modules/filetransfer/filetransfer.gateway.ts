import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, OnGatewayInit, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { EnhancedLoggerService } from '../../core/services/logger.service';
import { DanmuConfig } from '../../config/danmu.config';

/**
 * 文件传输WebSocket网关
 * 处理同一局域网下的文件/文字互传功能
 * 复用弹幕系统的WebSocket端口
 */
@Injectable()
@WebSocketGateway(DanmuConfig.websocket.port, DanmuConfig.websocket)
export class FileTransferGateway implements OnGatewayInit {
  private readonly logger: EnhancedLoggerService;
  private readonly rooms = new Map<string, Set<string>>(); // 房间名称 -> 客户端ID集合
  
  @WebSocketServer()
  server: Server;

  constructor(loggerService: EnhancedLoggerService) {
    this.logger = loggerService.setContext('FileTransferGateway');
  }

  afterInit() {
    this.logger.log('文件传输服务初始化');
  }

  /**
   * 处理客户端断开连接
   * @param client 断开连接的客户端Socket
   */
  handleDisconnect(client: Socket) {
    // 从所有房间中移除断开的客户端
    this.removeClientFromAllRooms(client.id);
    this.logger.log('客户端断开文件传输连接', { clientId: client.id });
  }

  /**
   * 从所有房间移除指定客户端
   * @param clientId 客户端ID
   */
  private removeClientFromAllRooms(clientId: string) {
    for (const [roomName, clients] of this.rooms.entries()) {
      if (clients.has(clientId)) {
        clients.delete(clientId);
        
        // 如果房间为空，则删除该房间
        if (clients.size === 0) {
          this.rooms.delete(roomName);
          this.logger.log('房间已空，删除房间', { roomName });
        } else {
          // 通知房间内其他用户有客户端离开
          this.notifyRoomClientUpdate(roomName);
        }
      }
    }
  }

  /**
   * 通知房间内所有客户端用户数量变化
   * @param roomName 房间名称
   */
  private notifyRoomClientUpdate(roomName: string) {
    const clients = this.rooms.get(roomName);
    if (clients) {
      const message = {
        roomName,
        clients: clients.size
      };
      
      // 向房间内的所有客户端发送更新消息
      for (const clientId of clients) {
        this.server.to(clientId).emit('file_transfer_room_client_update', message);
      }
    }
  }

  /**
   * 处理加入/创建文件传输房间请求
   * @param client 客户端Socket
   * @param payload 包含roomName的参数
   */
  @SubscribeMessage('join_file_transfer_room')
  handleJoinRoom(client: Socket, payload: any) {
    try {
      const { roomName } = payload;
      
      if (!roomName) {
        client.emit('file_transfer_room_error', { message: '房间名称不能为空' });
        return;
      }
      
      // 首先从所有房间中移除该客户端
      this.removeClientFromAllRooms(client.id);
      
      // 获取或创建房间
      let room = this.rooms.get(roomName);
      if (!room) {
        room = new Set<string>();
        this.rooms.set(roomName, room);
        this.logger.log('创建新房间', { roomName });
      }
      
      // 将客户端添加到房间
      room.add(client.id);
      
      this.logger.log('客户端加入房间', { clientId: client.id, roomName, clientsCount: room.size });
      
      // 通知客户端已成功加入房间
      client.emit('file_transfer_room_joined', {
        roomName,
        clients: room.size
      });
      
      // 通知房间内其他客户端
      this.notifyRoomClientUpdate(roomName);
      
    } catch (error) {
      this.logger.error('加入房间时发生错误', { clientId: client.id, error: error.message });
      client.emit('file_transfer_room_error', { message: '加入房间失败: ' + error.message });
    }
  }

  /**
   * 处理离开文件传输房间请求
   * @param client 客户端Socket
   * @param payload 包含roomName的参数
   */
  @SubscribeMessage('leave_file_transfer_room')
  handleLeaveRoom(client: Socket, payload: any) {
    try {
      const { roomName } = payload;
      
      if (!roomName) {
        client.emit('file_transfer_room_error', { message: '房间名称不能为空' });
        return;
      }
      
      // 从房间中移除客户端
      const room = this.rooms.get(roomName);
      if (room && room.has(client.id)) {
        room.delete(client.id);
        
        this.logger.log('客户端离开房间', { clientId: client.id, roomName, remainingClients: room.size });
        
        // 如果房间为空，则删除该房间
        if (room.size === 0) {
          this.rooms.delete(roomName);
          this.logger.log('房间已空，删除房间', { roomName });
        } else {
          // 通知房间内其他用户
          this.notifyRoomClientUpdate(roomName);
        }
        
        // 通知客户端已成功离开房间
        client.emit('file_transfer_room_left', { roomName });
      }
      
    } catch (error) {
      this.logger.error('离开房间时发生错误', { clientId: client.id, error: error.message });
      client.emit('file_transfer_room_error', { message: '离开房间失败: ' + error.message });
    }
  }

  /**
   * 处理文件传输请求
   * @param client 客户端Socket
   * @param payload 包含文件信息的参数
   */
  @SubscribeMessage('file_transfer_offer')
  handleFileTransferOffer(client: Socket, payload: any) {
    try {
      const { id, name, type, size, roomName, timestamp } = payload;
      
      if (!id || !name || !roomName) {
        client.emit('file_transfer_error', { message: '文件传输参数不完整' });
        return;
      }
      
      // 获取房间
      const room = this.rooms.get(roomName);
      if (!room) {
        client.emit('file_transfer_error', { message: '指定的房间不存在' });
        return;
      }
      
      this.logger.log('接收到文件传输请求', { 
        clientId: client.id, 
        fileId: id, 
        fileName: name, 
        fileSize: size, 
        roomName,
        clientsInRoom: room.size
      });
      
      // 向房间内除发送者外的所有客户端转发文件信息
      for (const clientId of room) {
        if (clientId !== client.id) {
          this.server.to(clientId).emit('file_transfer_offer', {
            id,
            name,
            type,
            size,
            sender: client.id,
            roomName,
            timestamp
          });
        }
      }
      
    } catch (error) {
      this.logger.error('文件传输请求处理失败', { clientId: client.id, error: error.message });
      client.emit('file_transfer_error', { message: '文件传输请求失败: ' + error.message });
    }
  }

  /**
   * 处理文件块传输
   * @param client 客户端Socket
   * @param payload 包含文件块数据的参数
   */
  @SubscribeMessage('file_chunk')
  handleFileChunk(client: Socket, payload: any) {
    try {
      const { fileId, roomName, chunk, chunkIndex, totalChunks } = payload;
      
      if (!fileId || !roomName || chunk === undefined || chunkIndex === undefined || totalChunks === undefined) {
        client.emit('file_transfer_error', { message: '文件块参数不完整' });
        return;
      }
      
      // 获取房间
      const room = this.rooms.get(roomName);
      if (!room) {
        client.emit('file_transfer_error', { message: '指定的房间不存在' });
        return;
      }
      
      // 不记录每个块的日志，避免日志过多
      if (chunkIndex === 0 || chunkIndex === totalChunks - 1) {
        this.logger.log('文件块传输', { 
          clientId: client.id, 
          fileId, 
          chunkIndex, 
          totalChunks,
          roomName,
          chunkType: typeof chunk,
          isBuffer: Buffer.isBuffer(chunk),
          isArrayBuffer: chunk instanceof ArrayBuffer,
          dataType: chunk ? chunk.constructor.name : 'undefined'
        });
      }
      
      // 向房间内除发送者外的所有客户端转发文件块
      // 注意：这里不做任何数据转换，保持原始格式转发，由客户端处理兼容性
      for (const clientId of room) {
        if (clientId !== client.id) {
          this.server.to(clientId).emit('file_chunk', {
            fileId,
            chunk,
            chunkIndex,
            totalChunks
          });
        }
      }
      
    } catch (error) {
      this.logger.error('文件块传输失败', { clientId: client.id, error: error.message });
      client.emit('file_transfer_error', { message: '文件块传输失败: ' + error.message });
    }
  }

  /**
   * 处理文件传输完成通知
   * @param client 客户端Socket
   * @param payload 包含文件ID的参数
   */
  @SubscribeMessage('file_transfer_complete')
  handleFileTransferComplete(client: Socket, payload: any) {
    try {
      const { fileId, roomName } = payload;
      
      if (!fileId || !roomName) {
        client.emit('file_transfer_error', { message: '文件传输完成参数不完整' });
        return;
      }
      
      // 获取房间
      const room = this.rooms.get(roomName);
      if (!room) {
        client.emit('file_transfer_error', { message: '指定的房间不存在' });
        return;
      }
      
      this.logger.log('文件传输完成', { 
        clientId: client.id, 
        fileId, 
        roomName
      });
      
      // 向房间内除发送者外的所有客户端转发文件传输完成通知
      for (const clientId of room) {
        if (clientId !== client.id) {
          this.server.to(clientId).emit('file_transfer_complete', {
            fileId,
            senderId: client.id
          });
        }
      }
      
    } catch (error) {
      this.logger.error('文件传输完成通知失败', { clientId: client.id, error: error.message });
      client.emit('file_transfer_error', { message: '文件传输完成通知失败: ' + error.message });
    }
  }

  /**
   * 处理文字传输
   * @param client 客户端Socket
   * @param payload 包含文字内容的参数
   */
  @SubscribeMessage('text_transfer')
  handleTextTransfer(client: Socket, payload: any) {
    try {
      const { id, text, roomName, timestamp } = payload;
      
      if (!id || !text || !roomName) {
        client.emit('file_transfer_error', { message: '文字传输参数不完整' });
        return;
      }
      
      // 获取房间
      const room = this.rooms.get(roomName);
      if (!room) {
        client.emit('file_transfer_error', { message: '指定的房间不存在' });
        return;
      }
      
      this.logger.log('接收到文字传输', { 
        clientId: client.id, 
        textId: id, 
        textLength: text.length, 
        roomName
      });
      
      // 向房间内除发送者外的所有客户端转发文字
      for (const clientId of room) {
        if (clientId !== client.id) {
          this.server.to(clientId).emit('text_transfer', {
            id,
            text,
            sender: client.id,
            roomName,
            timestamp
          });
        }
      }
      
    } catch (error) {
      this.logger.error('文字传输失败', { clientId: client.id, error: error.message });
      client.emit('file_transfer_error', { message: '文字传输失败: ' + error.message });
    }
  }
} 