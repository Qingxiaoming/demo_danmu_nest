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
    
    if (!dragElement) return;
    
    // 设置初始位置 - 确保在移动设备上有一个合理的初始位置
    // 如果没有自定义位置，将其放在右上角
    if (!dragElement.style.top && !dragElement.style.left) {
        dragElement.style.top = "20px";
        dragElement.style.right = "20px";
        dragElement.style.left = "auto"; // 确保left不会覆盖right
    }
    
    // 添加触屏支持，确保元素可以被移动
    dragElement.style.touchAction = "none";
    
    // 添加鼠标事件
    dragElement.onmousedown = dragMouseDown;
    
    // 添加触摸事件
    dragElement.addEventListener('touchstart', dragTouchStart, { passive: false });
    
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
    
    function dragTouchStart(e) {
        e.preventDefault(); // 阻止默认的触摸行为，如滚动
        
        // 获取第一个触摸点的位置
        const touch = e.touches[0];
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        
        // 添加触摸事件监听器
        document.addEventListener('touchmove', elementTouchDrag, { passive: false });
        document.addEventListener('touchend', closeTouchDragElement, { passive: false });
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
        moveElement();
    }
    
    function elementTouchDrag(e) {
        e.preventDefault();
        
        // 获取第一个触摸点的位置
        const touch = e.touches[0];
        
        // 计算新位置
        pos1 = pos3 - touch.clientX;
        pos2 = pos4 - touch.clientY;
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        
        // 设置元素的新位置
        moveElement();
    }
    
    function moveElement() {
        // 获取当前位置
        let newTop = dragElement.offsetTop - pos2;
        let newLeft = dragElement.offsetLeft - pos1;
        
        // 确保不会拖出屏幕
        newTop = Math.max(0, Math.min(window.innerHeight - dragElement.offsetHeight, newTop));
        newLeft = Math.max(0, Math.min(window.innerWidth - dragElement.offsetWidth, newLeft));
        
        // 设置新位置
        dragElement.style.top = newTop + "px";
        dragElement.style.left = newLeft + "px";
        // 当设置left时，确保清除right属性
        dragElement.style.right = "auto";
    }
    
    function closeDragElement() {
        // 停止鼠标移动
        document.onmouseup = null;
        document.onmousemove = null;
    }
    
    function closeTouchDragElement() {
        // 移除触摸事件监听器
        document.removeEventListener('touchmove', elementTouchDrag);
        document.removeEventListener('touchend', closeTouchDragElement);
    }
    
    // 在窗口大小改变时重新定位元素，确保不超出屏幕
    window.addEventListener('resize', () => {
        // 获取当前位置
        let newTop = parseInt(dragElement.style.top) || 0;
        let newLeft = parseInt(dragElement.style.left) || 0;
        
        // 确保不会超出屏幕
        newTop = Math.max(0, Math.min(window.innerHeight - dragElement.offsetHeight, newTop));
        newLeft = Math.max(0, Math.min(window.innerWidth - dragElement.offsetWidth, newLeft));
        
        // 设置新位置
        dragElement.style.top = newTop + "px";
        dragElement.style.left = newLeft + "px";
    });
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

// 检测是否为iPad设备
function isIPadDevice() {
    // 检测是否为iPad
    const isIPad = /iPad/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !window.MSStream);
    
    // 检测是否为非Windows设备
    const isNotWindows = !/Win/.test(navigator.platform) && !/Windows/.test(navigator.userAgent);
    
    // 检测是否为iOS (iPhone也可以使用滑动手势)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                 
    // 返回iPad或iOS设备且非Windows
    return (isIPad || isIOS) && isNotWindows;
}

// 初始化iPad悬浮窗功能（不显示按钮和手势提示）
function initIPadFloatingButton() {
    // 如果不是iPad设备，不进行任何操作
    if (!isIPadDevice()) {
        return;
    }
    
    // 只添加全屏和窗口控制功能的支持
    const stageManager = document.createElement('meta');
    stageManager.name = 'apple-mobile-web-app-capable';
    stageManager.content = 'yes';
    document.head.appendChild(stageManager);
    
    // 添加viewport meta标签以支持Stage Manager
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no';
    }
}

// 初始化工具箱功能
function initToolbox() {
    console.log('初始化工具箱...');
    
    const toolboxContainer = document.getElementById('toolbox-container');
    const toolboxBtn = document.getElementById('toolbox-btn');
    let leaveTimer = null; // 用于存储鼠标离开的计时器
    const delay = 200; // 延迟时间 (毫秒)
    
    if (!toolboxContainer || !toolboxBtn) {
        console.error('工具箱容器或按钮未找到');
        return;
    }
    
    // 检查文件传输和截屏按钮是否已添加到工具箱
    const fileTransferBtn = document.getElementById('file-transfer-btn');
    const captureBtn = document.getElementById('capture-tool-btn');
    
    // 日志确认按钮状态
    console.log('文件传输按钮:', fileTransferBtn ? '已找到' : '未找到');
    console.log('截屏按钮:', captureBtn ? '已找到' : '未找到');
    
    // 判断是否为移动设备
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobileDevice) {
        // --- 移动设备逻辑 --- 
        toolboxBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toolboxContainer.classList.toggle('expanded');
            console.log('移动设备: 工具箱展开状态已切换');
        });
        
        // 确保子按钮点击不会关闭工具箱
        [fileTransferBtn, captureBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止冒泡
                    // 如果需要，可以在点击子按钮后关闭工具箱
                    // toolboxContainer.classList.remove('expanded');
                });
            }
        });
        
        // 点击外部区域收起工具箱
        document.addEventListener('click', (event) => {
            if (!toolboxContainer.contains(event.target)) {
                toolboxContainer.classList.remove('expanded');
            }
        });
        console.log('移动设备: 点击展开/收起逻辑已设置');
        
    } else {
        // --- 桌面设备逻辑 --- 
        toolboxContainer.addEventListener('mouseenter', () => {
            // 清除可能存在的离开计时器
            clearTimeout(leaveTimer);
            // 添加展开类
            toolboxContainer.classList.add('expanded');
            console.log('桌面设备: 鼠标进入，展开工具箱');
        });
        
        toolboxContainer.addEventListener('mouseleave', () => {
            // 启动离开计时器
            leaveTimer = setTimeout(() => {
                toolboxContainer.classList.remove('expanded');
                console.log('桌面设备: 鼠标离开，收起工具箱');
            }, delay);
        });
        console.log('桌面设备: 悬停展开/收起逻辑已设置');
    }
    
    console.log('工具箱初始化完成');
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
    initStopMusicButton,
    isIPadDevice,
    initIPadFloatingButton,
    initToolbox
}; 