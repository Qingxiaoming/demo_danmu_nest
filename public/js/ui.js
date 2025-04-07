/**
 * UI交互模块
 * 处理对话框、设置和用户界面交互
 */

// 显示添加弹幕对话框
function showAddDanmuDialog() {
    if (!window.utils.checkAuthenticatedPermission()) return;
    
    // 设置对话框显示状态为true
    window.danmu.isShowingDialog = true;
    
    const overlay = document.createElement('div');
    overlay.className = 'acps-dialog-overlay';
    document.body.appendChild(overlay);

    const dialog = document.createElement('div');
    dialog.className = 'acps-dialog';
    dialog.innerHTML = `
        <h3>添加/更新弹幕</h3>
        <p class="dialog-tip">如果昵称已存在，将更新该昵称的弹幕内容</p>
        <input type="text" id="add-nickname" placeholder="输入昵称">
        <input type="text" id="add-text" placeholder="输入弹幕内容">
        <button id="add-save">保存</button>
        <button id="add-cancel">取消</button>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .dialog-tip {
            font-size: 12px;
            color: #666;
            margin-bottom: 10px;
            font-style: italic;
        }
    `;
    document.head.appendChild(style);

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

// 显示设置菜单
function showSettingsDialog() {
    console.log('显示设置菜单函数被调用');
    if (!window.utils.checkAuthenticatedPermission()) {
        console.log('未认证用户，返回');
        return;
    }
    
    // 如果已经存在设置菜单，则移除
    const existingMenu = document.getElementById('settings-menu');
    if (existingMenu) {
        console.log('已存在设置菜单，移除');
        existingMenu.remove();
        window.danmu.isShowingDialog = false;
        return;
    }
    
    console.log('创建新的设置菜单');
    // 设置对话框显示状态为true
    window.danmu.isShowingDialog = true;
    
    // 创建设置菜单
    const settingsMenu = document.createElement('div');
    settingsMenu.id = 'settings-menu';
    settingsMenu.className = 'settings-menu';
    
    // 设置菜单样式
    settingsMenu.style.position = 'fixed';
    settingsMenu.style.right = '70px';
    settingsMenu.style.bottom = '70px';
    settingsMenu.style.backgroundColor = 'white';
    settingsMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    settingsMenu.style.borderRadius = '5px';
    settingsMenu.style.padding = '10px 0';
    settingsMenu.style.zIndex = '1000';
    settingsMenu.style.minWidth = '180px';
    
    // 添加菜单项
    const menuItems = [
        { id: 'shortcut-settings', text: '快捷键设置', icon: 'fas fa-keyboard' },
        { id: 'ui-settings', text: '界面设置', icon: 'fas fa-palette' },
        { id: 'queue-settings', text: '排队设置', icon: 'fas fa-list-ol' },
        { id: 'music-settings', text: '音乐设置', icon: 'fas fa-music' }
    ];
    
    menuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'settings-menu-item';
        menuItem.innerHTML = `<i class="${item.icon}"></i> ${item.text}`;
        
        // 设置菜单项样式
        menuItem.style.padding = '10px 15px';
        menuItem.style.cursor = 'pointer';
        menuItem.style.transition = 'background-color 0.2s';
        
        // 鼠标悬停效果
        menuItem.addEventListener('mouseover', () => {
            menuItem.style.backgroundColor = '#f0f0f0';
        });
        
        menuItem.addEventListener('mouseout', () => {
            menuItem.style.backgroundColor = 'transparent';
        });
        
        // 点击事件
        menuItem.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            closeMenu();
            switch (item.id) {
                case 'shortcut-settings':
                    showShortcutSettings();
                    break;
                case 'ui-settings':
                    showUISettings();
                    break;
                case 'queue-settings':
                    showQueueSettings();
                    break;
                case 'music-settings':
                    showMusicSettings();
                    break;
            }
        });
        
        settingsMenu.appendChild(menuItem);
    });
    
    // 添加点击外部关闭菜单
    setTimeout(() => {
        console.log('添加点击外部关闭菜单的事件监听器');
        document.addEventListener('click', handleOutsideClick);
    }, 100);
    
    function handleOutsideClick(e) {
        console.log('点击事件触发，检查是否点击在菜单外部');
        if (!settingsMenu.contains(e.target) && e.target.id !== 'settings-btn') {
            console.log('点击在菜单外部，关闭菜单');
            closeMenu();
        }
    }
    
    function closeMenu() {
        console.log('关闭菜单');
        document.removeEventListener('click', handleOutsideClick);
        settingsMenu.remove();
        window.danmu.isShowingDialog = false;
    }
    
    document.body.appendChild(settingsMenu);
    console.log('设置菜单已添加到文档中');
}

// 显示快捷键设置对话框
function showShortcutSettings() {
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

// 显示界面设置对话框
function showUISettings() {
    // 设置对话框显示状态为true
    window.danmu.isShowingDialog = true;
    
    const overlay = document.createElement('div');
    overlay.className = 'acps-dialog-overlay';
    document.body.appendChild(overlay);

    const dialog = document.createElement('div');
    dialog.className = 'acps-dialog';
    dialog.innerHTML = `
        <h3>界面设置</h3>
        <div class="settings-item">
            <label>主题颜色：</label>
            <select id="theme-color">
                <option value="light">浅色主题</option>
                <option value="blue">蓝色主题</option>
            </select>
        </div>
        <div class="settings-item">
            <label>字体大小：</label>
            <select id="font-size">
                <option value="small">小</option>
                <option value="medium" selected>中</option>
                <option value="large">大</option>
            </select>
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
        }, 300);
    };

    dialog.querySelector('#settings-save').onclick = () => {
        // 保存界面设置的逻辑（待实现）
        closeDialog();
    };

    dialog.querySelector('#settings-cancel').onclick = closeDialog;

    document.body.appendChild(dialog);
}

// 显示排队设置对话框
function showQueueSettings() {
    // 设置对话框显示状态为true
    window.danmu.isShowingDialog = true;
    
    const overlay = document.createElement('div');
    overlay.className = 'acps-dialog-overlay';
    document.body.appendChild(overlay);

    const dialog = document.createElement('div');
    dialog.className = 'acps-dialog';
    dialog.innerHTML = `
        <h3>排队设置</h3>
        <div class="settings-item">
            <label>最大排队数量：</label>
            <input type="number" id="max-queue" value="50" min="1" max="100">
        </div>
        <div class="settings-item">
            <label>自动完成时间(分钟)：</label>
            <input type="number" id="auto-complete-time" value="30" min="1" max="120">
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
        }, 300);
    };

    dialog.querySelector('#settings-save').onclick = () => {
        // 保存排队设置的逻辑（待实现）
        closeDialog();
    };

    dialog.querySelector('#settings-cancel').onclick = closeDialog;

    document.body.appendChild(dialog);
}

// 显示音乐设置对话框
function showMusicSettings() {
    // 设置对话框显示状态为true
    window.danmu.isShowingDialog = true;
    
    const overlay = document.createElement('div');
    overlay.className = 'acps-dialog-overlay';
    document.body.appendChild(overlay);

    const dialog = document.createElement('div');
    dialog.className = 'acps-dialog';
    dialog.innerHTML = `
        <h3>音乐设置</h3>
        <div class="settings-item">
            <label>背景音乐音量：</label>
            <input type="range" id="bg-volume" min="0" max="100" value="50">
        </div>
        <div class="settings-item">
            <label>提示音效音量：</label>
            <input type="range" id="alert-volume" min="0" max="100" value="70">
        </div>
        <div class="settings-item">
            <label>自动播放音乐：</label>
            <input type="checkbox" id="auto-play-music" checked>
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
        }, 300);
    };

    dialog.querySelector('#settings-save').onclick = () => {
        // 保存音乐设置的逻辑（待实现）
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
        const key = e.key.toLowerCase();
        
        switch (key) {
            case 'c':
                // 按C复制
                copyBtn.click();
                break;
                
            case 'r':
                // 按R进入编辑模式
                if (displayMode.style.display !== 'none') {
                    editModeBtn.click();
                }
                break;
                
            case 'escape':
                // ESC关闭对话框或返回显示模式
                if (editMode.style.display !== 'none') {
                    cancelEditBtn.click();
                } else {
                    cancelBtn.click();
                }
                break;
                
            case 'enter':
                // Enter保存编辑或在显示模式下复制
                if (editMode.style.display !== 'none') {
                    saveBtn.click();
                } else {
                    copyBtn.click();
                }
                break;
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

// 显示点歌对话框
function showSongRequestDialog() {
    // 设置对话框显示状态为true
    window.danmu.isShowingDialog = true;
    
    const overlay = document.createElement('div');
    overlay.className = 'acps-dialog-overlay';
    document.body.appendChild(overlay);

    const dialog = document.createElement('div');
    dialog.className = 'acps-dialog';
    dialog.innerHTML = `
        <h3>点歌</h3>
        <p class="dialog-tip">输入歌曲名称或歌手名称进行搜索</p>
        <input type="text" id="song-search-input" placeholder="输入歌曲名称">
        <div class="settings-actions">
            <button id="song-search-btn">搜索</button>
            <button id="song-cancel-btn">取消</button>
        </div>
    `;

    // 添加延时以触发动画
    requestAnimationFrame(() => {
        overlay.classList.add('show');
        dialog.classList.add('show');
    });

    const searchButton = dialog.querySelector('#song-search-btn');
    const cancelButton = dialog.querySelector('#song-cancel-btn');
    const searchInput = dialog.querySelector('#song-search-input');

    // 添加键盘事件监听
    const handleKeydown = (e) => {
        if (e.key === 'Enter') {
            searchButton.click();
        } else if (e.key === 'Escape') {
            cancelButton.click();
        }
    };
    document.addEventListener('keydown', handleKeydown);

    // 搜索按钮点击事件
    searchButton.onclick = () => {
        const songName = searchInput.value.trim();
        if (songName) {
            // 发送搜索请求到服务器
            window.socket.emit('search_song', { keyword: songName });
            closeDialog();
        } else {
            alert('请输入歌曲名称');
        }
    };

    // 取消按钮点击事件
    cancelButton.onclick = () => {
        closeDialog();
    };

    // 关闭对话框函数
    const closeDialog = () => {
        document.removeEventListener('keydown', handleKeydown);
        overlay.classList.remove('show');
        dialog.classList.remove('show');
        setTimeout(() => {
            overlay.remove();
            dialog.remove();
            // 设置对话框显示状态为false
            window.danmu.isShowingDialog = false;
        }, 300);
    };

    // 自动聚焦到输入框
    setTimeout(() => {
        searchInput.focus();
    }, 100);

    document.body.appendChild(dialog);
}

/**
 * 显示歌曲搜索结果对话框
 * @param {Array} songs 歌曲搜索结果列表
 */
function showSongSearchResults(songs) {
    if (!songs || songs.length === 0) {
        alert('没有找到相关歌曲');
        return;
    }
    
    // 设置对话框显示状态为true
    window.danmu.isShowingDialog = true;
    
    const overlay = document.createElement('div');
    overlay.className = 'acps-dialog-overlay';
    document.body.appendChild(overlay);

    const dialog = document.createElement('div');
    dialog.className = 'song-search-dialog';
    
    // 创建倒计时元素
    const countdownTime = 20; // 20秒倒计时
    let remainingTime = countdownTime;
    
    let dialogContent = `
        <div class="song-search-header">
            <h3>选择要播放的歌曲</h3>
            <div class="song-countdown" id="song-countdown">${remainingTime}秒后自动播放第一首</div>
        </div>
        <div class="song-list">
    `;
    
    // 添加歌曲列表
    songs.forEach((song, index) => {
        const isVip = song.vip ? '<span class="song-vip">VIP</span>' : '';
        dialogContent += `
            <div class="song-item" data-index="${index}">
                <div class="song-cover">
                    <img src="${song.cover || 'default-cover.jpg'}" alt="${song.name}">
                </div>
                <div class="song-info">
                    <div class="song-name">${song.name} ${isVip}</div>
                    <div class="song-artist">${song.artist} - ${song.platform}</div>
                </div>
            </div>
        `;
    });
    
    dialogContent += `
        </div>
        <button id="song-search-cancel">取消</button>
    `;
    
    dialog.innerHTML = dialogContent;
    document.body.appendChild(dialog);
    
    // 添加延时以触发动画
    requestAnimationFrame(() => {
        overlay.classList.add('show');
        dialog.classList.add('show');
    });
    
    // 设置倒计时
    let countdownInterval = setInterval(() => {
        remainingTime--;
        const countdownElement = document.getElementById('song-countdown');
        if (countdownElement) {
            countdownElement.textContent = `${remainingTime}秒后自动播放第一首`;
        }
        
        if (remainingTime <= 0) {
            clearInterval(countdownInterval);
            // 自动播放第一首歌
            playSelectedSong(songs[0]);
            closeDialog();
        }
    }, 1000);
    
    // 点击歌曲项播放歌曲
    const songItems = dialog.querySelectorAll('.song-item');
    songItems.forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            playSelectedSong(songs[index]);
            closeDialog();
        });
    });
    
    // 取消按钮
    const cancelButton = dialog.querySelector('#song-search-cancel');
    cancelButton.addEventListener('click', () => {
        closeDialog();
    });
    
    // 关闭对话框函数
    function closeDialog() {
        clearInterval(countdownInterval);
        overlay.classList.remove('show');
        dialog.classList.remove('show');
        setTimeout(() => {
            overlay.remove();
            dialog.remove();
            // 设置对话框显示状态为false
            window.danmu.isShowingDialog = false;
        }, 300);
    }
    
    // 播放选中的歌曲
    function playSelectedSong(song) {
        console.log('播放选中的歌曲:', song);
        
        // 检查歌曲对象是否包含必要的id和platform属性
        if (!song || !song.id || !song.platform) {
            console.error('歌曲信息不完整，无法播放', song);
            alert('歌曲信息不完整，无法播放');
            return;
        }
        
        // 保存当前选中的歌曲信息到全局变量，以便在收到服务器响应前显示
        window.player.currentSelectedSong = {
            id: song.id,
            platform: song.platform,
            name: song.name || '加载中...',
            artist: song.artist || '未知歌手',
            album: song.album || '',
            cover: song.cover || null,
            duration: song.duration || 0,
            // url和歌词将由服务器返回
            url: null,
            lrc: null
        };
        
        // 立即显示歌曲信息，但不播放
        window.player.showSongInfo(window.player.currentSelectedSong);
        
        // 发送选中的歌曲到服务器
        window.socket.emit('play_selected_song', { 
            songId: song.id, 
            platform: song.platform 
        });
        
        // 记录日志
        console.log(`发送播放请求: ID=${song.id}, 平台=${song.platform}, 歌曲=${song.name}`);
    }
}

// 显示定时器组件
function showTimer() {
    console.log('尝试显示定时器组件');
    
    // 检查是否已经存在定时器容器和角标
    const existingContainer = document.getElementById('timer-container');
    const existingBadge = document.getElementById('timer-badge');
    
    if (existingContainer || existingBadge) {
        console.log('定时器组件或角标已存在，让权限系统管理显隐状态');
        
        // 通过调用权限系统来正确显示或隐藏元素
        if (window.permissions && typeof window.permissions.manageTimerVisibility === 'function') {
            window.permissions.manageTimerVisibility();
        }
        return;
    }
    
    // 初始化定时器模块
    if (window.timerModule && typeof window.timerModule.init === 'function') {
        window.timerModule.init();
        
        // 获取定时器实例
        const timerInstance = window.timerModule.getTimer();
        if (timerInstance) {
            // 创建定时器UI组件
            timerInstance.createTimerUI();
            
            // 确保角标始终创建
            timerInstance.createBadge();
            
            console.log('定时器组件和角标已创建');
            
            // 创建后通过权限系统管理显隐状态
            if (window.permissions && typeof window.permissions.manageTimerVisibility === 'function') {
                window.permissions.manageTimerVisibility();
            }
        } else {
            console.error('无法获取定时器实例');
        }
    } else {
        console.error('定时器模块未加载或初始化方法不可用');
    }
}

// 检查权限并显示定时器
function checkPermissions() {
    // 使用权限系统管理定时器显示
    if (window.permissions && typeof window.permissions.manageTimerVisibility === 'function') {
        window.permissions.manageTimerVisibility();
    }
}

// 初始化UI事件
function initUIEvents() {
    console.log('初始化UI事件');
    
    // 检查权限并显示定时器
    checkPermissions();
    
    // 初始化设置按钮
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            if (window.utils.checkAuthenticatedPermission()) {
                showSettingsDialog();
            }
        });
    }

    // 添加弹幕按钮点击事件
    document.getElementById('add-danmu-btn').onclick = () => {
        showAddDanmuDialog();
    };

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
}

// 导出UI模块
window.ui = {
    showAddDanmuDialog,
    showSettingsDialog,
    showShortcutSettings,
    showUISettings,
    showQueueSettings,
    showMusicSettings,
    showAccountPasswordDialog,
    showSongSearchResults,
    showSongRequestDialog,
    showTimer,
    initUIEvents,
    checkPermissions
}; 