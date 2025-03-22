/**
 * WebSocket模块
 * 处理与服务器的实时通信
 */

// 全局变量
window.isConnected = false; // 添加连接状态标志
window.hasValidatedTokenOnce = false; // 添加令牌验证标志

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
        console.log('连接成功，时间：', new Date().toLocaleString());
        window.isConnected = true;
        window.utils.showConnectionStatus(true);
        
        // 输出连接信息和认证状态
        console.log('Socket连接ID:', window.socket.id);
        console.log('当前用户角色:', window.userRole);
        console.log('localStorage中的令牌:', localStorage.getItem('auth_token') ? '存在' : '不存在');
        console.log('Socket认证信息:', window.socket.auth);
        
        // 检查是否有保存的令牌，如果有则在连接后验证其有效性
        // 但只在页面加载后第一次连接时验证，避免重连时反复验证
        const savedToken = localStorage.getItem('auth_token');
        if (savedToken && window.auth && typeof window.auth.checkTokenValidity === 'function') {
            // 检查是否是首次加载后的连接
            if (!window.hasValidatedTokenOnce) {
                console.log('首次连接已建立，检查保存的令牌有效性');
                setTimeout(() => {
                    window.auth.checkTokenValidity().then(isValid => {
                        window.hasValidatedTokenOnce = true;
                        console.log('首次令牌验证完成，结果:', isValid ? '有效' : '无效', '时间:', new Date().toLocaleString());
                    });
                }, 2000); // 延迟2秒，确保连接稳定
            } else {
                console.log('重连成功，恢复角色状态');
                
                // 重连后增加渐进式验证，先使用本地令牌验证恢复角色
                try {
                    const token = savedToken;
                    // 尝试解析token，看是否能获取过期时间（客户端检查）
                    const base64Url = token.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(''));
                    
                    const payload = JSON.parse(jsonPayload);
                    if (payload.exp) {
                        const expTime = new Date(payload.exp * 1000);
                        const now = new Date();
                        const isExpired = expTime < now;
                        
                        console.log('重连后本地令牌验证:', {
                            role: payload.role,
                            过期时间: expTime.toLocaleString(),
                            当前时间: now.toLocaleString(),
                            剩余时间: Math.floor((expTime - now) / 60000) + '分钟',
                            是否过期: isExpired
                        });
                        
                        // 如果本地验证令牌已过期，执行登出
                        if (isExpired) {
                            console.log('重连时本地检测到令牌已过期，执行登出操作');
                            window.auth.logout();
                            return;
                        }
                        
                        // 恢复角色
                        window.userRole = 'owner';
                        if (window.auth) {
                            window.auth.updateUIByRole();
                            console.log('重连后恢复角色状态为:', window.userRole, '时间:', new Date().toLocaleString());
                        }
                        
                        // 在后台轻量级验证令牌
                        setTimeout(() => {
                            console.log('重连后执行轻量级令牌验证');
                            window.socket.emit('check_token', { token });
                            
                            window.socket.once('check_token', (response) => {
                                console.log('重连后令牌验证响应:', response);
                                if (!response.valid) {
                                    console.log('重连后令牌验证失败，执行登出操作');
                                    window.auth.logout();
                                }
                            });
                        }, 5000); // 延迟5秒，降低服务器负载
                    }
                } catch (e) {
                    console.warn('重连后无法解析JWT令牌内容:', e);
                }
            }
        }
    });
    
    // 设置Socket事件监听
    setupSocketEvents();
}

// 使用函数封装Socket.IO事件处理逻辑
function setupSocketEvents() {
    // 定义所有需要监听的事件
    const socketEvents = [
        'update', 'get_acps', 'add_danmu', 'play_song', 'song_search_results'
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
            
        case 'add_danmu':
            console.log('弹幕操作结果:', data);
            if (data && data.success) {
                console.log(data.isUpdate ? '弹幕更新成功' : '弹幕添加成功');
            } else if (data) {
                console.error('弹幕操作失败:', data.message);
            }
            break;
            
        case 'play_song':
            console.log('收到播放歌曲响应:', data);
            if (data && data.success && data.song) {
                console.log(`收到歌曲URL和歌词: ID=${data.song.id}, 平台=${data.song.platform}`);
                
                // 检查是否有匹配的本地歌曲信息
                if (window.player.currentSelectedSong && 
                    data.song.id === window.player.currentSelectedSong.id && 
                    data.song.platform === window.player.currentSelectedSong.platform) {
                    
                    // 播放歌曲，此时会自动合并本地存储的歌曲信息和服务器返回的URL和歌词
                    window.player.playSong(data.song);
                } else {
                    console.warn('没有找到匹配的本地歌曲信息');
                    // 如果没有本地信息，仍然尝试播放
                    window.player.playSong(data.song);
                }
            } else if (data) {
                console.error('播放歌曲失败:', data.message || '未知错误');
                
                // 显示错误提示
                if (data.song) {
                    // 如果有歌曲信息但播放失败，仍然尝试显示
                    // 合并本地存储的歌曲信息
                    if (window.player.currentSelectedSong && 
                        data.song.id === window.player.currentSelectedSong.id && 
                        data.song.platform === window.player.currentSelectedSong.platform) {
                        
                        data.song = {
                            ...window.player.currentSelectedSong,
                            error: data.song.error || { message: data.message || '未知错误' }
                        };
                    }
                    window.player.playSong(data.song);
                } else {
                    alert('播放歌曲失败: ' + (data.message || '未知错误'));
                }
            }
            break;
            
        case 'song_search_results':
            console.log('收到歌曲搜索结果:', data);
            if (data && data.success && data.songs && data.songs.length > 0) {
                console.log(`显示${data.songs.length}首歌曲的搜索结果`);
                window.ui.showSongSearchResults(data.songs);
            } else {
                // 显示没有找到歌曲的提示
                console.warn('没有找到相关歌曲:', data);
                alert('没有找到相关歌曲');
            }
            break;
            
        default:
            console.log(`未处理的事件: ${eventName}`, data);
            break;
    }
}


// 导出Socket模块
window.socket_module = {
    initSocket
}; 