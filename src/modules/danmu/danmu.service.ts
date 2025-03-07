import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Danmu } from '../../model/danmu.model';

@Injectable()
export class DanmuService {
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

  async getAccountPassword(uid: string) {
    try {
      const result = await this.danmuModel.findOne({
        where: { uid },
        attributes: ['account', 'password']
      });
      console.log('查询到的账号密码:', result.account, result.password);
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
      await this.danmuModel.update({ account, password }, { where: { uid } });
      return { action: 'update_acps', success: true };
    } catch (err) {
      console.error('更新账号密码失败:', err);
      return { action: 'update_acps', success: false };
    }
  }

  async verifyPassword(password: string) {
    try {
      const result = await this.danmuModel.findOne({
        where: { uid: '0' },
        attributes: ['password']
      });
      
      if (!result) {
        return { success: false, message: '验证失败：未找到管理员记录' };
      }
      
      return { success: result.password === password, message: result.password === password ? '验证成功' : '密码错误' };
    } catch (err) {
      console.error('密码验证失败:', err);
      return { success: false, message: '验证失败：系统错误' };
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
}