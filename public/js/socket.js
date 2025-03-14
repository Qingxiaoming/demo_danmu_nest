/**
 * WebSocket模块
 * 处理与服务器的实时通信
 */

// 全局变量
window.isConnected = false; // 添加连接状态标志

// 初始化Socket连接
function initSocket() {
    window.socket = io('http://127.0.0.1:5052', {
        auth: {
            token: localStorage.getItem('auth_token')
        }
    });
    
    // 处理连接错误
    window.socket.on('connect_error', (error) => {
        console.error('连接错误:', error);
        // 在UI上显示连接错误
        window.utils.showConnectionStatus(false, error.message);
    });
    
    // 处理断开连接
    window.socket.on('disconnect', (reason) => {
        console.log('断开连接:', reason);
        window.utils.showConnectionStatus(false, reason);
        
        // 如果是服务器断开连接，尝试重新连接
        if (reason === 'io server disconnect') {
            // 服务器断开连接，需要手动重连
            setTimeout(() => {
                console.log('尝试重新连接...');
                window.socket.connect();
            }, 3000);
        }
        // 其他断开原因会自动重连
    });
    
    // 处理重新连接
    window.socket.on('reconnect', (attemptNumber) => {
        console.log('重新连接成功，尝试次数:', attemptNumber);
        window.utils.showConnectionStatus(true);
    });
    
    // 处理重新连接尝试
    window.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('尝试重新连接，次数:', attemptNumber);
        window.utils.showConnectionStatus(false, `尝试重新连接 (${attemptNumber})`);
    });
    
    // 处理重新连接错误
    window.socket.on('reconnect_error', (error) => {
        console.error('重新连接错误:', error);
        window.utils.showConnectionStatus(false, `重新连接错误: ${error.message}`);
    });
    
    // 处理重新连接失败
    window.socket.on('reconnect_failed', () => {
        console.error('重新连接失败');
        window.utils.showConnectionStatus(false, '重新连接失败，请刷新页面');
    });
    
    // 连接状态显示
    window.socket.on('connect', () => {
        console.log('连接成功');
        window.isConnected = true;
        window.utils.showConnectionStatus(true);
    });
    
    // 设置Socket事件监听
    setupSocketEvents();
}

// 使用函数封装Socket.IO事件处理逻辑
function setupSocketEvents() {
    // 定义所有需要监听的事件
    const socketEvents = [
        'update', 'get_acps', 'update_acps', 'add_danmu', 'play_song'
    ];
    // 为每个事件添加监听器
    socketEvents.forEach(eventName => {
        window.socket.on(eventName, (data) => {
            handleSocketEvent(eventName, data);
        });
    });
}

// 使用switch-case处理不同的Socket.IO事件
function handleSocketEvent(eventName, data) {
    switch(eventName) {
        case 'update':
            window.danmu.currentDanmuData = data; // 保存最新数据
            // 只有在没有显示对话框时才重新渲染
            if (!window.danmu.isShowingDialog) {
                window.danmu.renderDanmu(data);
            }
            break;
            
        case 'get_acps':
            console.log('收到账密数据:', data);
            if (data && data.data) {
                window.ui.showAccountPasswordDialog(data.data, data.uid);
            }
            break;
            
        case 'update_acps':
            break;
            
        case 'add_danmu':
            console.log('弹幕操作结果:', data);
            if (data && data.success) {
                console.log(data.isUpdate ? '弹幕更新成功' : '弹幕添加成功');
            } else if (data) {
                console.error('弹幕操作失败:', data.message);
            }
            break;
            
        case 'play_song':
            console.log('收到点歌请求:', data);
            if (data && data.success && data.song) {
                window.player.playSong(data.song);
            }
            break;
            
        default:
            console.log(`未处理的事件: ${eventName}`, data);
            break;
    }
}

// 处理服务器事件
function handleServerEvents(socket) {
    // 监听服务器事件
    const eventHandlers = {
        'update': (data) => {
            // 更新弹幕列表
            window.danmu.currentDanmuData = data;
            window.danmu.renderDanmu(data);
        },
        'get_acps': (data) => {
            if (data.success) {
                window.ui.showAccountPasswordDialog(data, data.uid);
            } else {
                console.error('获取账号密码失败:', data.message);
            }
        },
        'update_acps': (data) => {
            if (data.success) {
                console.log('账号密码更新成功');
            } else {
                console.error('账号密码更新失败:', data.message);
            }
        },
        'add_danmu': (data) => {
            if (data.success) {
                console.log(data.isUpdate ? '弹幕更新成功' : '弹幕添加成功');
            } else {
                console.error('弹幕操作失败:', data.message);
            }
        },
        'play_song': (data) => {
            if (data.success && data.song) {
                window.player.playSong(data.song);
            } else {
                console.error('播放歌曲失败:', data.message);
            }
        },
        'verify_password': (data) => {
            // 这个事件在auth.js中处理
        }
    };
}

// 导出Socket模块
window.socket_module = {
    initSocket
}; 