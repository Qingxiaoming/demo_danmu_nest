import { Injectable, Logger } from '@nestjs/common';
import { QQMusicService } from './platforms/qq.service';
import { NeteaseMusicService } from './platforms/netease.service';
import { CombinedSearchResult, MusicPlatform, Song } from './music.types';
import E from '../../common/error';

@Injectable()
export class MusicService {
  private readonly logger = new Logger(MusicService.name);
  private readonly REQUEST_TIMEOUT = 15000; // 15秒总超时
  
  constructor(
    private readonly qqMusicService: QQMusicService,
    private readonly neteaseMusicService: NeteaseMusicService,
  ) {}

  /**
   * 搜索歌曲（从两个平台）
   * @param keyword 搜索关键词
   * @param limit 每个平台返回的结果数量
   * @returns 综合搜索结果
   */
  async searchSong(keyword: string, limit: number = 5): Promise<CombinedSearchResult> {
    this.logger.log(`搜索歌曲: ${keyword}`);
    
    // 创建一个Promise.race，确保整体搜索不会超时
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('搜索请求超时')), this.REQUEST_TIMEOUT);
    });
    
    try {
      // 并行搜索两个平台，使用Promise.allSettled确保一个平台失败不会影响其他平台
      const searchPromise = Promise.allSettled([
        this.qqMusicService.search(keyword, limit),
        this.neteaseMusicService.search(keyword, limit),
      ]);
      
      // 使用Promise.race确保整体搜索不会超时
      const results = await Promise.race([searchPromise, timeoutPromise]);
      
      if (!results) {
        throw new Error('搜索请求超时');
      }
      
      // 处理搜索结果
      const [qqResult, neteaseResult] = results as PromiseSettledResult<Song[]>[];
      
      const qqSongs = qqResult.status === 'fulfilled' ? qqResult.value : [];
      const neteaseSongs = neteaseResult.status === 'fulfilled' ? neteaseResult.value : [];
      
      // 记录失败的平台
      if (qqResult.status === 'rejected') {
        this.logger.error(`QQ音乐搜索失败: ${qqResult.reason}`);
      }
      if (neteaseResult.status === 'rejected') {
        this.logger.error(`网易云音乐搜索失败: ${neteaseResult.reason}`);
      }

      // 构建综合搜索结果
      const result: CombinedSearchResult = {
        keyword,
        results: [
          { platform: MusicPlatform.QQ, songs: qqSongs },
          { platform: MusicPlatform.NETEASE, songs: neteaseSongs },
        ],
      };

      // 设置默认播放歌曲（优先级：QQ > 网易云）
      for (const platformResult of result.results) {
        if (platformResult.songs.length > 0) {
          result.defaultSong = platformResult.songs[0];
          break;
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`搜索歌曲失败: ${error.message}`, error.stack);
      
      // 即使出错，也返回一个空的结果，而不是抛出异常
      return {
        keyword,
        results: [
          { platform: MusicPlatform.QQ, songs: [] },
          { platform: MusicPlatform.NETEASE, songs: [] },
        ],
      };
    }
  }

  /**
   * 获取歌曲播放URL
   * @param song 歌曲信息
   * @returns 带有URL的歌曲信息
   */
  async getSongUrl(song: Song): Promise<Song> {
    try {
      // 创建一个Promise.race，确保获取URL不会超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(E.RATE_LIMIT_EXCEEDED.create('获取歌曲URL请求超时')), this.REQUEST_TIMEOUT);
      });
      
      let urlPromise: Promise<string>;
      
      switch (song.platform) {
        case MusicPlatform.QQ:
          urlPromise = this.qqMusicService.getSongUrl(song.id);
          break;
        case MusicPlatform.NETEASE:
          urlPromise = this.neteaseMusicService.getSongUrl(song.id);
          break;
        default:
          throw E.INVALID_PARAMS.create('不支持的音乐平台');
      }
      
      // 使用Promise.race确保获取URL不会超时
      const url = await Promise.race([urlPromise, timeoutPromise]);
      
      return { ...song, url };
    } catch (error) {
      this.logger.error(`获取歌曲URL失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 获取歌词
   * @param song 歌曲信息
   * @returns 带有歌词的歌曲信息
   */
  async getLyric(song: Song): Promise<Song> {
    try {
      // 创建一个Promise.race，确保获取歌词不会超时
      const timeoutPromise = new Promise<string>((resolve) => {
        setTimeout(() => {
          this.logger.warn(`获取歌词请求超时`);
          resolve(''); // 歌词获取超时返回空字符串，不影响主流程
        }, this.REQUEST_TIMEOUT);
      });
      
      let lrcPromise: Promise<string>;
      
      switch (song.platform) {
        case MusicPlatform.QQ:
          lrcPromise = this.qqMusicService.getLyric(song.id);
          break;
        case MusicPlatform.NETEASE:
          lrcPromise = this.neteaseMusicService.getLyric(song.id);
          break;
        default:
          this.logger.warn(`不支持的音乐平台: ${song.platform}，无法获取歌词`);
          return { ...song, lrc: '' };
      }
      
      // 使用Promise.race确保获取歌词不会超时
      const lrc = await Promise.race([lrcPromise, timeoutPromise]);
      
      return { ...song, lrc };
    } catch (error) {
      this.logger.error(`获取歌词失败: ${error.message}`, error.stack);
      // 获取歌词失败不应该影响整个流程
      return { ...song, lrc: '' };
    }
  }

  /**
   * 获取完整的歌曲信息（包括URL和歌词）
   * @param song 歌曲基本信息
   * @returns 完整的歌曲信息
   */
  async getFullSongInfo(song: Song): Promise<Song> {
    try {
      // 先获取URL，再获取歌词
      const songWithUrl = await this.getSongUrl(song);
      return this.getLyric(songWithUrl);
    } catch (error) {
      // 如果获取URL失败，仍然尝试获取歌词
      this.logger.error(`获取歌曲URL失败，尝试继续获取歌词: ${error.message}`);
      return this.getLyric(song);
    }
  }
} 