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
            // 尝试解析标准格式: "YYYY-MM-DD HH:MM:SS"
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timeStr)) {
                const [datePart, timePart] = timeStr.split(' ');
                const [year, month, day] = datePart.split('-').map(Number);
                const [hour, minute, second] = timePart.split(':').map(Number);
                return new Date(year, month - 1, day, hour, minute, second);
            }
            
            // 尝试常规JS日期解析（后备方案）
            const date = new Date(timeStr);
            if (!isNaN(date.getTime())) {
                return date;
            }
            
            // 如果所有格式都不匹配，返回当前时间
            console.warn(`无法解析的时间格式: ${timeStr}，使用当前时间代替`);
            return new Date();
        } catch (error) {
            console.error(`解析时间字符串出错: ${timeStr}`, error);
            return new Date(); // 返回当前时间作为后备
        }
    },

    // 格式化时间为"月-日 时:分"格式
    formatTime(timeStr) {
        if (!timeStr) return '未知时间';
        
        try {
            // 尝试解析yyyy-MM-dd HH:mm:ss格式
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timeStr)) {
                const [datePart, timePart] = timeStr.split(' ');
                const dateComponents = datePart.split('-');
                const timeComponents = timePart.split(':');
                
                // 提取月、日、时、分
                const month = dateComponents[1];
                const day = dateComponents[2];
                const hour = timeComponents[0];
                const minute = timeComponents[1];
                
                return `${month}-${day} ${hour}:${minute}`;
            } else {
                // 尝试解析为日期对象
                const date = new Date(timeStr);
                if (!isNaN(date.getTime())) {
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${month}-${day} ${hours}:${minutes}`;
                }
            }
        } catch (error) {
            console.error('格式化时间出错:', error);
        }
        
        return '未知时间';
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
        
        // 检查pendingTime数组，如果不存在则初始化为空数组
        if (!Array.isArray(data.pendingTime) || data.pendingTime.length !== data.uid.length) {
            console.warn('pendingTime数组不完整，将初始化为空数组');
            data.pendingTime = new Array(data.uid.length).fill(null);
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
                case 'pending':
                    window.socket.emit('pending', { index: uid });
                    break;
                case 'resume':
                    window.socket.emit('resume', { index: uid });
                    break;
                case 'working':
                    window.socket.emit('working', { index: uid });
                    break;
                case 'pause':
                    window.socket.emit('pause', { index: uid });
                    break;
                case 'resume_working':
                    window.socket.emit('resume_working', { index: uid });
                    break;
                default:
                    break;
            }
        };
        
        // 使用文档片段，减少DOM重绘次数
        const fragment = document.createDocumentFragment();

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
        } catch (error) {
            console.error('排序过程中发生错误:', error);
            console.log('保持原有顺序显示');
        }
        
        // 使用批量处理减少渲染次数
        let newSelectedItem = null;
        
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
            // 添加data-status属性，方便CSS样式
            itemDiv.setAttribute('data-status', data.status[index]);
            // 添加data-uid属性
            itemDiv.setAttribute('data-uid', uid);
            
            // 设置弹幕内容
            itemDiv.innerHTML = `
                <span class="nickname">${data.nickname[index]}: </span>
                <span class="text">${data.text[index]}</span>
                <span class="status">      ${data.status[index]}</span>
                <span class="createtime">----${this.formatTime(data.createtime[index])}</span>
            `;
            
            // 添加状态时间信息（如果适用）
            if ((data.status[index] === 'pending' || data.status[index] === 'working' || data.status[index] === 'pause') && 
                data.pendingTime && data.pendingTime[index]) {
                try {
                    let timeDisplay = '';
                    
                    // 解析pending时间
                    const pendingDate = this.parseTimeString(data.pendingTime[index]);
                    if (!isNaN(pendingDate.getTime())) {
                        const now = new Date();
                        // 基础时间 = 服务器提供的工作时长
                        const workingDuration = data.workingDuration && data.workingDuration[index] 
                            ? Number(data.workingDuration[index]) 
                            : 0;
                        const baseMinutes = Math.floor(workingDuration / 60);
                        
                        if (data.status[index] === 'pause' && data.pauseTime && data.pauseTime[index]) {
                            // 暂停状态使用动态计时
                            const pauseDate = this.parseTimeString(data.pauseTime[index]);
                            if (!isNaN(pauseDate.getTime())) {
                                const pauseMinutes = Math.floor((now - pauseDate) / (1000 * 60));
                                timeDisplay = ` <span class="status-time pause-time" 
                                                    data-start-time="${pauseDate.getTime()}" 
                                                    data-base-minutes="0">
                                                    (已暂停${pauseMinutes}min)
                                                </span>`;
                            } else {
                                timeDisplay = ` <span class="status-time">(已暂停)</span>`;
                            }
                        } else if (data.status[index] === 'working') {
                            // 工作状态使用动态计时
                            timeDisplay = ` <span class="status-time working-time" 
                                                data-start-time="${pendingDate.getTime()}" 
                                                data-base-minutes="${baseMinutes}">
                                                (已工作${baseMinutes}min)
                                            </span>`;
                        } else if (data.status[index] === 'pending') {
                            // 挂起状态使用动态计时
                            const pendingMinutes = Math.floor((now - pendingDate) / (1000 * 60));
                            timeDisplay = ` <span class="status-time pending-time" 
                                                data-start-time="${pendingDate.getTime()}" 
                                                data-base-minutes="0">
                                                (${pendingMinutes}min)
                                            </span>`;
                        }
                        
                        // 标记此项需要动态更新时间
                        itemDiv.setAttribute('data-needs-time-update', 'true');
                        itemDiv.setAttribute('data-status-type', data.status[index]);
                        
                        // 添加时间信息到状态元素
                        const statusEl = itemDiv.querySelector('.status');
                        if (statusEl) {
                            statusEl.innerHTML += timeDisplay;
                        }
                    }
                } catch (error) {
                    console.error('计算状态时间出错:', error);
                }
            }
            
            // 只有认证用户才能看到操作按钮
            if (window.userRole === 'owner') {
                const actions = document.createElement('div');
                actions.className = 'actions';

                // 挂起/恢复按钮
                const pendingBtn = document.createElement('button');
                if (data.status[index] === 'pending') {
                    pendingBtn.textContent = '恢复';
                    pendingBtn.onclick = (e) => { 
                        e.stopPropagation(); 
                        handleDanmuAction('resume', uid); 
                    };
                } else {
                    pendingBtn.textContent = '挂起';
                    pendingBtn.onclick = (e) => { 
                        e.stopPropagation(); 
                        handleDanmuAction('pending', uid); 
                    };
                }

                // 开始/暂停工作按钮
                const workingBtn = document.createElement('button');
                if (data.status[index] === 'working') {
                    workingBtn.textContent = '暂停';
                    workingBtn.onclick = (e) => { 
                        e.stopPropagation(); 
                        handleDanmuAction('pause', uid); 
                    };
                } else if (data.status[index] === 'pause') {
                    workingBtn.textContent = '恢复';
                    workingBtn.onclick = (e) => { 
                        e.stopPropagation(); 
                        handleDanmuAction('resume_working', uid); 
                    };
                } else {
                    workingBtn.textContent = '开始';
                    workingBtn.onclick = (e) => { 
                        e.stopPropagation(); 
                        handleDanmuAction('working', uid); 
                    };
                }

                // 删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '删除';
                deleteBtn.onclick = (e) => { 
                    e.stopPropagation(); 
                    handleDanmuAction('delete', uid); 
                };

                // 编辑按钮
                const editBtn = document.createElement('button');
                editBtn.textContent = '编辑';
                editBtn.onclick = (e) => { 
                    e.stopPropagation(); 
                    handleDanmuAction('edit', uid, data.text[index]); 
                };

                // 完成按钮
                const completedBtn = document.createElement('button');
                completedBtn.textContent = '完成';
                completedBtn.onclick = (e) => { 
                    e.stopPropagation(); 
                    handleDanmuAction('completed', uid); 
                };
                
                // 账密按钮
                const ac_ps_Btn = document.createElement('button');
                ac_ps_Btn.textContent = '账密';
                ac_ps_Btn.onclick = (e) => { 
                    e.stopPropagation(); 
                    handleDanmuAction('get_acps', uid); 
                };

                actions.appendChild(pendingBtn);
                actions.appendChild(workingBtn);
                actions.appendChild(deleteBtn);
                actions.appendChild(completedBtn);
                actions.appendChild(editBtn);
                actions.appendChild(ac_ps_Btn);
                itemDiv.appendChild(actions);
            }
            
            // 添加点击事件处理
            let clickHandler = (e) => {
                e.stopPropagation();
                this.handleDanmuItemSelection(itemDiv);
            };
            
            // 使用事件委托，减少事件监听器数量
            itemDiv.addEventListener('click', clickHandler, { passive: true });
            
            // 添加Tab键导航和快捷键支持
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

            // 修改tabIndex以支持Tab键导航
            itemDiv.tabIndex = 0;

            // 将弹幕项添加到文档片段
            fragment.appendChild(itemDiv);
            
            // 如果这是之前选中的项，记录下来
            if (uid === selectedUid) {
                newSelectedItem = itemDiv;
            }
        });
                        
        // 清空现有内容并一次性添加所有新元素
        danmuContainer.innerHTML = '';
        danmuContainer.appendChild(fragment);
        
        // 恢复选中状态
        if (newSelectedItem) {
            // 使用requestAnimationFrame确保DOM更新后再选中
            requestAnimationFrame(() => {
                // 只应用CSS类，不进行完整的handleDanmuItemSelection调用，减少不必要的操作
                newSelectedItem.classList.add('selected');
                // 更新引用但不触发其他操作
                this.currentSelectedDanmuItem = newSelectedItem;
            });
        } else if (selectedUid && danmuContainer.children.length > 0) {
            // 如果找不到之前选中的项，尝试从会话存储中恢复
            const savedSelectedUid = sessionStorage.getItem('selected_danmu_uid');
            if (savedSelectedUid) {
                // 查找保存的uid对应的元素
                const savedItem = danmuContainer.querySelector(`[data-uid="${savedSelectedUid}"]`);
                if (savedItem) {
                    requestAnimationFrame(() => {
                        savedItem.classList.add('selected');
                        this.currentSelectedDanmuItem = savedItem;
                    });
                    return;
                }
            }
        
            // 如果没有可恢复的选中项，选择第一个可见项
            const firstItem = danmuContainer.children[0];
            requestAnimationFrame(() => {
                firstItem.classList.add('selected');
            this.currentSelectedDanmuItem = firstItem;
            });
        }
        
        // 更新排序按钮图标
        this.updateSortButtonIcon();
    },

    // 处理弹幕项选择的通用函数
    handleDanmuItemSelection(item) {
        // 检查是否为有效元素
        if (!item || !(item instanceof HTMLElement)) {
            console.warn('尝试选择无效的弹幕项元素');
            return;
        }
        
        // 如果已经选中，不做任何操作
        if (this.currentSelectedDanmuItem === item) {
            return;
        }
        
        // 防止过快重复点击
        if (this._selectionDebounce) {
            return;
        }
        
        // 设置防抖标志，250ms后清除（减少为更好的响应性）
        this._selectionDebounce = true;
        setTimeout(() => {
            this._selectionDebounce = false;
        }, 250);
        
        // 取消之前的选择
        if (this.currentSelectedDanmuItem && (this.currentSelectedDanmuItem !== item)) {
            this.currentSelectedDanmuItem.classList.remove('selected');
        }
        
        // 将DOM操作放在requestAnimationFrame中以避免布局抖动
        requestAnimationFrame(() => {
            // 添加新的选择
        item.classList.add('selected');
            
            // 温和地设置焦点，避免过快的DOM变化
            setTimeout(() => {
                if (document.activeElement !== item) {
                    item.focus({ preventScroll: false });
                }
            }, 30);
        });
        
        // 更新当前选中项引用
        this.currentSelectedDanmuItem = item;
        
        // 存储选中项的uid到会话存储，使其在渲染后能被恢复
        const uid = item.getAttribute('data-uid');
        if (uid) {
            sessionStorage.setItem('selected_danmu_uid', uid);
        }
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
            
            // 特别管理播放器显隐状态
            if (typeof window.permissions.manageMusicPlayerVisibility === 'function') {
                window.permissions.manageMusicPlayerVisibility();
            }
        }
        
        // 触发眼睛状态改变事件，让其他模块可以响应
        const eyeStateEvent = new CustomEvent('eyeStateChanged', {
            detail: { isEyeOpen: this.showNonWaiting }
        });
        document.dispatchEvent(eyeStateEvent);
        
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
        
        // 显示弹幕操作按钮容器
            const btnContainer = document.querySelector('.add-danmu-btn-container');
            if (btnContainer) {
                btnContainer.style.display = 'flex';
            }
            
        // 初始化所有按钮
        initSortButton();
        initToggleButton();
        
        // 启动工作时间更新计时器
        this.startWorkingTimeUpdater();
        
        // 使用权限系统更新初始UI状态
        window.auth.updateUIByRole();
    },

    // 启动工作时间动态更新
    startWorkingTimeUpdater() {
        // 清除可能存在的旧计时器
        if (this._workingTimeUpdateInterval) {
            clearInterval(this._workingTimeUpdateInterval);
        }
        
        // 创建新的计时器，每5秒更新一次工作时间显示
        this._workingTimeUpdateInterval = setInterval(() => {
            this.updateWorkingTimes();
        }, 5000);
    },

    // 更新所有带时间显示的状态
    updateWorkingTimes() {
        // 查找所有需要更新时间的元素
        const itemsWithTime = document.querySelectorAll('.danmu-item[data-needs-time-update="true"]');
        
        if (itemsWithTime.length === 0) return;
        
        const now = Date.now();
        
        itemsWithTime.forEach(item => {
            const statusType = item.getAttribute('data-status-type');
            const timeElement = item.querySelector('.status-time');
            if (!timeElement) return;
            
            try {
                // 获取开始时间和基础分钟数
                const startTime = parseInt(timeElement.getAttribute('data-start-time'), 10);
                const baseMinutes = parseInt(timeElement.getAttribute('data-base-minutes'), 10) || 0;
                
                if (isNaN(startTime)) return;
                
                // 计算经过的时间（分钟）
                const elapsedMinutes = Math.floor((now - startTime) / (1000 * 60));
                
                // 根据状态类型更新不同的显示文本
                switch (statusType) {
                    case 'working':
                        timeElement.textContent = `(已工作${baseMinutes + elapsedMinutes}min)`;
                        break;
                    case 'pause':
                        timeElement.textContent = `(已暂停${elapsedMinutes}min)`;
                        break;
                    case 'pending':
                        timeElement.textContent = `(${elapsedMinutes}min)`;
                        break;
                    default:
                        // 对于未知状态类型，使用通用格式
                        timeElement.textContent = `(${baseMinutes + elapsedMinutes}min)`;
                }
            } catch (error) {
                console.error('更新状态时间出错:', error);
            }
        });
    }
};

// 将弹幕模块挂载到全局变量
window.danmu = danmuModule; 