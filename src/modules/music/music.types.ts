import { ApiProperty } from '@nestjs/swagger';

// 音乐平台枚举
export enum MusicPlatform {
  QQ = 'qq',
  NETEASE = 'netease',
}

// 歌曲信息接口
export class Song {
  @ApiProperty({ description: '歌曲ID' })
  id: string;

  @ApiProperty({ description: '歌曲名称' })
  name: string;

  @ApiProperty({ description: '歌手名称' })
  artist: string;

  @ApiProperty({ description: '专辑名称' })
  album: string;

  @ApiProperty({ description: '歌曲时长（秒）' })
  duration: number;

  @ApiProperty({ description: '封面图片URL' })
  cover: string;

  @ApiProperty({ description: '歌曲播放地址', required: false })
  url?: string;

  @ApiProperty({ description: '歌词', required: false })
  lrc?: string;

  @ApiProperty({ description: '来源平台', enum: MusicPlatform })
  platform: MusicPlatform;

  @ApiProperty({ description: '平台特定的额外数据', required: false })
  data?: any;
  
  @ApiProperty({ description: '错误信息', required: false })
  error?: {
    code: number;
    message: string;
  };
}

// 搜索结果接口
export class SearchResult {
  @ApiProperty({ description: '音乐平台', enum: MusicPlatform })
  platform: MusicPlatform;

  @ApiProperty({ description: '歌曲列表', type: [Song] })
  songs: Song[];
}

// 综合搜索结果
export class CombinedSearchResult {
  @ApiProperty({ description: '搜索关键词' })
  keyword: string;

  @ApiProperty({ description: '各平台搜索结果', type: [SearchResult] })
  results: SearchResult[];

  @ApiProperty({ description: '默认播放的歌曲', type: Song, required: false })
  defaultSong?: Song;
}

// 播放列表接口
export class Playlist {
  @ApiProperty({ description: '播放列表ID' })
  id: string;

  @ApiProperty({ description: '播放列表名称' })
  name: string;

  @ApiProperty({ description: '歌曲列表', type: [Song] })
  songs: Song[];
}

// 播放状态
export class PlayState {
  @ApiProperty({ description: '当前播放的歌曲', type: Song, required: false })
  currentSong?: Song;

  @ApiProperty({ description: '是否正在播放' })
  isPlaying: boolean;

  @ApiProperty({ description: '音量' })
  volume: number;

  @ApiProperty({ description: '当前播放时间（秒）' })
  currentTime: number;

  @ApiProperty({ description: '歌曲总时长（秒）' })
  duration: number;
} 