/**
 * 工具函数模块
 * 包含通用的辅助函数
 */

// 显示连接状态的函数
function showConnectionStatus(connected, message = '') {
    // 检查状态指示器是否存在，不存在则创建
    let statusIndicator = document.getElementById('connection-status');
    if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'connection-status';
        statusIndicator.style.position = 'fixed';
        statusIndicator.style.bottom = '10px';
        statusIndicator.style.right = '10px';
        statusIndicator.style.padding = '5px 10px';
        statusIndicator.style.borderRadius = '5px';
        statusIndicator.style.fontSize = '12px';
        statusIndicator.style.zIndex = '1000';
        document.body.appendChild(statusIndicator);
    }
    
    if (connected) {
        statusIndicator.style.backgroundColor = '#5cb85c';
        statusIndicator.style.color = 'white';
        statusIndicator.textContent = '已连接';
        
        // 连接成功后3秒隐藏
        setTimeout(() => {
            statusIndicator.style.opacity = '0.5';
        }, 3000);
    } else {
        statusIndicator.style.backgroundColor = '#d9534f';
        statusIndicator.style.color = 'white';
        statusIndicator.style.opacity = '1';
        statusIndicator.textContent = message ? `未连接: ${message}` : '未连接';
    }
}

// 显示认证错误提示
function showAuthError(message) {
    const errorElement = document.getElementById('password-error');
    errorElement.textContent = message || '需要登录才能执行此操作';
    errorElement.classList.add('show');
    setTimeout(() => {
        errorElement.classList.remove('show');
    }, 3000);
}

// 更新登录状态显示
function updateLoginStatus(text, color) {
    const loginStatus = document.getElementById('login-status');
    loginStatus.textContent = text;
    loginStatus.style.color = color;
}

// 检查是否是已认证用户（管理员）
function checkAuthenticatedPermission() {
    console.log('检查已认证用户权限，当前用户角色:', window.userRole);
    if (window.userRole !== 'owner') {
        console.log('用户未认证，无管理员权限');
        showAuthError();
        return false;
    }
    console.log('用户已认证，具有管理员权限');
    return true;
}

// 拖动GIF的功能
function initDraggableGif() {
    const dragElement = document.getElementById("draggable-gif-container");
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    if (dragElement) {
        dragElement.onmousedown = dragMouseDown;
    }
    
    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // 获取鼠标位置
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // 鼠标移动时调用elementDrag函数
        document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // 计算新位置
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // 设置元素的新位置
        dragElement.style.top = (dragElement.offsetTop - pos2) + "px";
        dragElement.style.left = (dragElement.offsetLeft - pos1) + "px";
    }
    
    function closeDragElement() {
        // 停止移动
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// 读取本地存储中的快捷键设置
function loadShortcutSettings() {
    const settings = localStorage.getItem('shortcut_settings');
    return settings ? JSON.parse(settings) : {};
}

// 保存快捷键设置
function saveShortcutSettings(settings) {
    localStorage.setItem('shortcut_settings', JSON.stringify(settings));
    return settings;
}

// 停止所有音频播放
function stopAllAudio() {
    // 创建一个列表来存储所有可能的音频元素
    const audioElements = [
        // 音乐播放器中的音频元素
        document.getElementById('music-audio'),
        // 定时器结束提示音
        window.timerAudio,
        // 使用 document.querySelectorAll 获取所有 audio 元素
        ...document.querySelectorAll('audio')
    ];
    
    // 停止所有找到的音频元素
    let stoppedCount = 0;
    audioElements.forEach(audio => {
        if (audio && !audio.paused) {
            try {
                audio.pause();
                audio.currentTime = 0;
                stoppedCount++;
            } catch (e) {
                console.error('停止音频失败:', e);
            }
        }
    });
    
    // 通过 Web Audio API 停止所有上下文
    try {
        if (window.audioContext) {
            window.audioContext.suspend();
        }
        
        if (window.player && window.player.pauseMusic && typeof window.player.pauseMusic === 'function') {
            window.player.pauseMusic();
        }
    } catch (e) {
        console.error('停止音频上下文失败:', e);
    }
    
    console.log(`已停止 ${stoppedCount} 个音频播放`);
    
    // 显示反馈提示
    showAudioStoppedFeedback();
}

// 显示音频停止的视觉反馈
function showAudioStoppedFeedback() {
    // 创建一个临时的视觉反馈元素
    const feedback = document.createElement('div');
    feedback.style.position = 'fixed';
    feedback.style.bottom = '130px';
    feedback.style.left = '20px';
    feedback.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    feedback.style.color = 'white';
    feedback.style.padding = '8px 12px';
    feedback.style.borderRadius = '4px';
    feedback.style.fontSize = '14px';
    feedback.style.zIndex = '1001';
    feedback.style.opacity = '0';
    feedback.style.transition = 'opacity 0.3s ease';
    feedback.textContent = '已停止所有音频播放';
    
    document.body.appendChild(feedback);
    
    // 淡入显示
    setTimeout(() => {
        feedback.style.opacity = '1';
    }, 10);
    
    // 2秒后淡出并移除
    setTimeout(() => {
        feedback.style.opacity = '0';
        setTimeout(() => {
            feedback.remove();
        }, 300);
    }, 2000);
}

// 初始化停止音乐按钮
function initStopMusicButton() {
    const stopButton = document.getElementById('stop-music-btn');
    if (stopButton) {
        stopButton.addEventListener('click', stopAllAudio);
    }
}

// 导出工具函数
window.utils = {
    showConnectionStatus,
    showAuthError,
    updateLoginStatus,
    checkAuthenticatedPermission,
    initDraggableGif,
    loadShortcutSettings,
    saveShortcutSettings,
    stopAllAudio,
    initStopMusicButton
}; 