/**
 * 音乐播放器模块
 * 处理音乐播放、歌词显示和进度更新
 */

// 全局变量
let currentLyrics = [];
let lyricTimer = null;

// 播放歌曲
function playSong(song) {
    const musicPlayer = document.getElementById('music-player');
    const musicTitle = document.getElementById('music-title');
    const musicArtist = document.getElementById('music-artist');
    const musicCover = document.getElementById('music-cover');
    const musicAudio = document.getElementById('music-audio');
    const musicLyrics = document.getElementById('music-lyrics');
    
    // 设置歌曲信息
    musicTitle.textContent = song.name;
    musicArtist.textContent = song.artist;
    musicCover.src = song.cover || 'default-cover.jpg';
    
    // 检查是否有错误信息
    if (song.error) {
        console.error('歌曲信息获取失败:', song.error.message, '错误码:', song.error.code);
        // 显示错误提示
        musicLyrics.innerHTML = `<p class="current-lyric" style="color: #d9534f;">无法播放：${song.error.message}</p>`;
        musicPlayer.classList.add('show');
        
        // 3秒后隐藏播放器
        setTimeout(() => {
            musicPlayer.classList.remove('show');
        }, 3000);
        return;
    }
    
    // 检查URL是否存在
    if (!song.url) {
        console.error('歌曲URL不存在，无法播放:', song.name);
        // 显示错误提示
        musicLyrics.innerHTML = '<p class="current-lyric" style="color: #d9534f;">无法播放：获取歌曲URL失败</p>';
        musicPlayer.classList.add('show');
        
        // 3秒后隐藏播放器
        setTimeout(() => {
            musicPlayer.classList.remove('show');
        }, 3000);
        return;
    }
    
    // 设置音频源
    musicAudio.src = song.url;
    
    // 解析歌词
    parseLyrics(song.lrc || '');
    
    // 显示播放器
    musicPlayer.classList.add('show');
    
    // 播放音乐
    musicAudio.play().catch(error => {
        console.error('播放音乐失败:', error);
        // 显示错误提示
        musicLyrics.innerHTML = '<p class="current-lyric" style="color: #d9534f;">播放失败：' + error.message + '</p>';
        
        // 3秒后隐藏播放器
        setTimeout(() => {
            musicPlayer.classList.remove('show');
        }, 3000);
    });
    
    // 更新进度条
    musicAudio.addEventListener('timeupdate', updateProgress);
    
    // 歌曲播放结束时隐藏播放器
    musicAudio.addEventListener('ended', () => {
        musicPlayer.classList.remove('show');
        clearInterval(lyricTimer);
    });
    
    // 开始歌词滚动
    startLyricScroll();
}

// 更新进度条
function updateProgress() {
    const musicAudio = document.getElementById('music-audio');
    const musicProgressBar = document.getElementById('music-progress-bar');
    
    if (musicAudio.duration) {
        const progress = (musicAudio.currentTime / musicAudio.duration) * 100;
        musicProgressBar.style.width = `${progress}%`;
    }
}

// 解析LRC格式歌词
function parseLyrics(lrcText) {
    const musicLyrics = document.getElementById('music-lyrics');
    currentLyrics = [];
    musicLyrics.innerHTML = '';
    
    if (!lrcText) {
        musicLyrics.innerHTML = '<p class="current-lyric">暂无歌词</p>';
        return;
    }
    
    try {
        const lines = lrcText.split('\n');
        const pattern = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
        
        lines.forEach(line => {
            const match = line.match(pattern);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const milliseconds = parseInt(match[3]);
                const text = match[4].trim();
                
                if (text) {
                    const time = minutes * 60 + seconds + milliseconds / 1000;
                    currentLyrics.push({ time, text });
                }
            }
        });
        
        // 按时间排序
        currentLyrics.sort((a, b) => a.time - b.time);
        
        // 初始显示第一句歌词
        if (currentLyrics.length > 0) {
            musicLyrics.innerHTML = `<p class="current-lyric">${currentLyrics[0].text}</p>`;
        } else {
            musicLyrics.innerHTML = '<p class="current-lyric">暂无歌词</p>';
        }
    } catch (error) {
        console.error('解析歌词失败:', error);
        musicLyrics.innerHTML = '<p class="current-lyric">歌词解析失败</p>';
    }
}

// 开始歌词滚动
function startLyricScroll() {
    const musicAudio = document.getElementById('music-audio');
    const musicLyrics = document.getElementById('music-lyrics');
    
    clearInterval(lyricTimer);
    
    if (currentLyrics.length === 0) return;
    
    lyricTimer = setInterval(() => {
        try {
            const currentTime = musicAudio.currentTime;
            let currentLyric = '';
            
            // 查找当前时间对应的歌词
            for (let i = 0; i < currentLyrics.length; i++) {
                if (i === currentLyrics.length - 1 || 
                    (currentTime >= currentLyrics[i].time && currentTime < currentLyrics[i + 1].time)) {
                    currentLyric = currentLyrics[i].text;
                    break;
                }
            }
            
            if (currentLyric) {
                musicLyrics.innerHTML = `<p class="current-lyric">${currentLyric}</p>`;
            }
        } catch (error) {
            console.error('歌词滚动出错:', error);
            clearInterval(lyricTimer);
        }
    }, 100);
}

// 初始化播放器
function initPlayer() {
    // 播放器初始化代码，如果有的话
}

// 导出播放器模块
window.player = {
    playSong,
    updateProgress,
    parseLyrics,
    startLyricScroll,
    initPlayer
}; 