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

// 检查是否有权限执行管理员操作
function checkAdminPermission() {
    console.log('检查管理员权限，当前用户角色:', window.userRole);
    if (window.userRole !== 'owner') {
        console.log('用户没有管理员权限');
        showAuthError();
        return false;
    }
    console.log('用户有管理员权限');
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
    const settings = localStorage.getItem('shortcutSettings');
    return settings ? JSON.parse(settings) : {};
}

// 保存快捷键设置到本地存储
function saveShortcutSettings(settings) {
    console.log('保存快捷键设置:', settings); // 调试输出
    localStorage.setItem('shortcutSettings', JSON.stringify(settings));
}

// 初始化默认快捷键设置
function initDefaultShortcuts() {
    const currentSettings = loadShortcutSettings();
    
    // 如果没有设置或设置不完整，则设置默认值
    const defaultSettings = {
        delete: currentSettings.delete || 'D',
        complete: currentSettings.complete || 'C',
        edit: currentSettings.edit || 'E',
        acps: currentSettings.acps || 'A',
        add: currentSettings.add || 'Ctrl+A'
    };
    
    // 只有在设置不完整时才保存默认设置
    if (!currentSettings.delete || !currentSettings.complete || 
        !currentSettings.edit || !currentSettings.acps || !currentSettings.add) {
        saveShortcutSettings(defaultSettings);
        console.log('已初始化默认快捷键设置:', defaultSettings);
    }
    
    return defaultSettings;
}

// 导出工具函数
window.utils = {
    showConnectionStatus,
    showAuthError,
    updateLoginStatus,
    checkAdminPermission,
    initDraggableGif,
    loadShortcutSettings,
    saveShortcutSettings,
    initDefaultShortcuts
}; 