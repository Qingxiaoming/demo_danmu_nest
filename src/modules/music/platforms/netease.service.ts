import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { MusicPlatform, Song } from '../music.types';
import E from '../../../common/error';

@Injectable()
export class NeteaseMusicService {
  private readonly logger = new Logger(NeteaseMusicService.name);
  private readonly baseUrl = 'https://music.163.com/api';
  private readonly searchUrl = `${this.baseUrl}/search/get`;
  private readonly REQUEST_TIMEOUT = 10000; // 10秒超时

  /**
   * 搜索网易云音乐
   * @param keyword 搜索关键词
   * @param limit 返回结果数量限制
   * @returns 歌曲列表
   */
  async search(keyword: string, limit: number = 10): Promise<Song[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
      
      try {
        const response = await axios.post(this.searchUrl, {
          s: keyword,
          type: 1,
          limit: limit,
          offset: 0,
        }, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://music.163.com/',
          },
          timeout: this.REQUEST_TIMEOUT,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.data || !response.data.result || !response.data.result.songs) {
          this.logger.warn(`网易云音乐搜索返回数据格式异常: ${JSON.stringify(response.data)}`);
          return [];
        }

        const songs = response.data.result.songs.map(item => this.formatSong(item));
        return songs;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
          this.logger.error(`网易云音乐搜索请求超时: ${error.message}`);
          return [];
        }
      }
      this.logger.error(`网易云音乐搜索失败: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * 获取歌曲播放URL
   * @param songId 歌曲ID
   * @returns 歌曲URL
   */
  async getSongUrl(songId: string): Promise<string> {
    try {
      const url = `${this.baseUrl}/song/enhance/player/url?id=${songId}&ids=[${songId}]&br=320000`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
      
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://music.163.com/',
          },
          timeout: this.REQUEST_TIMEOUT,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (response.data && response.data.data && response.data.data.length > 0) {
          const songUrl = response.data.data[0].url;
          if (songUrl) {
            return songUrl;
          }
        }
        
        this.logger.warn(`无法从网易云音乐获取播放地址: ${JSON.stringify(response.data)}`);
        throw E.RESOURCE_NOT_FOUND.create('无法获取网易云音乐播放地址');
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
          this.logger.error(`获取网易云音乐播放地址请求超时`);
          throw E.RATE_LIMIT_EXCEEDED.create('获取网易云音乐播放地址请求超时，请稍后再试');
        }
      }
      this.logger.error(`获取网易云音乐播放地址失败: ${error.message}`, error.stack);
      throw E.API_ERROR.create('获取网易云音乐播放地址失败');
    }
  }

  /**
   * 获取歌词
   * @param songId 歌曲ID
   * @returns 歌词文本
   */
  async getLyric(songId: string): Promise<string> {
    try {
      const url = `${this.baseUrl}/song/lyric?id=${songId}&lv=1&kv=1&tv=-1`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://music.163.com/',
        },
        timeout: this.REQUEST_TIMEOUT,
      });

      if (response.data && response.data.lrc && response.data.lrc.lyric) {
        return response.data.lrc.lyric;
      }
      
      this.logger.warn(`无法从网易云音乐获取歌词: ${JSON.stringify(response.data)}`);
      return '';
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        this.logger.error(`获取网易云音乐歌词请求超时: ${error.message}`);
        return ''; // 歌词获取失败不影响主流程
      }
      this.logger.error(`获取网易云音乐歌词失败: ${error.message}`, error.stack);
      return '';
    }
  }

  /**
   * 格式化歌曲信息
   * @param item 网易云音乐API返回的歌曲信息
   * @returns 标准化的歌曲信息
   */
  private formatSong(item: any): Song {
    return {
      id: item.id.toString(),
      name: item.name,
      artist: item.artists.map(a => a.name).join('/'),
      album: item.album.name,
      duration: Math.floor(item.duration / 1000),
      cover: item.album.picUrl || `https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg`,
      platform: MusicPlatform.NETEASE,
    };
  }
} 