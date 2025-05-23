import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Danmu } from '../../model/danmu.model';
import * as bcrypt from 'bcrypt';
import { log } from 'console';
import E, { wrapAsync } from '../../common/error';
import { EnhancedLoggerService } from '../../core/services/logger.service';
import { MusicService } from '../music/music.service';

@Injectable()
export class DanmuService {
  private readonly logger: EnhancedLoggerService;
  
  constructor(
    @InjectModel(Danmu)
    private readonly danmuModel: typeof Danmu,
    private readonly musicService: MusicService,
    loggerService: EnhancedLoggerService
  ) {
    this.logger = loggerService.setContext('DanmuService');
  }

  /**
   * 将日期格式化为 yyyy-MM-dd HH:mm:ss 格式
   * @param date 日期对象
   * @returns 格式化后的日期字符串
   */
  private formatDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  async updateStatus(uid: string, status: string) {
    try {
      const danmu = await this.danmuModel.findOne({
        where: { uid }
      });
      
      if (!danmu) {
        E.DANMU_NOT_FOUND.throw(`未找到ID为${uid}的弹幕`);
      }
      
      // 获取当前时间
      const now = new Date();
      const formattedNow = this.formatDateTime(now);
      
      // 如果状态变为pending，记录挂起时间
      if (status === 'pending') {
        await danmu.update({ 
          status,
          pendingTime: formattedNow
        });
      } 
      // 如果状态变为working，记录工作时间
      else if (status === 'working' && danmu.status !== 'pause') {
        await danmu.update({ 
          status,
          pendingTime: formattedNow, // 使用pendingTime记录开始工作时间
          workingDuration: 0 // 重置工作时长
        });
      }
      // 如果状态变为pause，计算工作时长并记录
      else if (status === 'pause' && danmu.status === 'working') {
        // 计算工作时长
        let workingDuration = danmu.workingDuration || 0;
        
        if (danmu.pendingTime) {
          const startWorkingTime = new Date(danmu.pendingTime);
          const pauseTime = now;
          
          // 计算本次工作时长（秒）
          const durationSeconds = Math.floor((pauseTime.getTime() - startWorkingTime.getTime()) / 1000);
          
          // 累加到总工作时长
          workingDuration += durationSeconds;
        }
        
        await danmu.update({ 
          status,
          pauseTime: formattedNow, // 记录暂停时间
          workingDuration // 更新累计工作时长
        });
      }
      // 如果从暂停状态恢复工作
      else if (status === 'working' && danmu.status === 'pause') {
        // 保留累计的工作时长，仅更新状态和开始时间
        await danmu.update({ 
          status,
          pendingTime: formattedNow, // 更新新一轮工作的开始时间
          // 注意：不重置workingDuration，保留之前累计的时长
        });
      }
      // 如果从pending或working恢复到waiting，清除挂起时间
      else if (status === 'waiting' && (danmu.status === 'pending' || danmu.status === 'working')) {
        await danmu.update({ 
          status,
          pendingTime: null,
          workingDuration: 0 // 重置工作时长
        });
      }
      // 其他状态变更
      else {
        await danmu.update({ status });
      }
      
      // 增加带有操作类型和昵称的日志记录，格式与保存弹幕一致
      const operationText = status === 'deleted' ? '删除' : 
                           status === 'completed' ? '完成' : 
                           status === 'pending' ? '挂起' :
                           status === 'working' && danmu.status === 'pause' ? '恢复工作' :
                           status === 'working' ? '开始工作' :
                           status === 'pause' ? '暂停工作' :
                           status === 'waiting' && danmu.status === 'pending' ? '恢复' :
                           status === 'waiting' && danmu.status === 'working' ? '停止工作' : '状态更新';
      this.logger.log(`弹幕${operationText}操作成功`, { 
        operation: operationText,
        nickname: danmu.nickname,
        text: danmu.text,
        uid: danmu.uid
      });
      
      return {
        success: true,
        data: {
          uid,
          status
        }
      };
    } catch (err) {
      // 处理错误情况
      this.logger.error(`更新弹幕状态失败: ${err.message}`, {
        uid,
        targetStatus: status,
        error: err
      });
      throw err;
    }
  }

  updateText = wrapAsync(async (uid: string, text: string) => {
    const danmu = await this.danmuModel.findOne({
      where: { uid }
    });
    
    if (!danmu) {
      E.DANMU_NOT_FOUND.throw(`未找到ID为${uid}的弹幕`);
    }
    
    await danmu.update({ text });
    
    // 增加带有操作类型和昵称的日志记录，格式与保存弹幕一致
    this.logger.log(`弹幕编辑操作成功`, { 
      operation: '编辑',
      nickname: danmu.nickname,
      text: text,
      uid: danmu.uid
    });
    
    return {
      success: true,
      data: {
        uid,
        text
      }
    };
  }, E.DANMU_UPDATE_FAILED);

/*
   * @param uid 用户ID
   * @returns 账号密码信息
   */
  async getAccountPassword(uid: string) {
    try {
      const result = await this.danmuModel.findOne({
        where: { uid },
        attributes: ['account', 'password']
      });
      if (!result) {
        throw new Error('未找到账号信息');
      }
      
      this.logger.debug('查询账号密码信息', { uid, hasAccount: !!result.account });
      
      // 用户账号密码以明文存储，直接返回
      const returnData = { action: 'get_acps', data: {account: result.account, password: result.password}, uid };
      return returnData;
    } catch (err) {
      this.logger.error('查询账号密码失败', { uid, error: err.message });
      return { action: 'get_acps', data: 1 };
    }
  }

  async updateAccountPassword(uid: string, account: string, password: string) {
    try {
      // 用户账号密码以明文存储，不再使用bcrypt加密
      await this.danmuModel.update({ account, password }, { where: { uid } });
      this.logger.log('更新账号密码成功', { uid });
      return { action: 'update_acps', success: true };
    } catch (err) {
      this.logger.error('更新账号密码失败', { uid, error: err.message });
      return { action: 'update_acps', success: false };
    }
  }

  /**
   * 添加新弹幕或更新已有弹幕
   * @param nickname 弹幕昵称
   * @param text 弹幕内容
   * @returns 添加或更新结果
   */
  async addDanmu(nickname: string, text: string) {
    try {
      if (!nickname || !text) {
        E.INVALID_PARAMS.throw('昵称和内容不能为空');
      }
      
      // 检查内容长度
      if (text.length > 200) {
        E.DANMU_TEXT_TOO_LONG.throw('弹幕内容不能超过200个字符');
      }
      
      // 检查是否是点歌请求
      let songInfo = null;
      let searchResult = null;
      if (text.startsWith('点歌') || text.startsWith('点歌 ')) {
        const songName = text.substring(text.startsWith('点歌 ') ? 3 : 2).trim();
        if (songName) {
          try {
            // 搜索歌曲
            this.logger.log(`收到点歌请求: "${songName}"`);
            searchResult = await this.musicService.searchSong(songName);
            
            // 不再自动获取默认歌曲的完整信息，而是返回搜索结果
            if (searchResult && searchResult.defaultSong) {
              this.logger.log(`找到匹配歌曲: ${searchResult.defaultSong.name} - ${searchResult.defaultSong.artist} (${searchResult.defaultSong.platform})`);
              // 只保存默认歌曲的基本信息，不获取完整信息
              songInfo = searchResult.defaultSong;
            } else {
              this.logger.warn(`点歌失败: 未找到歌曲 "${songName}"`);
            }
          } catch (error) {
            this.logger.error(`点歌过程中发生错误: ${error.message}`, { 
              songName, 
              errorStack: error.stack,
              errorCode: error.error || 'UNKNOWN_ERROR'
            });
            // 错误不会阻止弹幕创建
          }
        }
      }
      
      // 检查昵称是否已存在
      const existingDanmu = await this.danmuModel.findOne({
        where: { nickname }
      });
      
      let danmu;
      
      // 格式化当前时间为yyyy-MM-dd HH:mm:ss格式
      const now = new Date();
      const formattedTime = this.formatDateTime(now);
      
      if (existingDanmu) {
        // 如果昵称已存在，更新内容和状态
        existingDanmu.text = text;
        existingDanmu.status = 'waiting'; // 重置为等待状态
        existingDanmu.createtime = formattedTime; // 更新时间为标准格式
        await existingDanmu.save();
        
        danmu = existingDanmu;
        this.logger.log(`弹幕更新成功: ${nickname}, ID: ${danmu.uid}`, {
          operation: '保存',
          nickname,
          text,
          uid: danmu.uid
        });
      } else {
        // 如果昵称不存在，创建新弹幕
        danmu = await this.danmuModel.create({
          uid: Date.now().toString(),
          nickname,
          text,
          status: 'waiting',
          createtime: formattedTime, // 使用标准格式的时间
          account: '',
          password: ''
        });
        
        this.logger.log(`弹幕创建成功: ${nickname}, ID: ${danmu.uid}`, {
          operation: '保存',
          nickname,
          text,
          uid: danmu.uid
        });
      }
      
      return {
        success: true,
        data: danmu,
        songInfo,
        searchResult,
        isUpdate: !!existingDanmu
      };
    } catch (error) {
      this.logger.error('添加弹幕失败', { nickname, errorMessage: error.message, errorStack: error.stack });
      throw error;
    }
  }

  /**
   * 获取所有弹幕
   * @returns 所有弹幕数据
   */
  async getAllDanmu() {
    try {
      // 查询数据库中的所有弹幕
      const danmus = await this.danmuModel.findAll({
        raw: true, // 返回纯JSON对象而不是Sequelize模型实例
        order: [['createtime', 'DESC']] // 按创建时间倒序
      });
      
      this.logger.log(`成功查询到${danmus.length}条弹幕数据`);
      
      // 从查询结果提取数据并格式化
      const uid = [];
      const status = [];
      const nickname = [];
      const text = [];
      const account = [];
      const password = [];
      const createtime = [];
      const pendingTime = []; // 挂起/工作时间字段
      const pauseTime = []; // 暂停时间字段
      const workingDuration = []; // 工作时长字段
      
      // 遍历结果格式化数据 
      danmus.forEach(danmu => { 
        try {
          uid.push(danmu.uid);
          status.push(danmu.status);
          nickname.push(danmu.nickname);
          text.push(danmu.text);
          account.push(danmu.account || '');
          password.push(danmu.password || '');
          createtime.push(danmu.createtime);
          pendingTime.push(danmu.pendingTime || null); // 添加挂起/工作时间
          pauseTime.push(danmu.pauseTime || null); // 添加暂停时间
          
          // 安全地获取workingDuration，确保总是返回数字
          let duration = 0;
          if (typeof danmu.workingDuration === 'number') {
            duration = danmu.workingDuration;
          } else if (danmu.workingDuration && !isNaN(parseInt(danmu.workingDuration))) {
            duration = parseInt(danmu.workingDuration);
          }
          workingDuration.push(duration);
          
        } catch (err) {
          this.logger.error(`处理弹幕数据时出错: ${err.message}`, { uid: danmu.uid, error: err });
        }
      });
      
      // 返回格式化的数据
      return {
        uid,
        status,
        nickname,
        text,
        account,
        password,
        createtime,
        pendingTime, // 返回挂起/工作时间数组
        pauseTime, // 返回暂停时间数组
        workingDuration // 返回工作时长数组
      };
    } catch (error) {
      this.logger.error('获取弹幕数据失败', { error });
      
      // 发生错误时返回空数据结构
      return {
        uid: [],
        status: [],
        nickname: [],
        text: [],
        account: [],
        password: [],
        createtime: [],
        pendingTime: [],
        pauseTime: [],
        workingDuration: []
      };
    }
  }

  /**
   * 创建新的弹幕记录，如果uid已存在则更新记录
   * @param danmuData 弹幕数据
   * @returns 创建或更新的弹幕记录
   */
  async createDanmu(danmuData: any): Promise<Danmu> {
    try {
      if (danmuData.uid) {
        // 使用upsert操作，如果记录存在则更新，不存在则创建
        const [danmu, created] = await this.danmuModel.upsert(danmuData);
        
        if (created) {
          this.logger.log(`创建弹幕成功: ${danmu.uid}`);
        } else {
          this.logger.log(`更新弹幕成功: ${danmu.uid}`);
        }
        return danmu;
      }
      else {
        this.logger.log(`消息错误`);
        return null;
      }
    } catch (err) {
      this.logger.error('创建或更新弹幕失败:', err);
      throw E.DANMU_CREATE_FAILED.create('创建或更新弹幕失败', { originalError: err });
    }
  }

  /**
   * 获取管理员密码（uid为0的记录）
   * @returns 管理员密码哈希值
   */
  private async getAdminPassword(): Promise<string> {
    try {
      const admin = await this.danmuModel.findOne({
        where: { uid: '0' },
        attributes: ['password']
      });
      
      if (admin && admin.password) {
        this.logger.log('从数据库获取到管理员密码');
        return admin.password;
      } else {
        // 如果没有找到管理员记录，返回默认密码哈希值
        this.logger.warn('未找到管理员记录，使用默认密码');
        // 默认密码"admin"的bcrypt哈希值
        return '$2a$10$QUFOcJ/kpS5XOShQwQ1rUOELnRjZpjnUu7EgzXRvzlxynuLxJQMdq';
      }
    } catch (err) {
      this.logger.error('获取管理员密码失败:', err);
      // 出错时返回默认密码哈希值
      return '$2a$10$QUFOcJ/kpS5XOShQwQ1rUOELnRjZpjnUu7EgzXRvzlxynuLxJQMdq';
    }
  }

  /**
   * 验证管理员密码
   * @param password 前端传入的SHA-256哈希后的密码
   * @returns 验证结果
   */
  async verifyPassword(password: string): Promise<{action: string; success: boolean; message?: string; token?: string}> {
    try {
      this.logger.log('开始验证密码');
      
      // 获取数据库中存储的管理员密码（bcrypt加密后的）
      const adminPasswordHash = await this.getAdminPassword();
      this.logger.log(`传入的密码: ${password}`);

      // 使用bcrypt.compare验证密码
      const isMatch = await bcrypt.compare(password, adminPasswordHash);
      this.logger.log(`密码验证结果: ${isMatch}`);

      return { 
        action: 'verify_password', 
        success: isMatch,
        message: isMatch ? '验证成功' : '密码错误',
        token: undefined // 明确包含token字段，但值为undefined，让gateway填充
      };
    } catch (err) {
      this.logger.error('密码验证过程中发生错误:', err);
      return { action: 'verify_password', success: false, message: '验证过程发生错误', token: undefined };
    }
  }

  /**
   * 重置管理员密码
   * @param newPassword 新的明文密码
   * @returns 重置结果
   */
  async resetAdminPassword(newPassword: string): Promise<{success: boolean; message: string}> {
    try {
      // 管理员密码仍然使用bcrypt加密存储
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      
      // 查找管理员记录
      const admin = await this.danmuModel.findOne({
        where: { uid: '0' }
      });
      
      if (admin) {
        // 如果管理员记录存在，更新密码
        await this.danmuModel.update(
          { password: hashedPassword },
          { where: { uid: '0' } }
        );
      } else {
        // 如果管理员记录不存在，创建一个新记录
        await this.danmuModel.create({
          uid: '0',
          nickname: 'admin',
          text: 'Administrator account',
          account: 'admin',
          password: hashedPassword,
          status: 'notdisplay',
          createtime: new Date().toISOString()
        });
      }
      
      this.logger.log('管理员密码重置成功');
      return { success: true, message: '管理员密码重置成功' };
    } catch (err) {
      this.logger.error('重置管理员密码失败:', err);
      return { success: false, message: '重置管理员密码失败: ' + err.message };
    }
  }
}