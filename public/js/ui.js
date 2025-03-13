/**
 * UI交互模块
 * 处理对话框、设置和用户界面交互
 */

// 显示添加弹幕对话框
function showAddDanmuDialog() {
    if (!window.utils.checkAdminPermission()) return;
    
    // 设置对话框显示状态为true
    window.danmu.isShowingDialog = true;
    
    const overlay = document.createElement('div');
    overlay.className = 'acps-dialog-overlay';
    document.body.appendChild(overlay);

    const dialog = document.createElement('div');
    dialog.className = 'acps-dialog';
    dialog.innerHTML = `
        <h3>添加弹幕</h3>
        <input type="text" id="add-nickname" placeholder="输入昵称">
        <input type="text" id="add-text" placeholder="输入弹幕内容">
        <button id="add-save">保存</button>
        <button id="add-cancel">取消</button>
    `;

    // 添加延时以触发动画
    requestAnimationFrame(() => {
        overlay.classList.add('show');
        dialog.classList.add('show');
    });

    const saveButton = dialog.querySelector('#add-save');
    const cancelButton = dialog.querySelector('#add-cancel');
    const nicknameField = dialog.querySelector('#add-nickname');
    const textField = dialog.querySelector('#add-text');

    // 添加键盘事件监听
    const handleKeydown = (e) => {
        if (e.key === 'Enter') {
            saveButton.click();
        } else if (e.key === 'Escape') {
            cancelButton.click();
        }
    };
    document.addEventListener('keydown', handleKeydown);

    // 在保存弹幕时进行输入验证
    function validateInput(text) {
        if (!text || text.length > 500) {
            return false;
        }
        // 检查是否包含恶意内容
        const maliciousPatterns = /<script|javascript:|onerror=|onclick=/i;
        return !maliciousPatterns.test(text);
    }

    // 在提交前验证
    saveButton.onclick = () => {
        const nickname = nicknameField.value;
        const text = textField.value;
        if (nickname && text && validateInput(nickname) && validateInput(text)) {
            window.socket.emit('add_danmu', {
                nickname: DOMPurify.sanitize(nickname),
                text: DOMPurify.sanitize(text)
            });
            closeDialog();
        } else {
            alert('输入内容无效或过长');
        }
    };

    cancelButton.onclick = () => {
        closeDialog();
    };

    const closeDialog = () => {
        document.removeEventListener('keydown', handleKeydown);
        overlay.classList.remove('show');
        dialog.classList.remove('show');
        setTimeout(() => {
            overlay.remove();
            dialog.remove();
            // 设置对话框显示状态为false
            window.danmu.isShowingDialog = false;
            // 关闭对话框后重新渲染一次，确保数据是最新的
            window.danmu.renderDanmu(window.danmu.currentDanmuData);
        }, 300);
    };

    document.body.appendChild(dialog);
}

// 显示设置对话框
function showSettingsDialog() {
    if (!window.utils.checkAdminPermission()) return;
    
    // 设置对话框显示状态为true
    window.danmu.isShowingDialog = true;
    
    // 获取快捷键设置
    const shortcutSettings = window.utils.loadShortcutSettings();
    
    const overlay = document.createElement('div');
    overlay.className = 'acps-dialog-overlay';
    document.body.appendChild(overlay);

    const dialog = document.createElement('div');
    dialog.className = 'acps-dialog';
    dialog.innerHTML = `
        <h3>快捷键设置</h3>
        <div class="settings-item">
            <label>删除快捷键：</label>
            <input type="text" id="delete-shortcut" placeholder="请按下快捷键组合" readonly value="${shortcutSettings.delete || ''}">
        </div>
        <div class="settings-item">
            <label>完成快捷键：</label>
            <input type="text" id="complete-shortcut" placeholder="请按下快捷键组合" readonly value="${shortcutSettings.complete || ''}">
        </div>
        <div class="settings-item">
            <label>编辑快捷键：</label>
            <input type="text" id="edit-shortcut" placeholder="请按下快捷键组合" readonly value="${shortcutSettings.edit || ''}">
        </div>
        <div class="settings-item">
            <label>账密快捷键：</label>
            <input type="text" id="acps-shortcut" placeholder="请按下快捷键组合" readonly value="${shortcutSettings.acps || ''}">
        </div>
        <div class="settings-item">
            <label>增加快捷键：</label>
            <input type="text" id="add-shortcut" placeholder="请按下快捷键组合" readonly value="${shortcutSettings.add || ''}">
        </div>
        <div class="settings-actions">
            <button id="settings-save">保存</button>
            <button id="settings-cancel">取消</button>
        </div>
    `;

    requestAnimationFrame(() => {
        overlay.classList.add('show');
        dialog.classList.add('show');
    });

    const closeDialog = () => {
        overlay.classList.remove('show');
        dialog.classList.remove('show');
        setTimeout(() => {
            overlay.remove();
            dialog.remove();
            // 设置对话框显示状态为false
            window.danmu.isShowingDialog = false;
            // 关闭对话框后重新渲染一次，确保数据是最新的
            window.danmu.renderDanmu(window.danmu.currentDanmuData);
        }, 300);
    };

    // 快捷键输入处理
    const shortcutInputs = dialog.querySelectorAll('input[type="text"]');
    shortcutInputs.forEach(input => {
        input.addEventListener('keydown', (e) => {
            e.preventDefault();
            const keys = [];
            if (e.ctrlKey) keys.push('Ctrl');
            if (e.shiftKey) keys.push('Shift');
            if (e.altKey) keys.push('Alt');
            if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
                keys.push(e.key.toUpperCase());
            }
            input.value = keys.join('+');
        });
    });

    dialog.querySelector('#settings-save').onclick = () => {
        const newSettings = {
            delete: document.getElementById('delete-shortcut').value,
            complete: document.getElementById('complete-shortcut').value,
            edit: document.getElementById('edit-shortcut').value,
            acps: document.getElementById('acps-shortcut').value,
            add: document.getElementById('add-shortcut').value
        };
        console.log('保存按钮点击，新的设置:', newSettings); // 调试输出
        window.utils.saveShortcutSettings(newSettings);
        closeDialog();
    };

    dialog.querySelector('#settings-cancel').onclick = closeDialog;

    document.body.appendChild(dialog);
}

// 显示账号密码对话框
function showAccountPasswordDialog(data, uid) {
    // 设置对话框显示状态为true
    window.danmu.isShowingDialog = true;
    
    const overlay = document.createElement('div');
    overlay.className = 'acps-dialog-overlay';
    document.body.appendChild(overlay);

    const dialog = document.createElement('div');
    dialog.className = 'acps-dialog';
    dialog.innerHTML = `
        <h3>账号密码信息</h3>
        <div class="acps-content">
            <div class="acps-display-mode">
                <p><strong>账号：</strong><span id="current-account">${data.account}</span></p>
                <p><strong>密码：</strong><span id="current-password">${data.password}</span></p>
                <div class="acps-buttons">
                    <button id="acps-copy" title="复制到剪贴板 (C)"><i class="fas fa-copy"></i> 复制</button>
                    <button id="acps-edit-mode" title="编辑模式 (R)"><i class="fas fa-edit"></i> 编辑</button>
                    <button id="acps-cancel">取消</button>
                </div>
            </div>
            <div class="acps-edit-mode" style="display: none;">
                <p><strong>账号：</strong><input type="text" id="edit-account" value="${data.account}"></p>
                <p><strong>密码：</strong><input type="text" id="edit-password" value="${data.password}"></p>
                <div class="acps-buttons">
                    <button id="acps-save"><i class="fas fa-save"></i> 保存</button>
                    <button id="acps-cancel-edit"><i class="fas fa-times"></i> 取消</button>
                </div>
            </div>
        </div>
    `;

    // 添加延时以触发动画
    requestAnimationFrame(() => {
        overlay.classList.add('show');
        dialog.classList.add('show');
    });

    // 获取DOM元素
    const displayMode = dialog.querySelector('.acps-display-mode');
    const editMode = dialog.querySelector('.acps-edit-mode');
    const copyBtn = dialog.querySelector('#acps-copy');
    const editModeBtn = dialog.querySelector('#acps-edit-mode');
    const saveBtn = dialog.querySelector('#acps-save');
    const cancelBtn = dialog.querySelector('#acps-cancel');
    const cancelEditBtn = dialog.querySelector('#acps-cancel-edit');

    // 复制到剪贴板功能
    copyBtn.onclick = () => {
        const accountText = data.account;
        const passwordText = data.password;
        
        // 创建两个临时输入框，用于分别复制账号和密码
        const accountInput = document.createElement('input');
        accountInput.value = accountText;
        document.body.appendChild(accountInput);
        accountInput.select();
        document.execCommand('copy');
        document.body.removeChild(accountInput);
        
        // 显示复制账号成功提示
        const copyAccountSuccess = document.createElement('div');
        copyAccountSuccess.textContent = '账号复制成功！';
        copyAccountSuccess.style.color = 'green';
        copyAccountSuccess.style.marginTop = '10px';
        copyAccountSuccess.style.textAlign = 'center';
        
        // 如果已经有提示，则移除
        const existingSuccess = dialog.querySelector('.copy-success');
        if (existingSuccess) {
            existingSuccess.remove();
        }
        
        copyAccountSuccess.className = 'copy-success';
        displayMode.appendChild(copyAccountSuccess);
        
        // 1秒后复制密码
        setTimeout(() => {
            const passwordInput = document.createElement('input');
            passwordInput.value = passwordText;
            document.body.appendChild(passwordInput);
            passwordInput.select();
            document.execCommand('copy');
            document.body.removeChild(passwordInput);
            
            // 更新提示为密码复制成功
            copyAccountSuccess.textContent = '密码复制成功！';
            
            // 2秒后移除提示
            setTimeout(() => {
                copyAccountSuccess.remove();
            }, 2000);
        }, 1000);
    };

    // 切换到编辑模式
    editModeBtn.onclick = () => {
        displayMode.style.display = 'none';
        editMode.style.display = 'block';
    };

    // 保存编辑
    saveBtn.onclick = () => {
        const newAccount = dialog.querySelector('#edit-account').value;
        const newPassword = dialog.querySelector('#edit-password').value;
        
        if (newAccount && newPassword) {
            // 更新数据
            data.account = newAccount;
            data.password = newPassword;
            
            // 发送到后端，按照后端期望的格式发送
            window.socket.emit('update_acps', {
                index: uid,
                text: `${newAccount} / ${newPassword}`
            });
            
            // 更新显示
            dialog.querySelector('#current-account').textContent = newAccount;
            dialog.querySelector('#current-password').textContent = newPassword;
            
            // 切回显示模式
            editMode.style.display = 'none';
            displayMode.style.display = 'block';
        } else {
            alert('账号和密码不能为空');
        }
    };

    // 取消编辑，返回显示模式
    cancelEditBtn.onclick = () => {
        editMode.style.display = 'none';
        displayMode.style.display = 'block';
    };

    // 关闭对话框
    cancelBtn.onclick = () => {
        closeDialog();
    };

    // 添加键盘事件监听
    const handleKeydown = (e) => {
        if (e.key.toLowerCase() === 'c') {
            // 按C复制
            copyBtn.click();
        } else if (e.key.toLowerCase() === 'r') {
            // 按R进入编辑模式
            if (displayMode.style.display !== 'none') {
                editModeBtn.click();
            }
        } else if (e.key === 'Escape') {
            // ESC关闭对话框或返回显示模式
            if (editMode.style.display !== 'none') {
                cancelEditBtn.click();
            } else {
                cancelBtn.click();
            }
        } else if (e.key === 'Enter') {
            // Enter保存编辑或在显示模式下复制
            if (editMode.style.display !== 'none') {
                saveBtn.click();
            } else {
                copyBtn.click();
            }
        }
    };
    
    document.addEventListener('keydown', handleKeydown);

    // 关闭弹出对话框
    const closeDialog = () => {
        document.removeEventListener('keydown', handleKeydown);
        overlay.classList.remove('show');
        dialog.classList.remove('show');
        setTimeout(() => {
            overlay.remove();
            dialog.remove();
            // 设置对话框显示状态为false
            window.danmu.isShowingDialog = false;
            // 关闭对话框后重新渲染一次，确保数据是最新的
            window.danmu.renderDanmu(window.danmu.currentDanmuData);
        }, 300);
    };

    document.body.appendChild(dialog);
}

// 初始化UI事件
function initUIEvents() {
    // 设置按钮点击事件
    document.getElementById('settings-btn').onclick = () => {
        showSettingsDialog();
    };
    
    // 添加弹幕按钮点击事件
    document.getElementById('add-danmu-btn').onclick = () => {
        showAddDanmuDialog();
    };
    
    // 初始化切换按钮状态
    const toggleBtn = document.getElementById('toggle-btn');
    const eyeIcon = toggleBtn.querySelector('i');
    
    if (window.danmu.showNonWaiting) {
        // 显示所有状态 - 睁眼
        eyeIcon.className = 'fas fa-eye';
        toggleBtn.title = '当前显示全部状态，点击仅显示等待状态';
    } else {
        // 仅显示等待状态 - 闭眼
        eyeIcon.className = 'fas fa-eye-slash';
        toggleBtn.title = '当前仅显示等待状态，点击显示全部状态';
    }
    
    // 全局快捷键监听
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'i') {
            e.preventDefault();
            showSettingsDialog();
        } else if (e.ctrlKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            showAddDanmuDialog();
        } else if (e.ctrlKey && e.key.toLowerCase() === 't') {
            e.preventDefault();
            document.getElementById('toggle-btn').click();
        }
    });
    
    // 绑定快捷键到功能
    const shortcutSettings = window.utils.loadShortcutSettings();
    document.addEventListener('keydown', (e) => {
        const keyCombination = [];
        if (e.ctrlKey) keyCombination.push('Ctrl');
        if (e.shiftKey) keyCombination.push('Shift');
        if (e.altKey) keyCombination.push('Alt');
        if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
            keyCombination.push(e.key.toUpperCase());
        }
        const keyString = keyCombination.join('+');

        switch (keyString) {
            case shortcutSettings.delete:
                // 执行删除操作
                console.log('执行删除操作');
                break;
            case shortcutSettings.complete:
                // 执行完成操作
                console.log('执行完成操作');
                break;
            case shortcutSettings.edit:
                // 执行编辑操作
                console.log('执行编辑操作');
                break;
            case shortcutSettings.acps:
                // 执行账密操作
                console.log('执行账密操作');
                break;
            case shortcutSettings.add:
                // 执行增加操作
                console.log('执行增加操作');
                break;
        }
    });
}

// 导出UI模块
window.ui = {
    showAddDanmuDialog,
    showSettingsDialog,
    showAccountPasswordDialog,
    initUIEvents
}; 