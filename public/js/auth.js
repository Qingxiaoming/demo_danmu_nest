/**
 * 认证模块
 * 处理用户登录、登出和权限验证
 */

// 全局变量
window.userRole = localStorage.getItem('auth_token') ? 'owner' : 'guest'; // 根据token判断角色：已认证用户(owner)或游客(guest)
console.log('初始化用户角色:', window.userRole, '本地存储token:', localStorage.getItem('auth_token'));

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
                
                // 更新UI显示
                updateUIByRole();
                
                // 重新渲染弹幕
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