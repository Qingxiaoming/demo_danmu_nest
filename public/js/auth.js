/**
 * 认证模块
 * 处理用户登录、登出和权限验证
 */

// 全局变量
window.userRole = localStorage.getItem('auth_token') ? 'owner' : 'guest'; // 根据token判断角色

// 根据用户角色更新UI
function updateUIByRole() {
    const addDanmuBtnContainer = document.querySelector('.add-danmu-btn-container');
    const logoutBtn = document.getElementById('logout-btn');
    const addDanmuBtn = document.getElementById('add-danmu-btn');
    const settingsBtn = document.getElementById('settings-btn');
    
    // 显示/隐藏添加弹幕按钮和设置按钮
    if (window.userRole === 'owner') {
        // 确保按钮容器始终可见
        addDanmuBtnContainer.style.display = 'flex';
        
        // 添加弹幕按钮在登录状态下始终显示，不管是睁眼还是闭眼
        addDanmuBtn.style.display = 'flex';
        
        // 只在睁眼状态下显示登出按钮和设置按钮
        if (window.danmu && window.danmu.showNonWaiting) {
            logoutBtn.style.display = 'inline-block';
            settingsBtn.style.display = 'flex';
        } else {
            logoutBtn.style.display = 'none';
            settingsBtn.style.display = 'none';
        }
    } else {
        // 非管理员用户只显示toggle按钮
        addDanmuBtnContainer.style.display = 'flex';
        addDanmuBtn.style.display = 'none';
        settingsBtn.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
    
    // 清空登录状态文本
    const loginStatus = document.getElementById('login-status');
    if (loginStatus) {
        loginStatus.textContent = '';
    }
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
            console.log('收到验证响应:', response);
            
            if (response.success && response.token) {
                console.log('验证成功,保存JWT令牌');
                
                // 保存JWT令牌
                localStorage.setItem('auth_token', response.token);
                console.log('JWT令牌已保存到localStorage');
                
                // 更新socket连接的认证信息
                window.socket.auth = { token: response.token };
                
                // 断开并重新连接以应用新的认证信息
                if (window.socket.connected) {
                    window.socket.disconnect().connect();
                    console.log('断开并重新连接以应用新的认证信息');
                } else {
                    window.socket.connect();
                    console.log('连接Socket以应用认证信息');
                }
                
                window.userRole = 'owner';
                updateUIByRole();
                window.danmu.renderDanmu();
                
                // 清空密码输入框
                document.getElementById('login-password').value = '';
            } else {
                // 处理验证失败
                console.log('验证失败');
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
    
    // 初始化UI状态
    updateUIByRole();
    
    // 设置登录按钮事件
    initLoginButton();
    
    // 设置登出按钮事件
    initLogoutButton();
    
    // 检查是否有保存的令牌
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
        // 使用保存的令牌初始化连接
        window.socket.auth = { token: savedToken };
        console.log('使用保存的令牌初始化连接');
    }
}

// 导出认证模块
window.auth = {
    initAuth,
    updateUIByRole,
    logout
}; 