import { Controller, Get, Query, Post, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { MusicService } from './music.service';
import { CombinedSearchResult, MusicPlatform, Song } from './music.types';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';

@ApiTags('音乐')
@Controller('music')
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  /**
   * 搜索歌曲
   * @param name 歌曲名称
   * @param limit 每个平台返回的结果数量
   * @returns 搜索结果
   */
  @ApiOperation({ summary: '搜索歌曲', description: '从QQ音乐和网易云音乐两个平台搜索歌曲' })
  @ApiQuery({ name: 'name', description: '歌曲名称', required: true })
  @ApiQuery({ name: 'limit', description: '每个平台返回的结果数量', required: false, type: Number })
  @ApiResponse({ status: 200, description: '搜索成功', type: CombinedSearchResult })
  @ApiResponse({ status: 408, description: '请求超时' })
  @ApiResponse({ status: 500, description: '服务器内部错误' })
  @Get('search')
  async search(
    @Query('name') songName: string,
    @Query('limit') limit: number = 5
  ): Promise<CombinedSearchResult> {
    if (!songName || songName.trim() === '') {
      throw new HttpException('歌曲名称不能为空', HttpStatus.BAD_REQUEST);
    }
    
    try {
      return await this.musicService.searchSong(songName, limit);
    } catch (error) {
      if (error.message && error.message.includes('超时')) {
        throw new HttpException('搜索请求超时，请稍后再试', HttpStatus.REQUEST_TIMEOUT);
      }
      throw new HttpException('搜索歌曲失败: ' + error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取歌曲URL
   * @param platform 音乐平台
   * @param id 歌曲ID
   * @returns 带有URL的歌曲信息
   */
  @ApiOperation({ summary: '获取歌曲URL', description: '根据平台和歌曲ID获取播放地址' })
  @ApiParam({ name: 'platform', description: '音乐平台(qq/netease)', enum: MusicPlatform })
  @ApiParam({ name: 'id', description: '歌曲ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: Song })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiResponse({ status: 404, description: '资源不存在' })
  @ApiResponse({ status: 408, description: '请求超时' })
  @ApiResponse({ status: 500, description: '服务器内部错误' })
  @Get('url/:platform/:id')
  async getSongUrl(
    @Param('platform') platform: MusicPlatform,
    @Param('id') id: string,
  ): Promise<Song> {
    if (!id || id.trim() === '') {
      throw new HttpException('歌曲ID不能为空', HttpStatus.BAD_REQUEST);
    }
    
    try {
      const song: Song = {
        id,
        platform,
        name: '',
        artist: '',
        album: '',
        duration: 0,
        cover: '',
      };
      
      return await this.musicService.getSongUrl(song);
    } catch (error) {
      if (error.error === 1006) {
        throw new HttpException('歌曲资源不存在', HttpStatus.NOT_FOUND);
      } else if (error.error === 1008 || (error.message && error.message.includes('超时'))) {
        throw new HttpException('获取歌曲URL请求超时，请稍后再试', HttpStatus.REQUEST_TIMEOUT);
      }
      throw new HttpException('获取歌曲URL失败: ' + error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取歌词
   * @param platform 音乐平台
   * @param id 歌曲ID
   * @returns 带有歌词的歌曲信息
   */
  @ApiOperation({ summary: '获取歌词', description: '根据平台和歌曲ID获取歌词' })
  @ApiParam({ name: 'platform', description: '音乐平台(qq/netease)', enum: MusicPlatform })
  @ApiParam({ name: 'id', description: '歌曲ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: Song })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiResponse({ status: 408, description: '请求超时' })
  @ApiResponse({ status: 500, description: '服务器内部错误' })
  @Get('lyric/:platform/:id')
  async getLyric(
    @Param('platform') platform: MusicPlatform,
    @Param('id') id: string,
  ): Promise<Song> {
    if (!id || id.trim() === '') {
      throw new HttpException('歌曲ID不能为空', HttpStatus.BAD_REQUEST);
    }
    
    try {
      const song: Song = {
        id,
        platform,
        name: '',
        artist: '',
        album: '',
        duration: 0,
        cover: '',
      };
      
      return await this.musicService.getLyric(song);
    } catch (error) {
      if (error.message && error.message.includes('超时')) {
        throw new HttpException('获取歌词请求超时，请稍后再试', HttpStatus.REQUEST_TIMEOUT);
      }
      throw new HttpException('获取歌词失败: ' + error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取完整的歌曲信息
   * @param song 歌曲基本信息
   * @returns 完整的歌曲信息
   */
  @ApiOperation({ summary: '获取完整歌曲信息', description: '获取包含URL和歌词的完整歌曲信息' })
  @ApiBody({ description: '歌曲基本信息', type: Song })
  @ApiResponse({ status: 200, description: '获取成功', type: Song })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiResponse({ status: 404, description: '资源不存在' })
  @ApiResponse({ status: 408, description: '请求超时' })
  @ApiResponse({ status: 500, description: '服务器内部错误' })
  @Post('song/info')
  async getFullSongInfo(@Body() song: Song): Promise<Song> {
    if (!song.id || !song.platform) {
      throw new HttpException('歌曲ID和平台不能为空', HttpStatus.BAD_REQUEST);
    }
    
    try {
      return await this.musicService.getFullSongInfo(song);
    } catch (error) {
      if (error.error === 1006) {
        throw new HttpException('歌曲资源不存在', HttpStatus.NOT_FOUND);
      } else if (error.error === 1008 || (error.message && error.message.includes('超时'))) {
        throw new HttpException('获取歌曲信息请求超时，请稍后再试', HttpStatus.REQUEST_TIMEOUT);
      }
      throw new HttpException('获取歌曲信息失败: ' + error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
} 