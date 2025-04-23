/**
 * 权限配置模块
 * 定义所有UI元素的权限和状态规则
 */

window.permissions = (function() {
    // 权限类型
    const ROLES = {
        ALL: 'all',               // 所有用户
        GUEST: 'guest',           // 未认证的游客
        AUTHENTICATED: 'owner'    // 已认证用户（管理员）
    };

    // 显示状态
    const STATES = {
        ALWAYS: 'always',     // 始终显示
        OPEN: 'open',         // 睁眼状态
        CLOSED: 'closed',     // 闭眼状态
        HIDDEN: 'hidden'      // 始终隐藏
    };

    // UI元素配置
    const uiElements = {
        // 按钮类
        'toggle-btn': { role: ROLES.ALL, eyeState: STATES.ALWAYS },
        'sort-btn': { role: ROLES.ALL, eyeState: STATES.OPEN },
        'add-danmu-btn': { role: ROLES.AUTHENTICATED, eyeState: STATES.ALWAYS },
        'settings-btn': { role: ROLES.AUTHENTICATED, eyeState: STATES.ALWAYS },
        'login-btn': { role: ROLES.GUEST, eyeState: STATES.CLOSED },
        'logout-btn': { role: ROLES.AUTHENTICATED, eyeState: STATES.OPEN },
        
        // 表单元素
        'login-form': { role: ROLES.ALL, eyeState: STATES.ALWAYS },
        'login-password': { role: ROLES.GUEST, eyeState: STATES.CLOSED },
        
        // 容器
        'add-danmu-btn-container': { role: ROLES.ALL, eyeState: STATES.ALWAYS },
        
        // 状态信息
        'login-status': { role: ROLES.ALL, eyeState: STATES.ALWAYS },
        'password-error': { role: ROLES.GUEST, eyeState: STATES.CLOSED },
        
        // 定时器组件
        'timer-container': { role: ROLES.AUTHENTICATED, eyeState: STATES.CLOSED },
        'timer-badge': { role: ROLES.AUTHENTICATED, eyeState: STATES.CLOSED },
        'stop-music-btn': { role: ROLES.AUTHENTICATED, eyeState: STATES.CLOSED },
        
        // 播放器组件 - 只在管理员闭眼状态时显示
        'music-player': { role: ROLES.AUTHENTICATED, eyeState: STATES.CLOSED },
        'play-pause-btn': { role: ROLES.AUTHENTICATED, eyeState: STATES.CLOSED },
        'close-player-btn': { role: ROLES.AUTHENTICATED, eyeState: STATES.CLOSED }
    };

    // 弹幕状态显示规则
    const danmuStatusRules = {
        'waiting': { closedEye: true, openEye: true },   // 等待状态：闭眼和睁眼都显示
        'pending': { closedEye: true, openEye: true },   // 挂起状态：闭眼和睁眼都显示
        'working': { closedEye: true, openEye: true },   // 工作状态：闭眼和睁眼都显示
        'pause': { closedEye: true, openEye: true },     // 暂停状态：闭眼和睁眼都显示
        'completed': { closedEye: false, openEye: true }, // 完成状态：仅睁眼显示
        'deleted': { closedEye: false, openEye: true }    // 删除状态：仅睁眼显示
    };

    // 判断元素是否应该显示
    function shouldShowElement(elementId, isAuthenticated, isEyeOpen) {
        const config = uiElements[elementId];
        if (!config) return true; // 如果没有配置，默认显示
        
        // 登录相关元素的可见性逻辑
        if (elementId === 'login-btn' || elementId === 'login-password' || elementId === 'password-error') {
            return (!isAuthenticated) && isEyeOpen;
        }     
        if (elementId === 'logout-btn') {
            return isAuthenticated && isEyeOpen;
        }
        if (elementId === 'login-form') {
            return isEyeOpen;
        }
        
        // 定时器组件处理 - 仅管理员在闭眼状态下显示
        if (elementId === 'timer-container') {
            const isMinimized = window.Timer && window.Timer.isMinimized;
            // 只有当管理员在闭眼状态下且定时器未最小化时才显示定时器容器
            return isAuthenticated && !isEyeOpen && !isMinimized;
        }
        
        // 角标处理 - 管理员状态下闭眼显示
        if (elementId === 'timer-badge') {
            return isAuthenticated && !isEyeOpen;
        }
        
        // 播放器组件处理 - 仅管理员在闭眼状态下显示
        if (elementId === 'music-player') {
            // 不自动隐藏已经显示的播放器，让播放按钮来控制
            const musicPlayer = document.getElementById('music-player');
            if (musicPlayer && musicPlayer.classList.contains('show')) {
                return true;
            }
            // 否则按照权限规则显示
            return isAuthenticated && !isEyeOpen;
        }
        
        // 其他元素使用标准的角色和眼睛状态检查
        const hasRolePermission = 
            config.role === ROLES.ALL || 
            (config.role === ROLES.AUTHENTICATED && isAuthenticated) || 
            (config.role === ROLES.GUEST && !isAuthenticated);
            
        const matchesEyeState = 
            config.eyeState === STATES.ALWAYS || 
            (config.eyeState === STATES.OPEN && isEyeOpen) || 
            (config.eyeState === STATES.CLOSED && !isEyeOpen);
            
        return hasRolePermission && matchesEyeState;
    }

    // 判断弹幕状态是否应该显示
    function shouldShowDanmuStatus(status, isEyeOpen) {
        const rule = danmuStatusRules[status];
        if (!rule) return true; // 如果没有规则，默认显示
        
        return isEyeOpen ? rule.openEye : rule.closedEye;
    }

    /**
     * 判断用户是否已认证（管理员权限）
     * @returns {boolean} 是否已认证
     */
    function isUserAuthenticated() {
        return window.userRole === 'owner';
    }

    /**
     * 获取当前眼睛状态
     * @returns {string} 'open' 或 'closed'
     */
    function getEyeState() {
        return window.danmu && window.danmu.showNonWaiting ? 'open' : 'closed';
    }

    /**
     * 管理定时器和角标显示
     */
    function manageTimerVisibility() {
        const timerContainer = document.getElementById('timer-container');
        const timerBadge = document.getElementById('timer-badge');
        const stopMusicBtn = document.getElementById('stop-music-btn');
        const timerInstance = window.timerModule ? window.timerModule.getTimer() : null;
        
        if (!timerInstance) {
            console.log('定时器实例不存在，无法管理显隐');
            return;
        }

        const isMinimized = timerInstance.isMinimized;
        const isAuthenticated = isUserAuthenticated();
        const isEyeOpen = getEyeState() === 'open';
        
        console.log(`定时器显隐状态: 已认证=${isAuthenticated}, 眼睛状态=${isEyeOpen ? '睁开' : '闭合'}, 最小化=${isMinimized}`);
        
        // 处理定时器容器、角标和停止音乐按钮 - 它们都只在管理员闭眼状态下显示
        const elementsToShow = [timerContainer, timerBadge, stopMusicBtn];
        const showElements = isAuthenticated && !isEyeOpen;
        // 定时器容器有额外条件：不能是最小化状态
        
        for (const element of elementsToShow) {
            if (element) {
                if (element === timerContainer) {
                    // 定时器容器需要额外检查最小化状态
                    element.style.display = (showElements && !isMinimized) ? '' : 'none';
                } else {
                    element.style.display = showElements ? '' : 'none';
                }
            }
        }
    }
    
    /**
     * 管理播放器显隐
     * 当切换眼睛状态时调用
     */
    function manageMusicPlayerVisibility() {
        const isAuthenticated = isUserAuthenticated();
        const isEyeOpen = getEyeState() === 'open';
        
        // 播放器显隐逻辑
        const musicPlayer = document.getElementById('music-player');
        if (musicPlayer) {
            // 已经在播放的不自动隐藏，但新的播放只在闭眼状态下显示
            if (isEyeOpen && !musicPlayer.classList.contains('show')) {
                console.log('眼睛睁开状态，新的音乐播放被禁止');
            }
            
            // 如果在眼睛睁开时已经显示，且用户不是已认证的管理员，则隐藏播放器
            if (isEyeOpen && musicPlayer.classList.contains('show') && !isAuthenticated) {
                musicPlayer.classList.remove('show');
                console.log('非管理员睁眼状态，强制隐藏播放器');
                
                // 停止音频播放
                const musicAudio = document.getElementById('music-audio');
                if (musicAudio) {
                    musicAudio.pause();
                }
            }
        }
    }

    // 更新UI元素显示状态
    function updateUIVisibility(isAuthenticated, isEyeOpen) {
        for (const elementId in uiElements) {
            const element = document.getElementById(elementId);
            if (element) {
                const shouldShow = shouldShowElement(elementId, isAuthenticated, isEyeOpen);
                
                // 打印登录相关元素的显示状态
                if (elementId === 'logout-btn' || elementId === 'login-btn' || 
                    elementId === 'login-password' || elementId === 'login-form') {
                    console.log(`${elementId}显示状态：shouldShow=${shouldShow}`);
                }
                
                // 设置显示状态
                if (shouldShow) {
                    // 特殊处理退出按钮的显示方式
                    if (elementId === 'logout-btn') {
                        element.style.display = 'inline-block';
                    } else {
                        element.style.display = '';
                    }
                } else {
                    element.style.display = 'none';
                }
                
                // 特殊处理设置按钮的可见性
                if (elementId === 'settings-btn') {
                    const visibleInEyeState = 
                        uiElements[elementId].eyeState === STATES.ALWAYS || 
                        (uiElements[elementId].eyeState === STATES.OPEN && isEyeOpen) || 
                        (uiElements[elementId].eyeState === STATES.CLOSED && !isEyeOpen);
                    
                    element.style.visibility = (shouldShow && visibleInEyeState) ? 'visible' : 'hidden';
                }
            }
        }
        
        // 处理定时器组件
        manageTimerVisibility();
        
        // 处理播放器显隐
        manageMusicPlayerVisibility();
    }

    // 公开API
    return {
        ROLES,
        STATES,
        uiElements,
        danmuStatusRules,
        shouldShowElement,
        shouldShowDanmuStatus,
        updateUIVisibility,
        manageTimerVisibility,
        manageMusicPlayerVisibility
    };
})(); 