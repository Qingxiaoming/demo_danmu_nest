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
   * 搜索歌曲
   * @param keyword 搜索关键词
   * @param limit 每个平台返回的最大结果数
   * @returns 综合搜索结果
   */
  async searchSong(keyword: string, limit: number = 10): Promise<CombinedSearchResult> {
    try {
      this.logger.log(`搜索歌曲: ${keyword}, 限制: ${limit}首/平台`);
      
      // 创建一个可取消的超时Promise
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<{ error: number; message: string }>((resolve) => {
        timeoutId = setTimeout(() => {
          this.logger.warn(`搜索歌曲请求超时: ${keyword}`);
          resolve({ 
            error: E.RATE_LIMIT_EXCEEDED.error, 
            message: '搜索歌曲请求超时' 
          });
        }, this.REQUEST_TIMEOUT);
      });
      
      // 并行搜索两个平台
      const qqPromise = this.qqMusicService.search(keyword, limit).catch(err => {
        this.logger.error(`QQ音乐搜索出错: ${err.message}`, err.stack);
        return [];
      });
      
      const neteasePromise = this.neteaseMusicService.search(keyword, limit).catch(err => {
        this.logger.error(`网易云音乐搜索出错: ${err.message}`, err.stack);
        return [];
      });
      
      // 使用Promise.allSettled等待所有搜索完成，无论成功失败
      const [qqResult, neteaseResult] = await Promise.allSettled([qqPromise, neteasePromise]);
      
      // 清除超时计时器
      clearTimeout(timeoutId);
      
      // 处理搜索结果
      let qqSongs: Song[] = [];
      if (qqResult.status === 'fulfilled') {
        qqSongs = qqResult.value.map(song => ({
          ...song,
          platform: MusicPlatform.QQ,
          // 添加VIP标识处理
          vip: song.vip === true || song.fee === 1 || song.pay_play === 1
        }));
      }
      
      let neteaseSongs: Song[] = [];
      if (neteaseResult.status === 'fulfilled') {
        neteaseSongs = neteaseResult.value.map(song => ({
          ...song,
          platform: MusicPlatform.NETEASE,
          // 添加VIP标识处理
          vip: song.vip === true || song.fee === 1
        }));
      }
      
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

      // 记录搜索成功的日志
      const totalSongs = qqSongs.length + neteaseSongs.length;
      this.logger.log(`搜索歌曲成功: ${keyword}, 共找到 ${totalSongs} 首歌曲`);
      
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
      let urlPromise: Promise<string | { error: number; message: string }>;
      
      switch (song.platform) {
        case MusicPlatform.QQ:
          urlPromise = this.qqMusicService.getSongUrl(song.id);
          break;
        case MusicPlatform.NETEASE:
          urlPromise = this.neteaseMusicService.getSongUrl(song.id);
          break;
        default:
          this.logger.warn(`不支持的音乐平台: ${song.platform}，无法获取URL`);
          return { 
            ...song, 
            url: '',
            error: {
              code: E.INVALID_PARAMS.error,
              message: `不支持的音乐平台: ${song.platform}`
            }
          };
      }
      
      // 创建一个可取消的超时Promise
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<{ error: number; message: string }>((resolve) => {
        timeoutId = setTimeout(() => {
          this.logger.warn(`获取歌曲URL请求超时: ${song.name}`);
          resolve({ 
            error: E.RATE_LIMIT_EXCEEDED.error, 
            message: '获取歌曲URL请求超时' 
          });
        }, this.REQUEST_TIMEOUT);
      });
      
      // 使用Promise.race，并确保在获取结果后清除超时计时器
      const result = await Promise.race([urlPromise, timeoutPromise]);
      clearTimeout(timeoutId); // 无论成功还是超时，都清除计时器
      
      // 检查结果是否为错误对象
      if (typeof result === 'object' && 'error' in result) {
        this.logger.warn(`获取歌曲URL失败: ${result.message}`, { 
          songName: song.name, 
          artist: song.artist, 
          platform: song.platform,
          errorCode: result.error
        });
        
        return { 
          ...song, 
          url: '', 
          error: {
            code: result.error,
            message: result.message
          }
        };
      }
      
      this.logger.log(`获取歌曲URL成功: ${song.name} - ${song.artist}`);
      return { ...song, url: result };
    } catch (error) {
      this.logger.error(`获取歌曲URL失败: ${error.message}`, error.stack);
      
      // 返回没有URL的歌曲信息，同时添加错误信息
      const errorCode = error.error || E.API_ERROR.error;
      const errorMessage = error.message || '获取歌曲URL失败';
      
      return { 
        ...song, 
        url: '', 
        error: {
          code: errorCode,
          message: errorMessage
        }
      };
    }
  }

  /**
   * 获取歌词
   * @param song 歌曲信息
   * @returns 带有歌词的歌曲信息
   */
  async getLyric(song: Song): Promise<Song> {
    try {
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
          return { 
            ...song, 
            lrc: '',
            error: {
              code: E.INVALID_PARAMS.error,
              message: `不支持的音乐平台: ${song.platform}`
            }
          };
      }
      
      // 创建一个可取消的超时Promise
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<string>((resolve) => {
        timeoutId = setTimeout(() => {
          this.logger.warn(`获取歌词请求超时: ${song.name}`);
          resolve(''); // 歌词获取超时返回空字符串，不影响主流程
        }, this.REQUEST_TIMEOUT);
      });
      
      // 使用Promise.race，并确保在获取结果后清除超时计时器
      const lrc = await Promise.race([lrcPromise, timeoutPromise]);
      clearTimeout(timeoutId); // 无论成功还是超时，都清除计时器
      
      if (lrc) {
        this.logger.log(`获取歌词成功: ${song.name} - ${song.artist}`);
      } else {
        this.logger.warn(`歌词内容为空: ${song.name} - ${song.artist}`);
      }
      
      return { ...song, lrc };
    } catch (error) {
      this.logger.error(`获取歌词失败: ${error.message}`, error.stack);
      
      // 获取歌词失败不应该影响整个流程，但添加错误信息
      const errorCode = error.error || E.API_ERROR.error;
      const errorMessage = error.message || '获取歌词失败';
      
      return { 
        ...song, 
        lrc: '',
        error: {
          code: errorCode,
          message: errorMessage
        }
      };
    }
  }

  /**
   * 获取完整的歌曲信息（包括URL和歌词）
   * @param song 歌曲基本信息
   * @returns 完整的歌曲信息
   */
  async getFullSongInfo(song: Song): Promise<Song> {
    this.logger.log(`开始获取完整歌曲信息: ${song.name} - ${song.artist} (${song.platform})`);
    
    try {
      // 先获取URL，再获取歌词
      const songWithUrl = await this.getSongUrl(song);
      const fullSong = await this.getLyric(songWithUrl);
      
      // 如果获取URL时出现错误，保留错误信息
      if (songWithUrl.error) {
        fullSong.error = songWithUrl.error;
        this.logger.warn(`获取URL失败，但继续获取歌词: ${song.name}, 错误: ${songWithUrl.error.message}`);
      }
      
      this.logger.log(`获取完整歌曲信息成功: ${song.name} - ${song.artist}`);
      return fullSong;
    } catch (error) {
      this.logger.error(`获取完整歌曲信息过程中出错: ${error.message}`, error.stack);
      
      // 如果获取URL失败，仍然尝试获取歌词
      this.logger.warn(`尝试继续获取歌词: ${song.name}`);
      const songWithLrc = await this.getLyric(song);
      
      // 添加错误信息
      const errorCode = error.error || E.API_ERROR.error;
      const errorMessage = error.message || '获取完整歌曲信息失败';
      
      songWithLrc.error = {
        code: errorCode,
        message: errorMessage
      };
      
      return songWithLrc;
    }
  }
}