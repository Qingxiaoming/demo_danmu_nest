/**
 * 认证模块
 * 处理用户登录、登出和权限验证
 */

// 全局变量
window.userRole = 'guest'; // 默认为游客角色
console.log('初始化用户角色:', window.userRole);

// 根据用户角色更新UI
function updateUIByRole() {
    const isAuthenticated = window.userRole === 'owner'; // 是否已认证（管理员）
    const isEyeOpen = window.danmu && window.danmu.showNonWaiting;
    
    console.log('更新UI，当前用户角色:', window.userRole, '显示非等待状态:', isEyeOpen);
    
    // 使用权限系统统一更新UI元素可见性
    if (window.permissions) {
        console.log('开始更新UI可见性，isAuthenticated=', isAuthenticated, 'isEyeOpen=', isEyeOpen);
        
        // 调用权限系统更新UI
        window.permissions.updateUIVisibility(isAuthenticated, isEyeOpen);
        
        console.log('已通过权限系统更新UI元素可见性');
        
        // 手动检查几个关键按钮的状态
        const loginForm = document.getElementById('login-form');
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const loginPassword = document.getElementById('login-password');
        
        console.log('登录表单和按钮实际状态:', {
            'login-form': loginForm ? loginForm.style.display : 'element不存在',
            'login-btn': loginBtn ? loginBtn.style.display : 'element不存在',
            'logout-btn': logoutBtn ? logoutBtn.style.display : 'element不存在',
            'login-password': loginPassword ? loginPassword.style.display : 'element不存在'
        });
    } else {
        console.warn('权限模块未加载，无法更新UI可见性');
    }
    
    // 清空登录状态文本
    const loginStatus = document.getElementById('login-status');
    if (loginStatus) {
        loginStatus.textContent = '';
    }
    
    // 检查并更新定时器显示
    if (window.ui && window.ui.checkPermissions) {
        window.ui.checkPermissions();
    }
}

// 检查JWT令牌是否有效
function checkTokenValidity() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        // 没有token，用户角色设为游客
        console.log('没有找到令牌，设置用户角色为guest');
        window.userRole = 'guest';
        updateUIByRole();
        return false;
    }
    
    try {
        // 先在客户端进行令牌验证
        let isExpired = false;
        let payload = null;
        let expTime = null;
        
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            
            payload = JSON.parse(jsonPayload);
            if (payload.exp) {
                expTime = new Date(payload.exp * 1000);
                const now = new Date();
                isExpired = expTime < now;
                
                console.log('JWT令牌客户端验证:', {
                    role: payload.role,
                    过期时间: expTime.toLocaleString(),
                    当前时间: now.toLocaleString(),
                    剩余时间: Math.floor((expTime - now) / 60000) + '分钟',
                    是否过期: isExpired
                });
                
                // 如果在客户端检测到令牌已过期，执行登出操作，不需要请求服务器
                if (isExpired) {
                    console.log('令牌在客户端检测已过期，执行登出操作');
                    logout();
                    return Promise.resolve(false);
                }
            }
        } catch (e) {
            console.warn('客户端令牌解析失败:', e);
        }
        
        // 如果客户端验证通过，且距离上次服务器验证时间不到3分钟，直接使用客户端验证结果
        const lastValidationTime = parseInt(localStorage.getItem('last_token_validation_time') || '0');
        const now = Date.now();
        const timeSinceLastValidation = now - lastValidationTime;
        const validationCooldown = 3 * 60 * 1000; // 增加到3分钟
        
        if (payload && !isExpired && timeSinceLastValidation < validationCooldown) {
            console.log('使用客户端验证结果，跳过服务器验证，距上次验证:', Math.floor(timeSinceLastValidation/1000), '秒');
            window.userRole = 'owner';
            updateUIByRole();
            return Promise.resolve(true);
        }
        
        // 客户端验证成功但需要服务器确认，或解析失败需要服务器验证
        console.log('执行服务器令牌验证，时间:', new Date().toLocaleString());
        
        // 创建一个验证函数，支持重试
        const verifyWithServer = (retryCount = 0, maxRetries = 3) => {
            return new Promise((resolve) => {
                console.log(`执行服务器令牌验证（尝试 ${retryCount + 1}/${maxRetries}），时间:`, new Date().toLocaleString());
                
                // 检查token是否过期（通过socket来验证）
                window.socket.emit('check_token', { token });
                
                // 设置一个标志，跟踪是否已经收到响应
                let hasResponse = false;
                
                // 等待服务器回应
                window.socket.once('check_token', (response) => {
                    hasResponse = true;
                    console.log('收到令牌验证响应:', response);
                    
                    if (response.valid) {
                        console.log('令牌有效，服务器确认');
                        window.userRole = 'owner';
                        updateUIByRole();
                        
                        // 记录最后一次验证时间
                        localStorage.setItem('last_token_validation_time', Date.now().toString());
                        
                        resolve(true);
                    } else {
                        console.log('令牌验证失败，原因:', response.message);
                        
                        // 如果有重试次数，则继续尝试
                        if (retryCount < maxRetries - 1) {
                            console.log(`令牌验证失败，将在3秒后重试，剩余尝试次数: ${maxRetries - retryCount - 1}`);
                            setTimeout(() => {
                                resolve(verifyWithServer(retryCount + 1, maxRetries));
                            }, 3000);
                        } else {
                            console.log('令牌已验证失败且达到最大重试次数，执行登出操作');
                            logout();
                            resolve(false);
                        }
                    }
                });
                
                // 设置超时，如果服务器没有响应，则尝试重试
                setTimeout(() => {
                    if (!hasResponse) {
                        console.log('令牌验证请求超时');
                        
                        // 如果有重试次数，则继续尝试
                        if (retryCount < maxRetries - 1) {
                            console.log(`验证请求超时，将在3秒后重试，剩余尝试次数: ${maxRetries - retryCount - 1}`);
                            setTimeout(() => {
                                resolve(verifyWithServer(retryCount + 1, maxRetries));
                            }, 3000);
                        } else {
                            console.log('令牌验证超时且达到最大重试次数，执行登出操作');
                            logout();
                            resolve(false);
                        }
                    }
                }, 10000); // 10秒超时
            });
        };
        
        // 开始验证流程
        return verifyWithServer();
        
    } catch (error) {
        console.error('令牌验证过程中发生错误:', error);
        logout();
        return false;
    }
}

// 开始定期检查令牌有效性
function startTokenValidityCheck() {
    // 清除可能存在的定时器
    if (window.tokenCheckTimer) {
        clearInterval(window.tokenCheckTimer);
    }
    
    // 创建新的定时器，每4分钟检查一次令牌有效性（错开与后端5分钟的冷却时间）
    // 增加立即执行一次检查的逻辑，确保登录后立即验证令牌
    setTimeout(() => {
        console.log('登录后立即执行一次令牌有效性检查，时间:', new Date().toLocaleString());
        checkTokenValidity();
    }, 2000); // 登录后2秒验证一次
    
    window.tokenCheckTimer = setInterval(() => {
        console.log('执行定期令牌有效性检查，时间:', new Date().toLocaleString());
        checkTokenValidity();
    }, 4 * 60 * 1000); // 改为4分钟，错开与后端5分钟的冷却时间
    
    console.log('已启动定期令牌有效性检查，间隔为4分钟');
}

// 登出功能
function logout() {
    // 删除localStorage中的token
    localStorage.removeItem('auth_token');
    
    // 更新用户角色
    window.userRole = 'guest';
    
    // 更新UI显示
    updateUIByRole();
    
    // 断开并重新连接WebSocket（以访客模式）
    if (window.socket.connected) {
        window.socket.auth = {}; // 清空认证信息
        window.socket.disconnect().connect();
    }
    
    // 清除令牌检查定时器
    if (window.tokenCheckTimer) {
        clearInterval(window.tokenCheckTimer);
        window.tokenCheckTimer = null;
    }
    
    console.log('用户已登出，认证信息已清除');
}

// 初始化登录按钮事件
function initLoginButton() {
    document.getElementById('login-btn').onclick = () => {
        const plainPassword = document.getElementById('login-password').value;
        if (!plainPassword) {
            return;
        }
        
        // 使用SHA-256对密码进行加密
        const hashedPassword = CryptoJS.SHA256(plainPassword).toString();
        console.log('发送SHA-256哈希密码进行验证');
        
        // 发送加密后的密码到后端进行验证，不再发送isHashed参数
        window.socket.emit('verify_password', { password: hashedPassword });
        
        window.socket.once('verify_password', (response) => {
            console.log('收到验证响应:', response, '时间:', new Date().toLocaleString());
            
            if (response.success && response.token) {
                console.log('验证成功,保存JWT令牌');
                
                // 保存JWT令牌
                localStorage.setItem('auth_token', response.token);
                console.log('JWT令牌已保存到localStorage');
                
                if (response.expires) {
                    console.log('令牌过期时间:', response.expires);
                    localStorage.setItem('auth_token_expires', response.expires);
                }
                
                // 标记已通过验证的标志，防止重连时反复验证
                window.hasValidatedTokenOnce = true;
                console.log('已设置hasValidatedTokenOnce=true，防止重连时重新验证');
                
                // 更新socket连接的认证信息
                window.socket.auth = { token: response.token };
                
                // 断开并重新连接以应用新的认证信息
                if (window.socket.connected) {
                    console.log('断开并重新连接以应用新的认证信息，时间:', new Date().toLocaleString());
                    window.socket.disconnect().connect();
                    console.log('连接状态更新为断开，等待重连');
                } else {
                    console.log('连接Socket以应用认证信息，时间:', new Date().toLocaleString());
                    window.socket.connect();
                }
                
                window.userRole = 'owner';
                console.log('用户角色已设置为owner，时间:', new Date().toLocaleString());
                
                // 更新UI显示
                updateUIByRole();
                
                // 开始定期检查令牌有效性
                startTokenValidityCheck();
                
                // 重新渲染弹幕
                window.danmu.renderDanmu();
                
                // 清空密码输入框
                document.getElementById('login-password').value = '';
            } else {
                // 处理验证失败
                console.log('验证失败，原因:', response.message || '未知错误');
                // 显示错误消息
                const loginStatus = document.getElementById('login-status');
                if (loginStatus) {
                    loginStatus.textContent = '验证失败: ' + (response.message || '未知错误');
                    loginStatus.style.color = 'red';
                }
            }
        });
    };
}

// 初始化登出按钮事件
function initLogoutButton() {
    document.getElementById('logout-btn').addEventListener('click', logout);
}

// 初始化认证模块
function initAuth() {
    // 清空所有提示信息
    const errorElement = document.getElementById('password-error');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.remove('show');
    }
    
    const loginStatus = document.getElementById('login-status');
    if (loginStatus) {
        loginStatus.textContent = '';
    }
    
    // 检查是否有保存的令牌并验证其有效性
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
        console.log('初始化认证模块时发现保存的令牌，将用于Socket连接');
        
        try {
            // 尝试解析token，看是否能获取过期时间（客户端检查）
            try {
                const base64Url = savedToken.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                
                const payload = JSON.parse(jsonPayload);
                if (payload.exp) {
                    const expTime = new Date(payload.exp * 1000);
                    const now = new Date();
                    console.log('初始化时JWT令牌信息:', {
                        role: payload.role,
                        过期时间: expTime.toLocaleString(),
                        当前时间: now.toLocaleString(),
                        剩余时间: Math.floor((expTime - now) / 60000) + '分钟'
                    });
                    
                    // 如果令牌已过期，直接清理并设为游客模式
                    if (expTime < now) {
                        console.log('初始化检测到令牌已过期，执行清理');
                        logout();
                        return;
                    }
                    
                    // 如果令牌有效，设置为登录状态，延迟验证以减少服务器负载
                    window.userRole = 'owner';
                    console.log('初始化后根据本地令牌验证设置用户角色为:', window.userRole);
                    
                    // 记录本地验证时间
                    localStorage.setItem('last_token_validation_time', now.getTime().toString());
                }
            } catch (e) {
                console.warn('无法解析JWT令牌内容:', e);
            }
        } catch (err) {
            console.error('初始化时本地令牌验证失败:', err);
        }
        
        // 使用保存的令牌初始化连接
        window.socket.auth = { token: savedToken };
        console.log('使用保存的令牌初始化连接');
        
        // 更新UI显示
        updateUIByRole();
        
        // 验证令牌 - 采用渐进式策略，先本地验证后服务器验证
        // 延长初始验证时间，确保socket连接已稳定
        setTimeout(() => {
            console.log('初始化延迟2秒后验证令牌有效性，当前角色:', window.userRole);
            checkTokenValidity().then(isValid => {
                if (isValid) {
                    // 如果令牌有效，开始定期检查
                    startTokenValidityCheck();
                }
            });
        }, 2000); // 延迟2秒，确保socket连接已建立
    } else {
        // 没有token，确保用户角色为游客
        window.userRole = 'guest';
        updateUIByRole();
    }
    
    // 设置登录按钮事件
    initLoginButton();
    
    // 设置登出按钮事件
    initLogoutButton();
}

// 导出认证模块
window.auth = {
    initAuth,
    updateUIByRole,
    logout,
    checkTokenValidity
}; 