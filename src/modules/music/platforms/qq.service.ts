import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { MusicPlatform, Song } from '../music.types';
import E from '../../../common/error';

@Injectable()
export class QQMusicService {
  private readonly logger = new Logger(QQMusicService.name);
  private readonly baseUrl = 'https://c.y.qq.com';
  private readonly searchUrl = `${this.baseUrl}/soso/fcgi-bin/client_search_cp`;
  private readonly REQUEST_TIMEOUT = 10000; // 10秒超时

  /**
   * 搜索QQ音乐
   * @param keyword 搜索关键词
   * @param limit 返回结果数量限制
   * @returns 歌曲列表
   */
  async search(keyword: string, limit: number = 10): Promise<Song[]> {
    try {
      const response = await axios.get(this.searchUrl, {
        params: {
          w: keyword,
          format: 'json',
          p: 1,
          n: limit,
          cr: 1,
          t: 0,
        },
        headers: {
          Referer: 'https://y.qq.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: this.REQUEST_TIMEOUT,
      });

      if (!response.data || !response.data.data || !response.data.data.song || !response.data.data.song.list) {
        this.logger.warn(`QQ音乐搜索返回数据格式异常: ${JSON.stringify(response.data)}`);
        return [];
      }

      const songs = response.data.data.song.list.map(item => this.formatSong(item));
      return songs;
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        this.logger.error(`QQ音乐搜索请求超时: ${error.message}`);
        return [];
      }
      this.logger.error(`QQ音乐搜索失败: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * 获取歌曲播放URL
   * @param songmid 歌曲mid
   * @returns 歌曲URL或错误对象
   */
  async getSongUrl(songmid: string): Promise<string | { error: number; message: string }> {
    try {
      // 这里使用一个简化的方法获取歌曲URL
      // 实际项目中可能需要更复杂的逻辑来获取真实的播放地址
      const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=%7B%22req_0%22%3A%7B%22module%22%3A%22vkey.GetVkeyServer%22%2C%22method%22%3A%22CgiGetVkey%22%2C%22param%22%3A%7B%22guid%22%3A%22358840384%22%2C%22songmid%22%3A%5B%22${songmid}%22%5D%2C%22songtype%22%3A%5B0%5D%2C%22uin%22%3A%221443481947%22%2C%22loginflag%22%3A1%2C%22platform%22%3A%2220%22%7D%7D%2C%22comm%22%3A%7B%22uin%22%3A%2218585073516%22%2C%22format%22%3A%22json%22%2C%22ct%22%3A24%2C%22cv%22%3A0%7D%7D`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
      
      try {
        const response = await axios.get(url, {
          headers: {
            Referer: 'https://y.qq.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
          timeout: this.REQUEST_TIMEOUT,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (response.data && response.data.req_0 && response.data.req_0.data && response.data.req_0.data.midurlinfo && response.data.req_0.data.midurlinfo.length > 0) {
          const purl = response.data.req_0.data.midurlinfo[0].purl;
          if (purl) {
            return `${response.data.req_0.data.sip[0]}${purl}`;
          }
        }
        
        this.logger.warn(`无法从QQ音乐获取播放地址`);
        // 不抛出异常，而是返回错误对象
        return { 
          error: E.RESOURCE_NOT_FOUND.error, 
          message: '无法获取QQ音乐播放地址' 
        };
      } catch (error) {
        clearTimeout(timeoutId);
        // 不再抛出异常，而是继续处理
        if (axios.isAxiosError(error)) {
          if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
            this.logger.error(`获取QQ音乐播放地址请求超时`);
            return { 
              error: E.RATE_LIMIT_EXCEEDED.error, 
              message: '获取QQ音乐播放地址请求超时，请稍后再试' 
            };
          }
        }
        this.logger.error(`获取QQ音乐播放地址失败: ${error.message}`, error.stack);
        return { 
          error: E.API_ERROR.error, 
          message: '获取QQ音乐播放地址失败' 
        };
      }
    } catch (error) {
      this.logger.error(`获取QQ音乐播放地址过程中发生错误: ${error.message}`, error.stack);
      return { 
        error: E.SYSTEM_ERROR.error, 
        message: '获取QQ音乐播放地址过程中发生错误' 
      };
    }
  }

  /**
   * 获取歌词
   * @param songmid 歌曲mid
   * @returns 歌词文本
   */
  async getLyric(songmid: string): Promise<string> {
    try {
      const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songmid}&format=json&nobase64=1`;
      
      // 创建一个可取消的超时控制器
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
      
      try {
        const response = await axios.get(url, {
          headers: {
            Referer: 'https://y.qq.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
          timeout: this.REQUEST_TIMEOUT,
          signal: controller.signal,
        });
        
        // 请求成功，清除超时计时器
        clearTimeout(timeoutId);

        if (response.data && response.data.lyric) {
          return response.data.lyric;
        }
        
        this.logger.warn(`无法从QQ音乐获取歌词: ${JSON.stringify(response.data)}`);
        return '';
      } catch (error) {
        // 请求失败，清除超时计时器
        clearTimeout(timeoutId);
        
        if (axios.isAxiosError(error)) {
          if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
            this.logger.error(`获取QQ音乐歌词请求超时: ${error.message}`);
            return ''; // 歌词获取失败不影响主流程
          }
        }
        this.logger.error(`获取QQ音乐歌词失败: ${error.message}`, error.stack);
        return '';
      }
    } catch (error) {
      this.logger.error(`获取QQ音乐歌词过程中发生错误: ${error.message}`, error.stack);
      return '';
    }
  }

  /**
   * 格式化歌曲信息
   * @param item QQ音乐API返回的歌曲信息
   * @returns 标准化的歌曲信息
   */
  private formatSong(item: any): Song {
    return {
      id: item.songmid,
      name: item.songname,
      artist: item.singer.map(s => s.name).join('/'),
      album: item.albumname,
      duration: item.interval,
      cover: `https://y.gtimg.cn/music/photo_new/T002R300x300M000${item.albummid}.jpg`,
      platform: MusicPlatform.QQ,
    };
  }
} 