/**
 * 音乐播放器模块
 * 处理音乐播放、歌词显示和进度更新
 */

// 全局变量
let currentLyrics = [];
let lyricTimer = null;

// 显示歌曲信息但不播放
function showSongInfo(song) {
    if (!song) {
        console.error('无效的歌曲对象');
        return;
    }
    
    console.log('显示歌曲信息:', song);
    
    const musicPlayer = document.getElementById('music-player');
    const musicTitle = document.getElementById('music-title');
    const musicArtist = document.getElementById('music-artist');
    const musicCover = document.getElementById('music-cover');
    const musicLyrics = document.getElementById('music-lyrics');
    
    // 设置歌曲信息
    musicTitle.textContent = song.name || '未知歌曲';
    musicArtist.textContent = song.artist || '未知歌手';
    
    // 设置封面图片
    try {
        if (song.cover && song.cover.trim() !== '') {
            musicCover.src = song.cover;
            console.log('使用歌曲提供的封面:', song.cover);
        } else {
            // 使用相对路径的默认封面
            musicCover.src = './images/default-cover.jpg';
            console.log('使用默认封面');
        }
    } catch (error) {
        console.error('设置封面图片时出错:', error);
        musicCover.src = './images/default-cover.jpg';
    }
    
    // 添加封面图片加载错误处理
    musicCover.onerror = function() {
        console.warn('封面图片加载失败，使用默认封面');
        this.src = './images/default-cover.jpg';
        // 防止循环触发错误
        this.onerror = null;
    };
    
    // 显示加载中的提示
    musicLyrics.innerHTML = '<p class="current-lyric">加载中...</p>';
    
    // 显示播放器
    musicPlayer.classList.add('show');
}

// 播放歌曲
function playSong(song) {
    // 检查歌曲对象是否有效
    if (!song) {
        console.error('无效的歌曲对象');
        alert('无法播放：无效的歌曲信息');
        return;
    }
    
    console.log('播放歌曲:', song);
    
    // 如果有本地存储的歌曲信息，合并服务器返回的信息
    if (window.player && window.player.currentSelectedSong && 
        song.id === window.player.currentSelectedSong.id && 
        song.platform === window.player.currentSelectedSong.platform) {
        console.log('合并本地存储的歌曲信息和服务器返回的URL和歌词');
        // 只使用服务器返回的URL和歌词，其他信息使用本地存储的
        song = {
            ...window.player.currentSelectedSong,
            url: song.url,
            lrc: song.lrc,
            error: song.error // 保留错误信息
        };
        console.log('合并后的歌曲信息:', song);
    } else {
        console.warn('没有找到匹配的本地歌曲信息，使用服务器返回的信息');
    }
    
    const musicPlayer = document.getElementById('music-player');
    const musicTitle = document.getElementById('music-title');
    const musicArtist = document.getElementById('music-artist');
    const musicCover = document.getElementById('music-cover');
    const musicAudio = document.getElementById('music-audio');
    const musicLyrics = document.getElementById('music-lyrics');
    
    // 设置歌曲信息
    musicTitle.textContent = song.name || '未知歌曲';
    musicArtist.textContent = song.artist || '未知歌手';
    
    // 修复封面图片处理逻辑
    try {
        if (song.cover && song.cover.trim() !== '') {
            musicCover.src = song.cover;
            console.log('使用歌曲提供的封面:', song.cover);
        } else {
            // 使用相对路径的默认封面
            musicCover.src = './images/default-cover.jpg';
            console.log('使用默认封面');
        }
    } catch (error) {
        console.error('设置封面图片时出错:', error);
        musicCover.src = './images/default-cover.jpg';
    }
    
    // 添加封面图片加载错误处理
    musicCover.onerror = function() {
        console.warn('封面图片加载失败，使用默认封面');
        this.src = './images/default-cover.jpg';
        // 防止循环触发错误
        this.onerror = null;
    };
    
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


function initDraggablePlayer() {
    const musicPlayer = document.getElementById("music-player");
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    musicPlayer.onmousedown = function(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    };

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        musicPlayer.style.top = (musicPlayer.offsetTop - pos2) + "px"; // 更新top位置

        musicPlayer.style.left = (musicPlayer.offsetLeft - pos1) + "px"; // 更新left位置
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// 初始化播放器
function initPlayer() {
    initDraggablePlayer(); // 初始化可拖动功能
}

// 导出播放器模块
window.player = {
    playSong,
    showSongInfo,
    updateProgress,
    parseLyrics,
    startLyricScroll,
    initPlayer,
    currentSelectedSong: null // 初始化为null
}; 