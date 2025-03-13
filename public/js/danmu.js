/**
 * 弹幕模块
 * 处理弹幕的显示、渲染和交互
 */

// 全局变量
window.danmu = {
    currentDanmuData: null, // 全局变量存储最新的弹幕数据
    currentSelectedDanmuItem: null, // 全局变量，用于追踪当前选中的弹幕项目
    isShowingDialog: false, // 添加对话框显示状态标志
    showNonWaiting: true, // 默认显示所有状态
};

// 渲染弹幕列表
function renderDanmu(data) {
    const danmuContainer = document.getElementById('danmu-container');
    
    // 如果没有传入数据，使用最新保存的数据
    if (!data) {
        data = window.danmu.currentDanmuData;
    }
    // 如果没有数据可用，直接返回
    if (!data || !data.uid) return;
    
    // 根据用户角色控制右下角按钮的显示/隐藏
    window.auth.updateUIByRole();
    
    // 保存当前选中项的信息
    let selectedUid = null;
    if (window.danmu.currentSelectedDanmuItem) {
        // 获取当前选中项的uid属性
        selectedUid = window.danmu.currentSelectedDanmuItem.getAttribute('data-uid');
        // 如果没有uid属性，尝试通过索引获取
        if (!selectedUid) {
            const items = Array.from(document.querySelectorAll('.danmu-item'));
            const selectedIndex = items.indexOf(window.danmu.currentSelectedDanmuItem);
            if (selectedIndex !== -1 && selectedIndex < data.uid.length) {
                selectedUid = data.uid[selectedIndex];
            }
        }
    }
    
    danmuContainer.innerHTML = ''; // 清空现有内容
    data.uid.forEach((uid, index) => {
        if (!window.danmu.showNonWaiting && data.status[index] !== 'waiting') {
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
            handleDanmuItemSelection(item);
        });
        // 修改tabIndex以支持Tab键导航
        item.tabIndex = 0;
        // 优化Tab键导航
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                handleTabNavigation(item, e);
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
            handleDanmuItemSelection(item);
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
                // 然后发送WebSocket事件获取数据
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
            window.danmu.currentSelectedDanmuItem = item;
            item.classList.add('selected');
            // 使用setTimeout确保DOM完全渲染后再设置焦点
            setTimeout(() => {
                item.focus();
            }, 0);
        }
    });
    
    // 如果渲染后没有找到之前选中的项目（可能因为过滤或其他原因），但有其他项目可选
    if (selectedUid && !window.danmu.currentSelectedDanmuItem && danmuContainer.children.length > 0) {
        // 选择第一个可见的项目
        const firstItem = danmuContainer.children[0];
        window.danmu.currentSelectedDanmuItem = firstItem;
        firstItem.classList.add('selected');
        setTimeout(() => {
            firstItem.focus();
        }, 0);
    }
}

// 处理弹幕项选择的通用函数
function handleDanmuItemSelection(item) {
    if (window.danmu.currentSelectedDanmuItem && (window.danmu.currentSelectedDanmuItem !== item)) {
        window.danmu.currentSelectedDanmuItem.classList.remove('selected');
    }
    item.classList.add('selected');
    item.focus();
    window.danmu.currentSelectedDanmuItem = item;
}

// 处理Tab键导航的通用函数
function handleTabNavigation(item, e) {
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
        handleDanmuItemSelection(nextItem);
    }
}

// 切换显示状态并更新眼睛图标
function toggleVisibility() {
    window.danmu.showNonWaiting = !window.danmu.showNonWaiting; // 切换显示/隐藏状态
    
    // 更新眼睛图标
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
    
    renderDanmu(); // 重新渲染弹幕
}

// 初始化弹幕模块
function initDanmu() {
    // 切换列表显示函数
    document.getElementById('toggle-btn').onclick = toggleVisibility;
    
    // 添加点击列表外失焦的逻辑
    document.addEventListener('click', (e) => {
        // 检查点击是否发生在弹幕项目外部
        if (window.danmu.currentSelectedDanmuItem && !e.target.closest('.danmu-item') && !e.target.closest('.acps-dialog') && !e.target.closest('.acps-dialog-overlay')) {
            // 如果点击在弹幕项目外部且不在对话框内，取消选中状态
            window.danmu.currentSelectedDanmuItem.classList.remove('selected');
            window.danmu.currentSelectedDanmuItem.blur();
            window.danmu.currentSelectedDanmuItem = null;
        }
    });
}

// 导出弹幕模块
window.danmu = {
    ...window.danmu,
    renderDanmu,
    handleDanmuItemSelection,
    handleTabNavigation,
    toggleVisibility,
    initDanmu
}; 