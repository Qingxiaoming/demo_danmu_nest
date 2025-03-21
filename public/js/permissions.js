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
        'password-error': { role: ROLES.GUEST, eyeState: STATES.CLOSED }
    };

    // 弹幕状态显示规则
    const danmuStatusRules = {
        'waiting': { closedEye: true, openEye: true },   // 等待状态：闭眼和睁眼都显示
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
    }

    // 公开API
    return {
        ROLES,
        STATES,
        uiElements,
        danmuStatusRules,
        shouldShowElement,
        shouldShowDanmuStatus,
        updateUIVisibility
    };
})(); 