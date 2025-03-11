import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Danmu } from '../../model/danmu.model';
import * as bcrypt from 'bcrypt';
import { log } from 'console';

@Injectable()
export class DanmuService {
  private readonly logger = new Logger(DanmuService.name);
  
  constructor(@InjectModel(Danmu) private readonly danmuModel: typeof Danmu) {}

  async updateStatus(uid: string, status: string) {
    try {
      const result = await this.danmuModel.update({ status }, { where: { uid } });
      console.log(`${status === 'deleted' ? '删除' : '标记为已完成'}成功:`, result);
      return { success: `${status === 'deleted' ? '删除' : '标记为已完成'}成功` };
    } catch (err) {
      console.error('数据库更新失败:', err);
      throw { error: `${status === 'deleted' ? '删除' : '标记为已完成'}失败` };
    }
  }

  async updateText(uid: string, text: string) {
    if (!text) {
      throw { error: '编辑失败：缺少文本内容' };
    }
    try {
      const result = await this.danmuModel.update({ text }, { where: { uid } });
      console.log('编辑成功:', result);
      return { success: '编辑成功' };
    } catch (err) {
      console.error('数据库更新失败:', err);
      throw { error: '编辑失败' };
    }
  }

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
      console.log('查询到的账号密码:', result.account, result.password);
      // 注意：这里返回的password是加密后的密码，但前端需要显示明文
      // 由于无法解密，所以这里只能返回加密后的密码
      // 前端显示时会显示加密后的密码，但用户输入明文密码后仍然可以通过验证
      const returnData = { action: 'get_acps', data: {account: result.account, password: result.password}, uid };
      console.log('发送给前端的账号密码数据:', returnData);
      return returnData;
    } catch (err) {
      console.error('查询账号密码失败:', err);
      return { action: 'get_acps', data: 1 };
    }
  }

  async updateAccountPassword(uid: string, account: string, password: string) {
    try {
      // 直接存储明文密码到数据库
      await this.danmuModel.update({ account, password }, { where: { uid } });
      return { action: 'update_acps', success: true };
    } catch (err) {
      console.error('更新账号密码失败:', err);
      return { action: 'update_acps', success: false };
    }
  }

  /**
   * 添加新弹幕或更新已有弹幕
   * @param nickname 弹幕昵称
   * @param text 弹幕内容
   * @returns 添加或更新结果
   */
  async addDanmu(nickname: string, text: string): Promise<any> {
    try {
      // 查找是否已存在该昵称的记录
      const existingDanmu = await this.danmuModel.findOne({
        where: { nickname }
      });
      
      if (existingDanmu) {
        // 如果已存在，更新text、状态和创建时间
        this.logger.log(`找到已存在的昵称: ${nickname}，更新记录`);
        await this.danmuModel.update(
          { 
            text, 
            status: 'waiting',
            createtime: new Date().toISOString() 
          }, 
          { where: { nickname } }
        );
        return { success: true, message: '弹幕更新成功' };
      } else {
        // 如果不存在，创建新记录
        // 查找最大uid
        const maxUidRecord = await this.danmuModel.findOne({
          order: [['uid', 'DESC']]
        });
        
        // 计算新uid (最大uid + 1)
        const maxUid = maxUidRecord ? parseInt(maxUidRecord.uid) : 0;
        const newUid = (maxUid + 1).toString();
        
        // 创建新记录
        await this.danmuModel.create({
          uid: newUid,
          nickname,
          text,
          account: '',
          password: '',
          status: 'waiting',
          createtime: new Date().toISOString()
        });
        
        this.logger.log(`创建新弹幕记录，uid: ${newUid}, nickname: ${nickname}`);
        return { success: true, message: '弹幕添加成功' };
      }
    } catch (err) {
      this.logger.error('添加或更新弹幕失败:', err);
      throw { message: '添加弹幕失败: ' + err.message };
    }
  }

  async getAllDanmu() {
    try {
      
      const results = await this.danmuModel.findAll({
        attributes: ['uid', 'nickname', 'text', 'createtime', 'status']
      });
      const data = {
        uid: results.map(item => item.uid),
        nickname: results.map(item => item.nickname),
        text: results.map(item => item.text),
        createtime: results.map(item => item.createtime),
        status: results.map(item => item.status)
      };
      //console.log('发送webhook消息:', results);
      return data;
    } catch (err) {
      console.error('从数据库获取弹幕数据失败:', err);
      throw err;
    }
  }

  /**
   * 创建新的弹幕记录，如果uid已存在则更新记录
   * @param danmuData 弹幕数据
   * @returns 创建或更新的弹幕记录
   */
  async createDanmu(danmuData: any): Promise<Danmu> {
    try {
      // 如果是更新操作，确保状态设置为waiting
      if (danmuData.uid) {
        const existingDanmu = await this.danmuModel.findOne({
          where: { uid: danmuData.uid }
        });
        
        if (existingDanmu) {
          // 如果记录已存在，强制设置状态为waiting
          danmuData.status = 'waiting';
          this.logger.log(`更新弹幕并重置状态: ${danmuData.uid}`);
        }
      }
      
      // 使用upsert操作，如果记录存在则更新，不存在则创建
      const [danmu, created] = await this.danmuModel.upsert(danmuData);
      
      if (created) {
        this.logger.log(`创建弹幕成功: ${danmu.uid}`);
      } else {
        this.logger.log(`更新弹幕成功: ${danmu.uid}`);
      }
      
      return danmu;
    } catch (err) {
      this.logger.error('创建或更新弹幕失败:', err);
      throw { error: '创建弹幕失败' };
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
        return admin.password;
      } else {
        // 如果没有找到管理员记录，返回默认密码哈希值
        this.logger.warn('未找到管理员记录，使用默认密码');
        return '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm';
      }
    } catch (err) {
      this.logger.error('获取管理员密码失败:', err);
      // 出错时返回默认密码哈希值
      return '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm';
    }
  }

  /**
   * 验证管理员密码
   * @param plainPassword 前端传入的明文密码
   * @returns 验证结果
   */
  async verifyPassword(plainPassword: string): Promise<{action: string; success: boolean; message?: string}> {
    try {
      const adminPassword = await this.getAdminPassword();
      // 前端已经使用bcrypt对密码进行了哈希处理
      // 我们需要直接比较前端传来的明文密码与数据库中存储的哈希值是否匹配
      this.logger.log(plainPassword,adminPassword );
      const isMatch = (plainPassword == adminPassword);
      return { 
        action: 'verify_password', 
        success: isMatch,
        message: isMatch ? '验证成功' : '密码错误' 
      };
    } catch (err) {
      this.logger.error('密码验证失败:', err);
      return { action: 'verify_password', success: false, message: '验证过程发生错误' };
    }
  }
}