/**
 * 音乐播放器模块
 * 处理音乐播放、歌词显示和进度更新
 */

// 全局变量
let currentLyrics = [];
let lyricTimer = null;
let isPlaying = false; // 跟踪播放状态

// 初始化全局播放器对象，确保在加载时就可用
window.player = {
    playSong: null,  // 将在下面定义
    showSongInfo: null,  // 将在下面定义
    togglePlay: null,  // 将在下面定义
    closePlayer: null,  // 将在下面定义
    isPlaying: () => isPlaying,
    currentSelectedSong: null,
    
    // 添加用于socket.js中的歌曲播放功能和点歌功能集成
    requestSong: function(songName) {
        if (!songName) return;
        if (window.socket) {
            window.socket.emit('search_song', { keyword: songName });
        } else {
            console.error('Socket未初始化，无法请求歌曲');
        }
    },
    
    // 选择歌曲播放的方法
    selectSong: function(song) {
        if (!song || !song.id || !song.platform) {
            console.error('歌曲信息不完整，无法播放', song);
            return;
        }
    
        // 保存当前选中的歌曲
        this.currentSelectedSong = song;
        
        // 检查socket是否连接
        if (!window.socket) {
            console.error('Socket未初始化，无法播放歌曲');
            alert('网络连接不可用，请刷新页面后重试');
            return;
        }
        
        if (!window.socket.connected) {
            console.error('Socket未连接，无法播放歌曲');
            alert('网络连接断开，请刷新页面后重试');
            return;
        }
        
        // 发送播放请求到服务器
        window.socket.emit('play_selected_song', {
            id: song.id,
            platform: song.platform
        });
        
        // 如果showSongInfo已定义，立即显示基本信息
        if (typeof this.showSongInfo === 'function') {
            this.showSongInfo(song);
        }
    },
    
    // 初始化方法将在下方定义
    initPlayer: null
};

// 播放歌曲
function playSong(song) {
    // 检查歌曲对象是否有效
    if (!song) {
        console.error('无效的歌曲对象');
        alert('无法播放：无效的歌曲信息');
        return;
    }
    
    // 检查当前是否为管理员闭眼状态
    const isAuthenticated = window.permissions && typeof window.permissions.isUserAuthenticated === 'function' ? 
        window.permissions.isUserAuthenticated() : window.userRole === 'owner';
    const isEyeOpen = window.permissions && typeof window.permissions.getEyeState === 'function' ? 
        window.permissions.getEyeState() === 'open' : (window.danmu && window.danmu.showNonWaiting);
    
    // 如果不是管理员闭眼状态，不允许播放
    if (!isAuthenticated || isEyeOpen) {
        console.error('只有在管理员闭眼状态下才能播放音乐');
        alert('只有在管理员闭眼状态下才能播放音乐');
        return;
    }
    
    // 如果有本地存储的歌曲信息，合并服务器返回的信息
    if (window.player && window.player.currentSelectedSong && 
        song.id === window.player.currentSelectedSong.id && 
        song.platform === window.player.currentSelectedSong.platform) {
        // 只使用服务器返回的URL和歌词，其他信息使用本地存储的
        song = {
            ...window.player.currentSelectedSong,
            url: song.url,
            lrc: song.lrc,
            error: song.error // 保留错误信息
        };
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
        if (song.cover && song.cover.trim() !== '' && !song.cover.includes('T002R300x300M000.jpg')) {
            musicCover.src = song.cover;
        } else {
            // 使用相对路径的默认封面
            musicCover.src = './images/default-cover.jpg';
        }
    } catch (error) {
        console.error('设置封面图片时出错:', error);
        musicCover.src = './images/default-cover.jpg';
    }
    
    // 添加封面图片加载错误处理
    musicCover.onerror = function() {
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
    musicPlayer.style.display = 'flex';
    
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
        isPlaying = false; // 更新播放状态
    });
    
    // 开始歌词滚动
    startLyricScroll();
    
    // 设置播放状态
    isPlaying = true;
}
// 为全局对象设置方法
window.player.playSong = playSong;

// 更新进度条
function updateProgress() {
    const musicAudio = document.getElementById('music-audio');
    const musicProgressBar = document.getElementById('music-progress-bar');
    
    if (musicAudio.duration) {
        const progress = (musicAudio.currentTime / musicAudio.duration) * 100;
        musicProgressBar.style.width = `${progress}%`;
        
        // 更新时间显示
        updateTimeDisplay(musicAudio.currentTime, musicAudio.duration);
    }
}

// 格式化时间，将秒数转换为 mm:ss 格式
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// 更新时间显示
function updateTimeDisplay(currentTime, duration) {
    const timeDisplay = document.querySelector('.music-time');
    if (timeDisplay) {
        const currentTimeEl = timeDisplay.querySelector('.current-time');
        const totalTimeEl = timeDisplay.querySelector('.total-time');
        
        if (currentTimeEl && totalTimeEl) {
            currentTimeEl.textContent = formatTime(currentTime);
            totalTimeEl.textContent = formatTime(duration);
        }
    }
}

// 解析LRC格式歌词
function parseLyrics(lrcText) {
    const musicLyrics = document.getElementById('music-lyrics');
    currentLyrics = [];
    musicLyrics.innerHTML = '';
    
    // 确保没有滚动条箭头
    musicLyrics.style.overflow = 'hidden';
    
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

    // 创建拖动句柄
    const dragHandle = document.createElement('div');
    dragHandle.className = 'player-drag-handle';
    dragHandle.innerHTML = '<i class="fas fa-grip-lines"></i>';
    dragHandle.style.position = 'absolute';
    dragHandle.style.top = '5px';
    dragHandle.style.right = '5px';
    dragHandle.style.fontSize = '12px';
    dragHandle.style.color = '#999';
    dragHandle.style.cursor = 'move';
    dragHandle.style.padding = '2px';
    dragHandle.style.zIndex = '10';
    musicPlayer.appendChild(dragHandle);

    // 只有拖动句柄可以触发拖动
    dragHandle.onmousedown = function(e) {
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
        
        // 取消transform的居中定位
        if (musicPlayer.style.transform.includes('translateX(-50%)')) {
            const rect = musicPlayer.getBoundingClientRect();
            musicPlayer.style.left = (rect.left + rect.width / 2) + 'px';
            musicPlayer.style.transform = 'translateX(0)';
        }
        
        musicPlayer.style.top = (musicPlayer.offsetTop - pos2) + "px"; // 更新top位置
        musicPlayer.style.left = (musicPlayer.offsetLeft - pos1) + "px"; // 更新left位置
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// 新增：暂停/播放切换功能
function togglePlay() {
    const musicAudio = document.getElementById('music-audio');
    
    if (musicAudio.paused) {
        musicAudio.play().then(() => {
            isPlaying = true;
            updatePlayPauseButton(true);
        }).catch(error => {
            console.error('恢复播放失败:', error);
        });
    } else {
        musicAudio.pause();
        isPlaying = false;
        updatePlayPauseButton(false);
    }
}
// 为全局对象设置方法
window.player.togglePlay = togglePlay;

// 新增：更新播放/暂停按钮状态
function updatePlayPauseButton(isPlaying) {
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.innerHTML = isPlaying ? 
            '<i class="fas fa-pause"></i>' : 
            '<i class="fas fa-play"></i>';
    }
}

// 新增：关闭音乐播放器
function closePlayer() {
    const musicPlayer = document.getElementById('music-player');
    const musicAudio = document.getElementById('music-audio');
    
    // 停止播放
    musicAudio.pause();
    musicAudio.currentTime = 0;
    isPlaying = false;
    
    // 隐藏播放器
    musicPlayer.classList.remove('show');
    musicPlayer.style.display = 'none';
    
    // 清除歌词定时器
    clearInterval(lyricTimer);
}
// 为全局对象设置方法
window.player.closePlayer = closePlayer;

// 新增：初始化进度条拖动功能
function initProgressDrag() {
    const musicProgress = document.querySelector('.music-progress');
    const musicAudio = document.getElementById('music-audio');
    
    musicProgress.addEventListener('click', function(e) {
        if (!musicAudio.duration) return;
        
        const rect = this.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        musicAudio.currentTime = percent * musicAudio.duration;
        updateProgress();
    });
}

// 初始化播放器
function initPlayer() {
    console.log('初始化音乐播放器');
    
    // 初始化可拖动播放器
    initDraggablePlayer();
    
    // 初始化进度条拖动功能
    initProgressDrag();
    
    // 给播放器添加控制按钮
    addPlayerControls();
    
    // 将播放器控制按钮的可见性与权限系统集成
    if (window.permissions && typeof window.permissions.updateUIVisibility === 'function') {
        // 添加音乐控制按钮到权限管理中
        window.permissions.uiElements['play-pause-btn'] = { 
            role: window.permissions.ROLES.ALL, 
            eyeState: window.permissions.STATES.ALWAYS 
        };
        
        window.permissions.uiElements['close-player-btn'] = { 
            role: window.permissions.ROLES.ALL, 
            eyeState: window.permissions.STATES.ALWAYS 
        };
    }
    
    // 添加键盘快捷键控制
    document.addEventListener('keydown', function(e) {
        // 只有当播放器显示时才处理快捷键
        const musicPlayer = document.getElementById('music-player');
        if (!musicPlayer.classList.contains('show')) return;
        
        // 空格键：播放/暂停
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault(); // 防止页面滚动
            togglePlay();
        }
        
        // ESC键：关闭播放器
        if (e.key === 'Escape') {
            closePlayer();
        }
    });
    
    console.log('音乐播放器初始化完成');
}
// 为全局对象设置初始化方法
window.player.initPlayer = initPlayer;

// 新增：添加播放器控制按钮
function addPlayerControls() {
    // 创建控制按钮容器
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'music-controls';
    
    // 添加播放/暂停按钮
    const playPauseBtn = document.createElement('button');
    playPauseBtn.id = 'play-pause-btn';
    playPauseBtn.className = 'music-control-btn';
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    playPauseBtn.title = '播放/暂停';
    playPauseBtn.addEventListener('click', togglePlay);
    
    // 添加关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.id = 'close-player-btn';
    closeBtn.className = 'music-control-btn';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.title = '关闭播放器';
    closeBtn.addEventListener('click', closePlayer);
    
    // 将按钮添加到容器
    controlsContainer.appendChild(playPauseBtn);
    controlsContainer.appendChild(closeBtn);
    
    // 将控制容器添加到播放器
    const musicPlayer = document.getElementById('music-player');
    musicPlayer.appendChild(controlsContainer);
    
    // 获取进度条元素
    const musicProgress = musicPlayer.querySelector('.music-progress');
    
    // 添加时间显示元素
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'music-time';
    timeDisplay.innerHTML = `
        <span class="current-time">0:00</span>
        <span class="total-time">0:00</span>
    `;
    musicProgress.appendChild(timeDisplay);
    
    // 添加提示文本，提醒用户可以拖动进度条
    const progressTip = document.createElement('div');
    progressTip.className = 'progress-tip';
    progressTip.textContent = '点击调整播放位置';
    musicProgress.appendChild(progressTip);
    
    // 为进度条添加可视化提示
    musicProgress.title = '点击调整播放进度';
    musicProgress.style.cursor = 'pointer';
    
    // 优化歌词容器
    const musicLyrics = musicPlayer.querySelector('.music-lyrics');
    if (musicLyrics) {
        // 确保歌词容器具有正确的高度和滚动行为
        musicLyrics.style.scrollBehavior = 'smooth';
    }
}

// 创建默认封面图片
function createDefaultCoverImage() {
    const defaultCover = new Image();
    defaultCover.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNlZWUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSIzNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgYWxpZ25tZW50LWJhc2VsaW5lPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
    defaultCover.alt = '默认封面';
    defaultCover.style.display = 'none';
    defaultCover.id = 'default-cover-template';
    document.body.appendChild(defaultCover);
    
    // 创建CSS规则，当加载失败时自动使用默认图片
    const style = document.createElement('style');
    style.textContent = `
        img.music-cover {
            object-fit: cover;
            min-width: 60px;
            min-height: 60px;
            background-color: #eee;
            background-image: url(${defaultCover.src});
            background-size: contain;
            background-position: center;
            background-repeat: no-repeat;
        }
    `;
    document.head.appendChild(style);
}

// 页面加载时立即执行
document.addEventListener('DOMContentLoaded', function() {
    // 创建默认封面图片
    createDefaultCoverImage();
});

// 导出模块（兼容NodeJS环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
    playSong,
    showSongInfo,
    initPlayer,
        togglePlay,
        closePlayer
    };
}

// 显示歌曲信息但不播放
function showSongInfo(song) {
    // 检查当前是否为管理员闭眼状态
    const isAuthenticated = window.permissions && typeof window.permissions.isUserAuthenticated === 'function' ? 
        window.permissions.isUserAuthenticated() : window.userRole === 'owner';
    const isEyeOpen = window.permissions && typeof window.permissions.getEyeState === 'function' ? 
        window.permissions.getEyeState() === 'open' : (window.danmu && window.danmu.showNonWaiting);
    
    // 如果不是管理员闭眼状态，不允许显示
    if (!isAuthenticated || isEyeOpen) {
        console.error('只有在管理员闭眼状态下才能显示音乐信息');
        return;
    }
    
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
        if (song.cover && song.cover.trim() !== '' && !song.cover.includes('T002R300x300M000.jpg')) {
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
    
    // 确保没有滚动条箭头
    musicLyrics.style.overflow = 'hidden';
    
    // 显示播放器
    musicPlayer.classList.add('show');
    musicPlayer.style.display = 'flex';
}
// 为全局对象设置方法
window.player.showSongInfo = showSongInfo; 