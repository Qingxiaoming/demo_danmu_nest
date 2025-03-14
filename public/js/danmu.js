/**
 * 弹幕模块
 * 处理弹幕的显示、渲染和交互
 * 
 * @module danmu
 */

// 弹幕模块的所有方法定义
const danmuModule = {
    // 状态管理
    currentDanmuData: null,
    currentSelectedDanmuItem: null,
    isShowingDialog: false,
    showNonWaiting: false, // 默认只显示等待状态

    // 渲染弹幕列表
    renderDanmu(data) {
        const danmuContainer = document.getElementById('danmu-container');
        
        // 如果没有传入数据，使用最新保存的数据
        if (!data) {
            data = this.currentDanmuData;
        }
        // 如果没有数据可用，直接返回
        if (!data || !data.uid) return;
        
        // 根据用户角色控制右下角按钮的显示/隐藏
        window.auth.updateUIByRole();
        
        // 保存当前选中项的信息
        let selectedUid = null;
        if (this.currentSelectedDanmuItem) {
            // 获取当前选中项的uid属性
            selectedUid = this.currentSelectedDanmuItem.getAttribute('data-uid');
            // 如果没有uid属性，尝试通过索引获取
            if (!selectedUid) {
                const items = Array.from(document.querySelectorAll('.danmu-item'));
                const selectedIndex = items.indexOf(this.currentSelectedDanmuItem);
                if (selectedIndex !== -1 && selectedIndex < data.uid.length) {
                    selectedUid = data.uid[selectedIndex];
                }
            }
        }
        
        danmuContainer.innerHTML = ''; // 清空现有内容
        data.uid.forEach((uid, index) => {
            if (!this.showNonWaiting && data.status[index] !== 'waiting') {
                return; // 如果隐藏非等待状态且当前状态不是 'waiting'，则跳过
            }
            // 如果状态为notdisplay，跳过该项不显示
            if (data.status[index] === 'notdisplay') {
                return;
            }
            const item = document.createElement('div');
            item.className = 'danmu-item';
            // 添加点击事件处理
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleDanmuItemSelection(item);
            });
            // 修改tabIndex以支持Tab键导航
            item.tabIndex = 0;
            // 优化Tab键导航
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    this.handleTabNavigation(item, e);
                } else if (window.userRole === 'owner' && (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4')) {
                    switch(e.key) {
                        case '1':
                            window.socket.emit('delete', { index: uid });
                            break;
                        case '2':
                            window.socket.emit('completed', { index: uid });
                            break;
                        case '3':
                            const newText = prompt('请输入新的弹幕内容:', data.text[index]);
                            if (newText) {
                                window.socket.emit('edit', { index: uid, text: newText });
                            }
                            break;
                        case '4':
                            window.socket.emit('get_acps', { index: uid });
                            break;
                    }
                }
            });

            // 添加焦点事件处理
            item.addEventListener('focus', () => {
                this.handleDanmuItemSelection(item);
            });
            
            // 存储uid属性，用于后续恢复选中状态
            item.setAttribute('data-uid', uid);

            // 昵称
            const nickname = document.createElement('span');
            nickname.textContent = `${data.nickname[index]}: `;
            nickname.className = 'nickname';

            // 弹幕内容
            const text = document.createElement('span');
            text.textContent = `${data.text[index]}`;
            text.className = 'text';

            // 状态
            const status = document.createElement('span');
            status.textContent = `      ${data.status[index]}`;
            status.className = 'status';

            // 创建时间
            const createtime = document.createElement('span');
            createtime.textContent = `----${data.createtime[index].slice(5, 16)}`;
            createtime.className = 'createtime';

            // 只有认证用户才能看到操作按钮
            if (window.userRole === 'owner') {
                const actions = document.createElement('div');
                actions.className = 'actions';

                // 删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '删除';
                deleteBtn.onclick = () => {
                    window.socket.emit('delete', {
                        index: uid 
                    });
                };

                // 编辑按钮
                const editBtn = document.createElement('button');
                editBtn.textContent = '编辑';
                editBtn.onclick = () => {
                    const newText = prompt('请输入新的弹幕内容:', data.text[index]);
                    if (newText) {
                        window.socket.emit('edit', {
                            index: uid, 
                            text: newText
                        });
                    }
                };

                // 完成按钮
                const completedBtn = document.createElement('button');
                completedBtn.textContent = '完成';
                completedBtn.onclick = () => {
                    window.socket.emit('completed', {
                        index: uid 
                    });
                };
                // 账密按钮
                const ac_ps_Btn = document.createElement('button');
                ac_ps_Btn.textContent = '账密';
                ac_ps_Btn.onclick = () => {
                    window.socket.emit('get_acps', {
                        index: uid
                    });
                };
                
                actions.appendChild(deleteBtn);
                actions.appendChild(completedBtn);
                actions.appendChild(editBtn);
                actions.appendChild(ac_ps_Btn);
                item.appendChild(actions);
            }

            item.appendChild(nickname);
            item.appendChild(text);
            item.appendChild(status);
            item.appendChild(createtime);

            danmuContainer.appendChild(item);
            
            // 如果这个项目是之前选中的项目，恢复选中状态
            if (selectedUid && uid === selectedUid) {
                this.currentSelectedDanmuItem = item;
                item.classList.add('selected');
                // 使用setTimeout确保DOM完全渲染后再设置焦点
                setTimeout(() => {
                    item.focus();
                }, 0);
            }
        });
        
        // 如果渲染后没有找到之前选中的项目（可能因为过滤或其他原因），但有其他项目可选
        if (selectedUid && !this.currentSelectedDanmuItem && danmuContainer.children.length > 0) {
            // 选择第一个可见的项目
            const firstItem = danmuContainer.children[0];
            this.currentSelectedDanmuItem = firstItem;
            firstItem.classList.add('selected');
            setTimeout(() => {
                firstItem.focus();
            }, 0);
        }
    },

    // 处理弹幕项选择的通用函数
    handleDanmuItemSelection(item) {
        if (this.currentSelectedDanmuItem && (this.currentSelectedDanmuItem !== item)) {
            this.currentSelectedDanmuItem.classList.remove('selected');
        }
        item.classList.add('selected');
        item.focus();
        this.currentSelectedDanmuItem = item;
    },

    // 处理Tab键导航的通用函数
    handleTabNavigation(item, e) {
        e.preventDefault();
        const items = Array.from(document.querySelectorAll('.danmu-item'));
        const currentIndex = items.indexOf(item);
        let nextIndex;
        if (e.shiftKey) {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        } else {
            nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        }
        const nextItem = items[nextIndex];
        if (nextItem) {
            this.handleDanmuItemSelection(nextItem);
        }
    },

    // 切换显示状态并更新眼睛图标
    toggleVisibility() {
        // 切换显示/隐藏状态
        this.showNonWaiting = !this.showNonWaiting;
        console.log('Toggle visibility:', this.showNonWaiting); // 调试日志
        
        // 更新眼睛图标
        const toggleBtn = document.getElementById('toggle-btn');
        if (!toggleBtn) {
            console.warn('Toggle button not found, skipping icon update');
            return;
        }
        
        // 创建新的图标元素
        const icon = document.createElement('i');
        icon.className = this.showNonWaiting ? 'fas fa-eye' : 'fas fa-eye-slash';
        toggleBtn.innerHTML = '';
        toggleBtn.appendChild(icon);
        toggleBtn.title = this.showNonWaiting ? 
            '当前显示全部状态，点击仅显示等待状态' : 
            '当前仅显示等待状态，点击显示全部状态';
        
        // 控制认证相关元素的显示/隐藏
        const authElements = document.querySelectorAll('.auth-element');
        console.log('找到auth-element元素数量:', authElements.length);
        
        // 处理auth-container
        const authContainer = document.querySelector('.auth-container');
        if (authContainer) {
            authContainer.style.display = this.showNonWaiting ? 'block' : 'none';
            console.log('设置auth-container显示状态:', this.showNonWaiting ? 'block' : 'none');
        }
        
        // 处理所有auth-element元素
        authElements.forEach(element => {
            if (this.showNonWaiting) {
                // 在睁眼状态下，根据用户角色显示元素
                if (element.id === 'logout-btn') {
                    // 退出按钮只在已认证状态下显示
                    element.style.display = window.userRole === 'owner' ? 'inline-block' : 'none';
                } else if (element.id === 'add-danmu-btn') {
                    // 添加弹幕按钮在登录状态下始终显示
                    element.style.display = window.userRole === 'owner' ? 'flex' : 'none';
                } else if (element.id === 'settings-btn') {
                    // 设置按钮只在睁眼状态下显示
                    element.style.display = window.userRole === 'owner' ? 'flex' : 'none';
                } else if (element.classList.contains('login-container')) {
                    // 登录容器显示
                    element.style.display = 'block';
                } else {
                    // 其他认证元素正常显示
                    element.style.display = 'block';
                }
            } else {
                // 在闭眼状态下隐藏所有认证元素，但保留添加弹幕按钮
                if (element.id === 'add-danmu-btn' && window.userRole === 'owner') {
                    // 如果是添加弹幕按钮且用户已登录，保持显示
                    element.style.display = 'flex';
                } else {
                    // 其他认证元素隐藏
                    element.style.display = 'none';
                }
                console.log('处理元素:', element.id || element.className);
            }
        });
        
        // 确保按钮容器始终可见
        const btnContainer = document.querySelector('.add-danmu-btn-container');
        if (btnContainer) {
            btnContainer.style.display = 'flex';
        }
        
        // 重新渲染弹幕
        this.renderDanmu();
    },

    // 初始化弹幕模块
    initDanmu() {
        // 初始化显示状态
        this.showNonWaiting = false;
        
        // 初始化时隐藏认证相关元素，但保留添加弹幕按钮
        const authContainer = document.querySelector('.auth-container');
        if (authContainer) {
            authContainer.style.display = 'none';
        }
        
        const authElements = document.querySelectorAll('.auth-element');
        authElements.forEach(element => {
            if (element.id === 'add-danmu-btn' && window.userRole === 'owner') {
                // 如果是添加弹幕按钮且用户已登录，保持显示
                element.style.display = 'flex';
            } else {
                // 其他认证元素隐藏
                element.style.display = 'none';
            }
        });
        
        // 等待DOM加载完成
        const initToggleButton = () => {
            const toggleBtn = document.getElementById('toggle-btn');
            if (!toggleBtn) {
                console.warn('Toggle button not found during initialization, retrying in 100ms');
                setTimeout(initToggleButton, 100);
                return;
            }
            
            // 创建新的图标元素
            const createEyeIcon = (isOpen) => {
                const icon = document.createElement('i');
                icon.className = isOpen ? 'fas fa-eye' : 'fas fa-eye-slash';
                return icon;
            };
            
            // 初始化图标
            toggleBtn.innerHTML = ''; // 清空按钮内容
            toggleBtn.appendChild(createEyeIcon(false));
            toggleBtn.title = '当前仅显示等待状态，点击显示全部状态';
            
            // 确保按钮容器可见
            const btnContainer = document.querySelector('.add-danmu-btn-container');
            if (btnContainer) {
                btnContainer.style.display = 'flex';
            }
            
            // 绑定切换按钮点击事件
            toggleBtn.onclick = () => this.toggleVisibility();
            
            console.log('Toggle button initialized successfully with icon:', this.showNonWaiting ? 'eye' : 'eye-slash');
        };
        
        // 开始初始化按钮
        initToggleButton();
        
        // 添加点击列表外失焦的逻辑
        document.addEventListener('click', (e) => {
            // 检查点击是否发生在弹幕项目外部
            if (this.currentSelectedDanmuItem && 
                !e.target.closest('.danmu-item') && 
                !e.target.closest('.acps-dialog') && 
                !e.target.closest('.acps-dialog-overlay')) {
                // 如果点击在弹幕项目外部且不在对话框内，取消选中状态
                this.currentSelectedDanmuItem.classList.remove('selected');
                this.currentSelectedDanmuItem.blur();
                this.currentSelectedDanmuItem = null;
            }
        });
    }
};

// 导出弹幕模块
window.danmu = danmuModule; 