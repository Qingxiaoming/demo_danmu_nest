/**
 * WebSocket模块
 * 处理与服务器的实时通信
 */

// 全局变量
window.isConnected = false; // 添加连接状态标志
window.hasValidatedTokenOnce = false; // 添加令牌验证标志

// 初始化Socket连接
function initSocket() {
    // 使用当前页面域名和端口作为Socket连接地址
    // 获取当前网站的协议、主机名和端口
    const protocol = window.location.protocol === 'https:' ? 'https://' : 'http://';
    const hostname = window.location.hostname; // 自动适应任何访问地址
    const port = '5052'; // 保持原有端口
    
    // 构建连接URL
    const socketUrl = `${protocol}${hostname}:${port}`;
    console.log('连接到Socket服务器:', socketUrl);
    
    window.socket = io(socketUrl, {
        auth: {
            token: sessionStorage.getItem('auth_token')
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
                window.socket.connect();
            }, 3000);
        }
        // 其他断开原因会自动重连
    });
    
    // 处理重新连接
    window.socket.on('reconnect', (attemptNumber) => {
        window.utils.showConnectionStatus(true);
    });
    
    // 处理重新连接尝试
    window.socket.on('reconnect_attempt', (attemptNumber) => {
        window.utils.showConnectionStatus(false, `尝试重新连接 (${attemptNumber})`);
    });
    
    // 处理重新连接错误
    window.socket.on('reconnect_error', (error) => {
        window.utils.showConnectionStatus(false, `重新连接错误: ${error.message}`);
    });
    
    // 处理重新连接失败
    window.socket.on('reconnect_failed', () => {
        window.utils.showConnectionStatus(false, '重新连接失败，请刷新页面');
    });
    
    // 连接状态显示
    window.socket.on('connect', () => {
        window.isConnected = true;
        window.utils.showConnectionStatus(true);
        
        // 检查是否有保存的令牌，如果有则在连接后验证其有效性
        // 但只在页面加载后第一次连接时验证，避免重连时反复验证
        const savedToken = sessionStorage.getItem('auth_token');
        if (savedToken && window.auth && typeof window.auth.checkTokenValidity === 'function') {
            // 检查是否是首次加载后的连接
            if (!window.hasValidatedTokenOnce) {
                setTimeout(() => {
                    window.auth.checkTokenValidity().then(isValid => {
                        window.hasValidatedTokenOnce = true;
                    });
                }, 2000); // 延迟2秒，确保连接稳定
            }
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
                    
                    // 如果本地验证令牌已过期，执行登出
                    if (isExpired) {
                        window.auth.logout();
                        return;
                    }
                    
                    // 恢复角色
                    window.userRole = 'owner';
                    if (window.auth) {
                        window.auth.updateUIByRole();
                    }
                    
                    // 在后台轻量级验证令牌
                    setTimeout(() => {
                        window.socket.emit('check_token', { token });
                        
                        window.socket.once('check_token', (response) => {
                            if (!response.valid) {
                                window.auth.logout();
                            }
                        });
                    }, 5000); // 延迟5秒，降低服务器负载
                }
            } catch (e) {
                console.warn('重连后无法解析JWT令牌内容:', e);
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
        'update', 'get_acps', 'add_danmu', 
        'play_selected_song', 'song_search_results', 
        'pending', 'resume', 'working', 'pause', 'resume_working'
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
            // 保存最新数据前进行深度比较，避免不必要的渲染
            const hasChanges = needsUpdate(window.danmu.currentDanmuData, data);
            // 只有在确实有数据变化或当前没有数据时才更新和渲染
            if (hasChanges) {
                window.danmu.currentDanmuData = data; // 保存最新数据
                // 只有在没有显示对话框时才重新渲染
                if (!window.danmu.isShowingDialog) {
                    window.danmu.renderDanmu(data);
                }
            }
            break;
            
        case 'get_acps':
            if (data && data.data) {
                window.ui.showAccountPasswordDialog(data.data, data.uid);
            }
            break;
            
        case 'add_danmu':
            if (data && data.success) {
                // 弹幕添加或更新成功
            } else if (data) {
                console.error('弹幕操作失败:', data.message);
            }
            break;
            
        case 'pending':
            if (!data || !data.success) {
                console.error('弹幕挂起失败:', data?.message);
            }
            break;
            
        case 'resume':
            if (!data || !data.success) {
                console.error('弹幕恢复失败:', data?.message);
            }
            break;
            
        case 'working':
            if (!data || !data.success) {
                console.error('开始工作失败:', data?.message);
            }
            break;
            
        case 'pause':
            if (!data || !data.success) {
                console.error('暂停工作失败:', data?.message);
            }
            break;
            
        case 'resume_working':
            if (!data || !data.success) {
                console.error('恢复工作失败:', data?.message);
            }
            break;
            
        case 'play_selected_song':
            if (data && data.success && data.song) {
                // 检查是否有匹配的本地歌曲信息
                if (window.player && window.player.currentSelectedSong && 
                    data.song.id === window.player.currentSelectedSong.id && 
                    data.song.platform === window.player.currentSelectedSong.platform) {
                    
                    // 播放歌曲，会自动合并本地存储的歌曲信息和服务器返回的URL和歌词
                    if (typeof window.player.playSong === 'function') {
                        window.player.playSong(data.song);
                    } else {
                        alert('播放器未完全初始化，请刷新页面后重试');
                    }
                } else {
                    // 如果没有本地信息，仍然尝试播放
                    if (window.player && typeof window.player.playSong === 'function') {
                        window.player.playSong(data.song);
                    } else {
                        alert('播放器未完全初始化，请刷新页面后重试');
                    }
                }
            } else if (data) {
                // 显示错误提示
                if (data.song) {
                    // 如果有歌曲信息但播放失败，仍然尝试显示
                    // 合并本地存储的歌曲信息
                    if (window.player && window.player.currentSelectedSong && 
                        data.song.id === window.player.currentSelectedSong.id && 
                        data.song.platform === window.player.currentSelectedSong.platform) {
                        
                        data.song = {
                            ...window.player.currentSelectedSong,
                            error: data.song.error || { message: data.message || '未知错误' }
                        };
                    }
                    
                    if (window.player && typeof window.player.playSong === 'function') {
                        window.player.playSong(data.song);
                    } else {
                        alert(`播放歌曲失败: ${data.message || '未知错误'}`);
                    }
                } else {
                    alert('播放歌曲失败: ' + (data.message || '未知错误'));
                }
            }
            break;
            
        case 'song_search_results':
            if (data && data.success && data.songs && data.songs.length > 0) {
                window.ui.showSongSearchResults(data.songs);
            } else {
                // 显示没有找到歌曲的提示
                alert('没有找到相关歌曲');
            }
            break;
            
        default:
            console.log(`未处理的事件: ${eventName}`, data);
            break;
    }
}

/**
 * 比较新旧数据，决定是否需要更新UI
 * @param {Object} oldData 旧数据
 * @param {Object} newData 新数据
 * @returns {boolean} 是否需要更新
 */
function needsUpdate(oldData, newData) {
    // 如果没有旧数据，需要更新
    if (!oldData) return true;
    
    // 如果新数据为空，不需要更新
    if (!newData) return false;
    
    // 检查弹幕数量是否有变化
    if (!oldData.uid || !newData.uid || oldData.uid.length !== newData.uid.length) {
        return true;
    }
    
    // 检查选中项状态是否有改变
    if (window.danmu.currentSelectedDanmuItem) {
        const selectedUid = window.danmu.currentSelectedDanmuItem.getAttribute('data-uid');
        if (selectedUid) {
            const oldIndex = oldData.uid.indexOf(selectedUid);
            const newIndex = newData.uid.indexOf(selectedUid);
            
            // 如果选中项存在于两个数据中，检查其状态是否有变化
            if (oldIndex !== -1 && newIndex !== -1) {
                if (oldData.status[oldIndex] !== newData.status[newIndex]) {
                    return true; // 状态改变，需要更新
                }
                
                if (oldData.text[oldIndex] !== newData.text[newIndex]) {
                    return true; // 文本改变，需要更新
                }

                // 只有在工作时间实际改变时才更新工作状态
                if (newData.status[newIndex] === 'working') {
                    // 只在工作时长实际变化时更新UI
                    const oldWorkingDuration = oldData.workingDuration && oldData.workingDuration[oldIndex] 
                        ? Number(oldData.workingDuration[oldIndex]) : 0;
                    const newWorkingDuration = newData.workingDuration && newData.workingDuration[newIndex] 
                        ? Number(newData.workingDuration[newIndex]) : 0;
                    
                    // 工作时长每30秒才更新一次界面，而不是每次轮询都更新
                    return Math.abs(newWorkingDuration - oldWorkingDuration) >= 30;
                }
            }
        }
    }
    
    // 检查是否有新的项目被添加
    const oldUids = new Set(oldData.uid);
    const newUids = new Set(newData.uid);
    
    for (const uid of newUids) {
        if (!oldUids.has(uid)) {
            return true; // 新增项目
        }
    }
    
    // 检查是否有项目被删除
    for (const uid of oldUids) {
        if (!newUids.has(uid)) {
            return true; // 删除项目
        }
    }
    
    // 检查是否有状态变化（只有状态实际变化才更新）
    for (let i = 0; i < newData.uid.length; i++) {
        const uid = newData.uid[i];
        const oldIndex = oldData.uid.indexOf(uid);
        
        // 如果找不到老ID或状态有变化，需要更新
        if (oldIndex === -1) {
            return true;
        }
        
        // 状态变化需要更新
        if (oldData.status[oldIndex] !== newData.status[i]) {
            return true;
        }
        
        // 文本变化需要更新
        if (oldData.text[oldIndex] !== newData.text[i]) {
            return true;
        }
    }
    
    // 默认情况下，如果没有检测到明显变化，不进行更新
    return false;
}

// 导出Socket模块
window.socket_module = {
    initSocket
}; 