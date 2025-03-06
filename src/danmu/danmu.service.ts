import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as mysql from 'mysql';
import axios from 'axios';

@Injectable()
export class DanmuService implements OnModuleInit {
  constructor(
     @Inject('DATABASE_CONNECTION') private connection: mysql.Connection,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    this.schedulerRegistry.addInterval('getDanmuData', setInterval(() => {
      //this.getDanmuData('23415751');
    }, 5000));
  }

  async getDanmuData(roomId: string): Promise<void> {
    try {
      const response = await axios.get(
        `https://api.live.bilibili.com/xlive/web-room/v1/dM/gethistory?roomid=${roomId}&room_type=0`,
      );
      const data = response.data.data.room;
      if (data && data.length > 0) {
        data.forEach((item) => {
          const danmuId = item.id_str;
          const nickname = item.nickname;
          const uid = item.uid;
          const text = item.text;
          const createtime = item.timeline;

          if (text.includes('晚安')) {
            this.saveDanmu(uid, nickname, text, createtime);
          }
        });
      }
    } catch (error) {
      console.error('请求弹幕数据失败:', error);
    }
  }

  async saveDanmu(uid: string, nickname: string, text: string, createtime: string): Promise<void> {
    const sql = `
      INSERT INTO now_queue (uid, nickname, text, createtime, status)
      VALUES (?, ?, ?, ?, 'waiting')
      ON DUPLICATE KEY UPDATE
      nickname = VALUES(nickname),
      text = VALUES(text),
      createtime = VALUES(createtime),
      status = VALUES(status);
    `;
    this.connection.query(sql, [uid, nickname, text, createtime], (err, result) => {
      if (err) {
        console.error('保存弹幕到数据库失败:', err);
      } else {
        console.log('弹幕保存成功:', result.insertId);
      }
    });
  }

  // 添加版本 2 的方法
  async getAllDanmu(roomId: string): Promise<any[]> {
    const sql = `
      SELECT uid, nickname, text, createtime, status
      FROM now_queue
      WHERE status != 'deleted' AND status != 'completed';
    `;
    return new Promise((resolve, reject) => {
      this.connection.query(sql, (err, results) => {
        if (err) reject(err);
        resolve(results);
      });
    });
  }

  async updateDanmuStatus(uid: string, status: string): Promise<any> {
    const sql = `UPDATE now_queue SET status = ? WHERE uid = ?`;
    return new Promise((resolve, reject) => {
      this.connection.query(sql, [status, uid], (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    });
  }

  async updateDanmuText(uid: string, text: string): Promise<any> {
    const sql = `UPDATE now_queue SET text = ? WHERE uid = ?`;
    return new Promise((resolve, reject) => {
      this.connection.query(sql, [text, uid], (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    });
  }

  async getAccountPassword(uid: string): Promise<any> {
    const sql = `SELECT account, password FROM now_queue WHERE uid = ?`;
    return new Promise((resolve, reject) => {
      this.connection.query(sql, [uid], (err, results) => {
        if (err) reject(err);
        resolve(results);
      });
    });
  }

  async updateAccountPassword(uid: string, account: string, password: string): Promise<any> {
    const sql = `UPDATE now_queue SET account = ?, password = ? WHERE uid = ?`;
    return new Promise((resolve, reject) => {
      this.connection.query(sql, [account, password, uid], (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    });
  }
}