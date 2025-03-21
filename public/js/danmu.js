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
    sortByTimeAsc: true, // 默认按时间升序排列

    // 辅助函数：将各种格式的时间字符串转换为Date对象
    parseTimeString(timeStr) {
        // 处理null、undefined或空字符串的情况
        if (!timeStr || typeof timeStr !== 'string') {
            console.warn('无效的时间字符串:', timeStr);
            return new Date(); // 返回当前时间作为默认值
        }
        
        try {
            // 尝试直接转换
            const date = new Date(timeStr);
            if (!isNaN(date.getTime())) {
                return date;
            }
            
            // 如果直接转换失败，尝试解析几种常见格式
            // 格式1: "YYYY-MM-DD HH:MM:SS"
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timeStr)) {
                const [datePart, timePart] = timeStr.split(' ');
                const [year, month, day] = datePart.split('-').map(Number);
                const [hour, minute, second] = timePart.split(':').map(Number);
                return new Date(year, month - 1, day, hour, minute, second);
            }
            
            // 格式2: "MM-DD HH:MM"
            if (/^\d{2}-\d{2} \d{2}:\d{2}$/.test(timeStr)) {
                const currentYear = new Date().getFullYear();
                const [datePart, timePart] = timeStr.split(' ');
                const [month, day] = datePart.split('-').map(Number);
                const [hour, minute] = timePart.split(':').map(Number);
                return new Date(currentYear, month - 1, day, hour, minute);
            }
            
            // 格式3: "MM-DD"
            if (/^\d{2}-\d{2}$/.test(timeStr)) {
                const currentYear = new Date().getFullYear();
                const [month, day] = timeStr.split('-').map(Number);
                return new Date(currentYear, month - 1, day);
            }
            
            // 如果所有格式都不匹配，返回当前时间
            console.warn(`无法解析的时间格式: ${timeStr}，使用当前时间代替`);
            return new Date();
        } catch (error) {
            console.error(`解析时间字符串出错: ${timeStr}`, error);
            return new Date(); // 返回当前时间作为后备
        }
    },

    // 渲染弹幕列表
    renderDanmu(data) {
        const danmuContainer = document.getElementById('danmu-container');
        
        // 如果没有传入数据，使用最新保存的数据
        if (!data) {
            data = this.currentDanmuData;
        }
        
        // 验证数据结构的完整性
        if (!data || !data.uid || !Array.isArray(data.uid) || data.uid.length === 0) {
            console.warn('无效的弹幕数据结构:', data);
            danmuContainer.innerHTML = '<div class="no-data-message">暂无数据</div>';
            return;
        }
        
        // 确保所有必要的数组都存在且长度相同
        const arraysValid = ['uid', 'status', 'nickname', 'text', 'createtime'].every(field => 
            Array.isArray(data[field]) && data[field].length === data.uid.length
        );
        
        if (!arraysValid) {
            console.error('弹幕数据结构不完整:', data);
            danmuContainer.innerHTML = '<div class="no-data-message">数据结构异常</div>';
            return;
        }
        
        // 如果没有数据可用，直接返回
        if (!data || !data.uid) return;
        
        // 根据用户角色控制右下角按钮的显示/隐藏
        window.auth.updateUIByRole();
        
        // 确保在弹幕渲染时更新UI元素状态
        window.permissions.updateUIVisibility(window.userRole === 'owner', this.showNonWaiting);
        
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
        
        // 通用的弹幕操作处理函数
        const handleDanmuAction = (action, uid, text) => {
            switch(action) {
                case 'delete':
                    window.socket.emit('delete', { index: uid });
                    break;
                case 'completed':
                    window.socket.emit('completed', { index: uid });
                    break;
                case 'edit':
                    const newText = prompt('请输入新的弹幕内容:', text);
                    if (newText) {
                        window.socket.emit('edit', { index: uid, text: newText });
                    }
                    break;
                case 'get_acps':
                    window.socket.emit('get_acps', { index: uid });
                    break;
                default:
                    break;
            }
        };
        
        danmuContainer.innerHTML = ''; // 清空现有内容

        // 创建可排序的数组
        const items = [];
        data.uid.forEach((uid, index) => {
            // 使用权限系统判断该状态是否应该显示
            if (window.permissions && !window.permissions.shouldShowDanmuStatus(data.status[index], this.showNonWaiting)) {
                return; // 如果权限系统表示该状态不应该显示，则跳过
            } else if (!window.permissions && !this.showNonWaiting && data.status[index] !== 'waiting') {
                return; // 如果权限系统未加载，使用传统逻辑
            }

            // 如果状态为notdisplay，跳过该项不显示
            if (data.status[index] === 'notdisplay') {
                return;
            }
            
            // 使用辅助函数解析时间
            let createTime = this.parseTimeString(data.createtime[index]);
            
            items.push({
                uid: uid,
                index: index,
                createTime: createTime,
                createTimeString: data.createtime[index] // 保存原始时间字符串，以便调试
            });
        });
        
        // 如果没有有效条目可显示，记录警告
        if (items.length === 0) {
            console.warn('没有符合条件的弹幕可以显示', {
                showNonWaiting: this.showNonWaiting,
                dataSize: data.uid ? data.uid.length : 0
            });
        }
        
        // 调试日志，查看排序之前的数组
        console.log('排序前的弹幕条目:', items.length, '个');
        
        try {
            // 根据创建时间排序
            items.sort((a, b) => {
                // 确保对象有效
                if (!a || !b) return 0;
                
                // 确保createTime属性存在且有效
                const timeA = a.createTime instanceof Date && !isNaN(a.createTime.getTime()) 
                    ? a.createTime.getTime() 
                    : 0;
                const timeB = b.createTime instanceof Date && !isNaN(b.createTime.getTime()) 
                    ? b.createTime.getTime() 
                    : 0;
                
                // 如果时间相同或无效，使用index作为次要排序条件，保持稳定顺序
                if (timeA === timeB) {
                    return this.sortByTimeAsc ? (a.index - b.index) : (b.index - a.index);
                }
                
                // 根据排序方向返回比较结果
                return this.sortByTimeAsc ? (timeA - timeB) : (timeB - timeA);
            });
            
            // 调试日志，查看排序之后的数组
            console.log('排序后的弹幕条目:', items.length, '个, 排序方式:', this.sortByTimeAsc ? '升序' : '降序');
        } catch (error) {
            console.error('排序过程中发生错误:', error);
            console.log('保持原有顺序显示');
        }
        
        // 根据排序后的数组渲染弹幕
        items.forEach(item => {
            // 数据校验，确保item和必要的属性存在
            if (!item || typeof item.index !== 'number' || !item.uid) {
                console.warn('跳过无效的弹幕项:', item);
                return; // 跳过无效项
            }
            
            const uid = item.uid;
            const index = item.index;
            
            // 确保index在有效范围内
            if (index < 0 || index >= data.uid.length) {
                console.warn(`跳过索引越界的弹幕项: index=${index}, uid=${uid}, max=${data.uid.length-1}`);
                return;
            }
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'danmu-item';
            // 添加点击事件处理
            itemDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleDanmuItemSelection(itemDiv);
            });
            // 修改tabIndex以支持Tab键导航
            itemDiv.tabIndex = 0;
            // 优化Tab键导航
            itemDiv.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    this.handleTabNavigation(itemDiv, e);
                } else if (window.userRole === 'owner') {
                    // 获取快捷键设置
                    const shortcutSettings = window.utils.loadShortcutSettings();
                    
                    // 创建当前按下的快捷键组合字符串
                    const pressedKeys = [];
                    if (e.ctrlKey) pressedKeys.push('Ctrl');
                    if (e.shiftKey) pressedKeys.push('Shift');
                    if (e.altKey) pressedKeys.push('Alt');
                    if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
                        pressedKeys.push(e.key.toUpperCase());
                    }
                    const pressedKeyString = pressedKeys.join('+');
                    
                    // 检查是否匹配配置的快捷键
                    if (shortcutSettings.delete && pressedKeyString === shortcutSettings.delete) {
                        handleDanmuAction('delete', uid);
                    } else if (shortcutSettings.complete && pressedKeyString === shortcutSettings.complete) {
                        handleDanmuAction('completed', uid);
                    } else if (shortcutSettings.edit && pressedKeyString === shortcutSettings.edit) {
                        handleDanmuAction('edit', uid, data.text[index]);
                    } else if (shortcutSettings.acps && pressedKeyString === shortcutSettings.acps) {
                        handleDanmuAction('get_acps', uid);
                    }
                }
            });

            // 添加焦点事件处理
            itemDiv.addEventListener('focus', () => {
                this.handleDanmuItemSelection(itemDiv);
            });
            
            // 存储uid属性，用于后续恢复选中状态
            itemDiv.setAttribute('data-uid', uid);

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
            // 添加安全检查，确保data.createtime[index]存在并且可以进行slice操作
            const timeStr = data.createtime[index];
            if (timeStr && typeof timeStr === 'string' && timeStr.length >= 16) {
                createtime.textContent = `----${timeStr.slice(5, 16)}`;
            } else {
                // 如果时间字符串异常，提供一个默认值
                createtime.textContent = `----未知时间`;
                console.warn('时间格式异常:', timeStr);
            }
            createtime.className = 'createtime';

            // 只有认证用户才能看到操作按钮
            if (window.userRole === 'owner') {
                const actions = document.createElement('div');
                actions.className = 'actions';

                // 删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '删除';
                deleteBtn.onclick = () => handleDanmuAction('delete', uid);

                // 编辑按钮
                const editBtn = document.createElement('button');
                editBtn.textContent = '编辑';
                editBtn.onclick = () => handleDanmuAction('edit', uid, data.text[index]);

                // 完成按钮
                const completedBtn = document.createElement('button');
                completedBtn.textContent = '完成';
                completedBtn.onclick = () => handleDanmuAction('completed', uid);
                
                // 账密按钮
                const ac_ps_Btn = document.createElement('button');
                ac_ps_Btn.textContent = '账密';
                ac_ps_Btn.onclick = () => handleDanmuAction('get_acps', uid);
                
                actions.appendChild(deleteBtn);
                actions.appendChild(completedBtn);
                actions.appendChild(editBtn);
                actions.appendChild(ac_ps_Btn);
                itemDiv.appendChild(actions);
            }

            itemDiv.appendChild(nickname);
            itemDiv.appendChild(text);
            itemDiv.appendChild(status);
            itemDiv.appendChild(createtime);

            danmuContainer.appendChild(itemDiv);
            
            // 如果这个项目是之前选中的项目，恢复选中状态
            if (selectedUid && uid === selectedUid) {
                this.currentSelectedDanmuItem = itemDiv;
                itemDiv.classList.add('selected');
                // 使用setTimeout确保DOM完全渲染后再设置焦点
                setTimeout(() => {
                    itemDiv.focus();
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
        
        // 更新排序按钮图标
        this.updateSortButtonIcon();
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

    // 切换显示全部/仅等待状态的弹幕
    toggleVisibility() {
        // 切换状态
        this.showNonWaiting = !this.showNonWaiting;
        console.log(`切换眼睛状态为: ${this.showNonWaiting ? '睁眼' : '闭眼'}`);
        
        // 修改按钮图标和提示
        const toggleButton = document.getElementById('toggle-btn');
        if (toggleButton) {
            toggleButton.innerHTML = this.showNonWaiting 
                ? '<i class="fas fa-eye"></i>' 
                : '<i class="fas fa-eye-slash"></i>';
            toggleButton.title = this.showNonWaiting ? '当前显示全部状态，点击仅显示等待状态' : '当前仅显示等待状态，点击显示全部状态';
        }

        // 显示排序按钮
        const sortButton = document.getElementById('sort-btn');
        if (sortButton) {
            sortButton.style.display = this.showNonWaiting ? 'inline-block' : 'none';
        }
        
        // 使用权限系统更新基于眼睛状态的UI元素
        if (window.permissions) {
            console.log('使用权限系统更新UI状态，眼睛状态切换为:', this.showNonWaiting ? '睁眼' : '闭眼');
            const isAuthenticated = window.userRole === 'owner';
            window.permissions.updateUIVisibility(isAuthenticated, this.showNonWaiting);
        }
        
        // 重新渲染弹幕列表
        this.renderDanmu(this.currentDanmuData);
    },
    
    // 切换排序方式
    toggleSortOrder() {
        // 记录切换前的状态
        console.log('切换排序方式，当前状态:', {
            sortByTimeAsc: this.sortByTimeAsc,
            showNonWaiting: this.showNonWaiting,
            hasData: this.currentDanmuData ? true : false,
            dataCount: this.currentDanmuData && this.currentDanmuData.uid ? this.currentDanmuData.uid.length : 0
        });
        
        // 切换排序状态
        this.sortByTimeAsc = !this.sortByTimeAsc;
        
        // 更新按钮图标
        this.updateSortButtonIcon();
        
        // 记录切换后的状态
        console.log('排序状态已切换为:', this.sortByTimeAsc ? '升序' : '降序');
        
        // 如果有数据，则重新渲染
        if (this.currentDanmuData && this.currentDanmuData.uid) {
            try {
                this.renderDanmu(this.currentDanmuData);
                console.log('弹幕列表已重新渲染');
            } catch (error) {
                console.error('重新渲染弹幕列表时出错:', error);
                // 尝试恢复原排序状态
                this.sortByTimeAsc = !this.sortByTimeAsc;
                this.updateSortButtonIcon();
                this.renderDanmu(this.currentDanmuData);
            }
        } else {
            console.warn('没有数据可以排序和渲染');
        }
    },
    
    // 更新排序按钮图标
    updateSortButtonIcon() {
        const sortBtn = document.getElementById('sort-btn');
        if (!sortBtn) return;
        
        // 创建新的图标元素
        const icon = document.createElement('i');
        icon.className = this.sortByTimeAsc ? 'fas fa-sort-amount-down-alt' : 'fas fa-sort-amount-down';
        sortBtn.innerHTML = '';
        sortBtn.appendChild(icon);
        
        // 更新按钮提示文本
        sortBtn.title = this.sortByTimeAsc ? '当前按时间升序排列，点击改为降序' : '当前按时间降序排列，点击改为升序';
    },

    // 初始化弹幕模块
    initDanmu() {
        console.log('初始化弹幕模块');
        
        // 初始化弹幕容器点击事件
        const danmuContainer = document.getElementById('danmu-container');
        danmuContainer.addEventListener('click', (e) => {
            if (e.target === danmuContainer) {
                // 点击容器空白处取消选中
                this.currentSelectedDanmuItem = null;
                document.querySelectorAll('.danmu-item').forEach(item => {
                    item.classList.remove('selected');
                });
            }
        });
        
        // 初始化排序按钮
        const initSortButton = () => {
            const sortBtn = document.getElementById('sort-btn');
            if (sortBtn) {
                // 更新排序按钮图标
                this.updateSortButtonIcon();
                
                // 绑定点击事件
                sortBtn.addEventListener('click', () => this.toggleSortOrder());
                
                // 根据权限系统设置初始显示状态
                if (window.permissions) {
                    const isAuthenticated = window.userRole === 'owner'; // 已认证用户（管理员）
                    const shouldShow = window.permissions.shouldShowElement('sort-btn', isAuthenticated, this.showNonWaiting);
                    sortBtn.style.display = shouldShow ? 'flex' : 'none';
                } else {
                    // 如果权限系统未加载，使用传统逻辑
                    sortBtn.style.display = this.showNonWaiting ? 'flex' : 'none';
                }
            }
        };
        // 初始化切换按钮
        const initToggleButton = () => {
            const toggleBtn = document.getElementById('toggle-btn');
            if (toggleBtn) {
                toggleBtn.innerHTML = this.showNonWaiting 
                    ? '<i class="fas fa-eye"></i>' 
                    : '<i class="fas fa-eye-slash"></i>';
                toggleBtn.title = this.showNonWaiting
                    ? '当前显示全部状态，点击只显示等待状态'
                    : '当前仅显示等待状态，点击显示全部状态';
                toggleBtn.addEventListener('click', () => this.toggleVisibility());
            }
        };
        // 初始化添加弹幕按钮
        const initAddButton = () => {
            const addBtn = document.getElementById('add-danmu-btn');
            if (addBtn) {
                addBtn.addEventListener('click', () => window.ui.showAddDanmuDialog());
            }
        };
        
        // 显示弹幕操作按钮容器
            const btnContainer = document.querySelector('.add-danmu-btn-container');
            if (btnContainer) {
                btnContainer.style.display = 'flex';
            }
            
        // 初始化所有按钮
        initSortButton();
        initToggleButton();
        initAddButton();
        
        // 使用权限系统更新初始UI状态
        window.auth.updateUIByRole();
    }
};

// 将弹幕模块挂载到全局变量
window.danmu = danmuModule; 