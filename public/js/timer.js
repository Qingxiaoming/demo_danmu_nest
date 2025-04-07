/**
 * 定时器模块
 * 管理闭眼状态下的计时功能
 */

// 定时器模块全局变量
window.timerModule = {
    time: 0,                // 当前时间（秒）
    targetTime: 0,          // 目标时间（秒）
    isRunning: false,       // 是否正在运行
    isCountdown: true,      // 是否为倒计时模式
    timerId: null,          // 定时器ID
    timerContainer: null,   // 定时器容器元素
    badgeContainer: null,   // 角标容器元素
    isEditing: false,       // 是否正在编辑时间
    isMinimized: true,      // 是否处于最小化状态（默认最小化，显示角标）
    pos1: 0, pos2: 0, pos3: 0, pos4: 0, // 拖动相关变量
    lastSaveTime: 0,        // 上次保存状态的时间
    
    // 获取定时器实例
    getTimer() {
        return this;
    },
    
    // 初始化定时器
    init() {
        // 清除可能存在的定时器
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        
        // 从本地存储加载状态
        this.loadState();
        
        // 如果没有保存的状态，设置默认值
        if (!this.targetTime) {
            this.targetTime = 300; // 默认5分钟
            this.time = this.targetTime;
        }
        
        this.isEditing = false;
        
        // 设置定期保存状态
        this.setupAutoSave();
        
        console.log('定时器模块已初始化');
    },
    
    // 设置自动保存
    setupAutoSave() {
        // 每5秒保存一次状态
        setInterval(() => {
            // 只有当状态有变化时才保存
            if (Date.now() - this.lastSaveTime > 5000) {
                this.saveState();
            }
        }, 5000);
    },
    
    // 保存状态到本地存储
    saveState() {
        const state = {
            time: this.time,
            targetTime: this.targetTime,
            isRunning: this.isRunning,
            isCountdown: this.isCountdown,
            position: this.getPosition(),
            isMinimized: this.isMinimized
        };
        
        localStorage.setItem('timerState', JSON.stringify(state));
        this.lastSaveTime = Date.now();
        
        console.log('定时器状态已保存', state);
    },
    
    // 获取定时器位置
    getPosition() {
        if (!this.timerContainer) return null;
        
        return {
            top: this.timerContainer.style.top,
            left: this.timerContainer.style.left
        };
    },
    
    // 从本地存储加载状态
    loadState() {
        try {
            const savedState = localStorage.getItem('timerState');
            if (savedState) {
                const state = JSON.parse(savedState);
                
                this.time = state.time || 0;
                this.targetTime = state.targetTime || 300;
                this.isCountdown = state.isCountdown !== undefined ? state.isCountdown : true;
                this.position = state.position || null;
                this.isMinimized = state.isMinimized !== undefined ? state.isMinimized : true;
                
                // 如果之前在运行，则重新开始
                if (state.isRunning) {
                    // 计算经过的时间并调整
                    const elapsedTime = Math.floor((Date.now() - this.lastSaveTime) / 1000);
                    if (this.isCountdown) {
                        this.time = Math.max(0, this.time - elapsedTime);
                    } else {
                        this.time += elapsedTime;
                    }
                    
                    // 暂时置为false，由start方法重置为true
                    this.isRunning = false;
                    
                    // 如果倒计时没有结束，则继续运行
                    if (!this.isCountdown || this.time > 0) {
                        setTimeout(() => this.start(), 100);
                    }
                }
                
                console.log('定时器状态已加载', state);
            }
        } catch (error) {
            console.error('加载定时器状态失败', error);
        }
    },
    
    // 创建定时器UI
    createTimerUI() {
        // 如果已存在定时器UI，则根据最小化状态显示或隐藏它
        const existingContainer = document.getElementById('timer-container');
        if (existingContainer) {
            existingContainer.style.display = this.isMinimized ? 'none' : '';
            
            // 如果角标不存在，确保创建它（无论是否最小化）
            if (!document.getElementById('timer-badge')) {
                this.createBadge();
            }
            
            return;
        }
        
        // 创建定时器容器
        const timerContainer = document.createElement('div');
        timerContainer.id = 'timer-container';
        timerContainer.className = 'timer-container';
        timerContainer.innerHTML = `
            <div class="timer-header" id="timer-drag-handle">
                <h3>定时器</h3>
            </div>
            <div class="timer-content">
                <div id="timer-display" class="timer-display">${this.formatTime(this.time)}</div>
                <div class="timer-controls">
                    <button id="timer-start" title="开始"><i class="fas fa-play"></i></button>
                    <button id="timer-pause" title="暂停"><i class="fas fa-pause"></i></button>
                    <button id="timer-reset" title="重置"><i class="fas fa-undo"></i></button>
                    <button id="timer-mode" title="${this.isCountdown ? '倒计时' : '正计时'}">
                        <i class="fas ${this.isCountdown ? 'fa-hourglass-half' : 'fa-clock'}"></i>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(timerContainer);
        this.timerContainer = timerContainer;
        
        // 如果有保存的位置，则应用
        if (this.position) {
            if (this.position.top) timerContainer.style.top = this.position.top;
            if (this.position.left) timerContainer.style.left = this.position.left;
        }
        
        // 根据最小化状态显示或隐藏定时器
        timerContainer.style.display = this.isMinimized ? 'none' : '';
        
        // 设置拖动功能
        this.makeDraggable(timerContainer);
        
        // 绑定事件处理
        document.getElementById('timer-start').onclick = () => this.start();
        document.getElementById('timer-pause').onclick = () => this.pause();
        document.getElementById('timer-reset').onclick = () => this.reset();
        document.getElementById('timer-mode').onclick = () => this.toggleMode();
        
        // 设置点击时间显示输入框
        const timerDisplay = document.getElementById('timer-display');
        timerDisplay.onclick = () => this.showTimeInput();
        
        // 更新初始显示
        this.updateDisplay();
        
        // 如果之前在运行，重新启动
        if (this.isRunning) {
            this.start();
        }
        
        // 记录已打开
        localStorage.removeItem('timerClosed');
        
        // 确保角标始终存在
        this.createBadge();
        
        console.log('定时器UI已创建');
    },
    
    // 创建角标
    createBadge() {
        console.log('开始创建角标...');
        
        // 如果已存在角标，则更新显示内容
        const existingBadge = document.getElementById('timer-badge');
        if (existingBadge) {
            console.log('角标已存在，更新内容');
            const badgeDisplay = existingBadge.querySelector('.timer-badge-display');
            if (badgeDisplay) {
                badgeDisplay.textContent = this.formatTime(this.time);
            }
            
            // 确保角标正常显示（由权限系统管理显隐）
            this.badgeContainer = existingBadge;
            console.log('角标已更新完成');
            return;
        }
        
        // 创建角标容器
        const badgeContainer = document.createElement('div');
        badgeContainer.id = 'timer-badge';
        badgeContainer.className = 'timer-badge';
        
        // 添加内联样式，确保基本样式正确应用 - 修改位置到左下角
        badgeContainer.style.position = 'fixed';
        badgeContainer.style.bottom = '20px';
        badgeContainer.style.left = '20px';
        badgeContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        badgeContainer.style.color = 'white';
        badgeContainer.style.borderRadius = '50px';
        badgeContainer.style.padding = '10px 16px';
        badgeContainer.style.cursor = 'pointer';
        badgeContainer.style.zIndex = '1000';
        badgeContainer.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.3)';
        badgeContainer.style.display = 'flex';
        badgeContainer.style.alignItems = 'center';
        badgeContainer.style.gap = '10px';
        
        // 设置角标内容
        badgeContainer.innerHTML = `
            <div class="timer-badge-display" style="font-size: 18px; font-weight: bold; font-family: 'Courier New', monospace;">${this.formatTime(this.time)}</div>
            <div class="timer-badge-icon" style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: rgba(76, 175, 80, 0.5); border-radius: 50%;">
                <i class="fas ${this.isRunning ? 'fa-play' : 'fa-pause'}"></i>
            </div>
        `;
        
        document.body.appendChild(badgeContainer);
        this.badgeContainer = badgeContainer;
        
        // 绑定点击事件，点击后切换定时器显示状态
        badgeContainer.onclick = () => {
            console.log('角标被点击，切换定时器显示状态');
            this.toggleTimerDisplay();
        };
        
        // 自动更新角标显示的时间
        this.updateBadgeDisplay();
        
        console.log('定时器角标已创建并添加到页面中');
    },
    
    // 切换定时器显示状态
    toggleTimerDisplay() {
        // 切换最小化状态
        this.isMinimized = !this.isMinimized;
        console.log(`定时器最小化状态切换为: ${this.isMinimized ? '最小化' : '展开'}`);
        
        // 保存状态
        this.saveState();
        
        // 通过权限系统管理显隐状态 - 完全依赖权限系统来处理
        if (window.permissions && typeof window.permissions.manageTimerVisibility === 'function') {
            window.permissions.manageTimerVisibility();
        }
    },
    
    // 更新角标显示
    updateBadgeDisplay() {
        const badgeDisplay = document.getElementById('timer-badge')?.querySelector('.timer-badge-display');
        const badgeIcon = document.getElementById('timer-badge')?.querySelector('.timer-badge-icon i');
        
        if (badgeDisplay) {
            badgeDisplay.textContent = this.formatTime(this.time);
        }
        
        if (badgeIcon) {
            badgeIcon.className = `fas ${this.isRunning ? 'fa-play' : 'fa-pause'}`;
        }
    },
    
    // 最小化定时器
    minimize() {
        if (!this.isMinimized) {
            this.isMinimized = true;
            
            // 隐藏定时器
            if (this.timerContainer) {
                this.timerContainer.style.display = 'none';
            }
            
            // 显示角标
            this.createBadge();
            
            // 保存状态
            this.saveState();
            
            console.log('定时器已最小化');
        }
    },
    
    // 最大化定时器
    maximize() {
        if (this.isMinimized) {
            this.isMinimized = false;
            
            // 显示定时器
            if (this.timerContainer) {
                this.timerContainer.style.display = '';
            } else {
                this.createTimerUI();
            }
            
            // 保存状态
            this.saveState();
            
            console.log('定时器已最大化');
        }
    },
    
    // 实现可拖动功能
    makeDraggable(element) {
        const dragHandle = document.getElementById('timer-drag-handle');
        if (!dragHandle) return;
        
        dragHandle.onmousedown = (e) => {
            e.preventDefault();
            
            // 获取鼠标初始位置
            this.pos3 = e.clientX;
            this.pos4 = e.clientY;
            
            // 添加鼠标移动和释放事件
            document.onmousemove = (e) => {
                e.preventDefault();
                
                // 计算新位置
                this.pos1 = this.pos3 - e.clientX;
                this.pos2 = this.pos4 - e.clientY;
                this.pos3 = e.clientX;
                this.pos4 = e.clientY;
                
                // 更新元素位置
                element.style.top = (element.offsetTop - this.pos2) + "px";
                element.style.left = (element.offsetLeft - this.pos1) + "px";
                
                // 保存位置
                this.position = {
                    top: element.style.top,
                    left: element.style.left
                };
                
                // 标记需要保存
                this.lastSaveTime = 0;
            };
            
            document.onmouseup = () => {
                // 停止拖动
                document.onmouseup = null;
                document.onmousemove = null;
                
                // 保存状态
                this.saveState();
            };
        };
    },
    
    // 显示时间输入框
    showTimeInput() {
        if (this.isEditing) return;
        this.isEditing = true;
        
        const timerDisplay = document.getElementById('timer-display');
        const currentTime = this.formatTime(this.time);
        
        // 替换为输入框
        timerDisplay.innerHTML = `
            <input type="text" id="timer-time-input" value="${currentTime}" 
                   placeholder="MM:SS" pattern="[0-9]{2}:[0-9]{2}">
        `;
        
        const inputElement = document.getElementById('timer-time-input');
        inputElement.focus();
        inputElement.select();
        
        // 处理Enter键和失去焦点事件
        inputElement.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.saveTimeInput();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelTimeInput();
            }
        };
        
        inputElement.onblur = () => {
            this.saveTimeInput();
        };
    },
    
    // 保存时间输入
    saveTimeInput() {
        const inputElement = document.getElementById('timer-time-input');
        if (!inputElement) return;
        
        const timeValue = inputElement.value;
        const timePattern = /^(\d{1,2}):(\d{2})$/;
        const match = timeValue.match(timePattern);
        
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const totalSeconds = minutes * 60 + seconds;
            
            // 更新时间
            if (this.isCountdown) {
                this.targetTime = totalSeconds;
                this.time = totalSeconds;
            } else {
                this.time = totalSeconds;
            }
            
            // 更新角标显示
            this.updateBadgeDisplay();
            
            // 保存状态
            this.saveState();
            
            console.log(`设置时间为: ${minutes}分${seconds}秒`);
        }
        
        // 恢复显示
        this.isEditing = false;
        this.updateDisplay();
    },
    
    // 取消时间输入
    cancelTimeInput() {
        this.isEditing = false;
        this.updateDisplay();
    },
    
    // 移除定时器UI
    removeTimerUI() {
        // 保存状态，确保下次能继续
        this.saveState();
        
        // 移除定时器容器
        if (this.timerContainer) {
            this.timerContainer.remove();
            this.timerContainer = null;
        }
        
        const existingContainer = document.getElementById('timer-container');
        if (existingContainer) {
            existingContainer.remove();
        }
        
        // 移除角标
        if (this.badgeContainer) {
            this.badgeContainer.remove();
            this.badgeContainer = null;
        }
        
        const existingBadge = document.getElementById('timer-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
    },
    
    // 开始计时
    start() {
        // 如果已经在运行，则不重复启动
        if (this.isRunning) return;
        
        // 如果倒计时模式且时间为0，自动重置为目标时间
        if (this.isCountdown && this.time === 0 && this.targetTime > 0) {
            this.time = this.targetTime;
            this.updateDisplay();
            console.log(`定时器自动重置为目标时间: ${this.formatTime(this.targetTime)}`);
        }
        
        this.isRunning = true;
        
        // 更新角标显示
        this.updateBadgeDisplay();
        
        // 设置计时器
        this.timerId = setInterval(() => {
            // 根据模式更新时间
            if (this.isCountdown) {
                this.time--;
                if (this.time <= 0) {
                    this.time = 0;
                    this.pause();
                    this.onTimeUp();
                }
            } else {
                this.time++;
            }
            
            // 更新显示
            this.updateDisplay();
            
            // 更新角标显示
            this.updateBadgeDisplay();
        }, 1000);
        
        // 保存状态
        this.saveState();
        
        console.log('定时器已启动');
    },
    
    // 暂停计时
    pause() {
        if (this.isRunning) {
            this.isRunning = false;
            clearInterval(this.timerId);
            this.timerId = null;
            
            // 更新角标图标
            this.updateBadgeDisplay();
            
            // 保存状态
            this.saveState();
            
            console.log('定时器已暂停');
        }
    },
    
    // 重置定时器
    reset() {
        // 停止计时
        this.pause();
        
        // 重置到目标时间
        if (this.isCountdown) {
            this.time = this.targetTime;
        } else {
            this.time = 0;
        }
        
        // 更新显示
        this.updateDisplay();
        
        // 更新角标显示
        this.updateBadgeDisplay();
        
        // 保存状态
        this.saveState();
        
        console.log(`定时器已重置为${this.formatTime(this.time)}`);
    },
    
    // 设置目标时间（分钟）
    setTargetTime(minutes) {
        this.targetTime = minutes * 60;
        this.time = this.isCountdown ? this.targetTime : 0;
        this.updateDisplay();
        this.updateBadgeDisplay();
        
        // 保存状态
        this.saveState();
        
        console.log(`定时器目标时间设置为 ${minutes} 分钟`);
    },
    
    // 切换定时器模式（倒计时/正计时）
    toggleMode() {
        // 暂停计时器
        this.pause();
        
        // 切换模式
        this.isCountdown = !this.isCountdown;
        
        // 根据模式重置时间
        if (this.isCountdown) {
            // 切换到倒计时模式，设置当前时间为目标时间
            this.targetTime = this.targetTime || 300; // 如果没有目标时间，默认5分钟
            this.time = this.targetTime;
        } else {
            // 切换到正计时模式，重置为0
            this.time = 0;
        }
        
        // 更新按钮图标
        const modeButton = document.getElementById('timer-mode');
        if (modeButton) {
            modeButton.title = this.isCountdown ? '倒计时' : '正计时';
            const icon = modeButton.querySelector('i');
            if (icon) {
                icon.className = `fas ${this.isCountdown ? 'fa-hourglass-half' : 'fa-clock'}`;
            }
        }
        
        // 更新显示
        this.updateDisplay();
        
        // 更新角标显示
        this.updateBadgeDisplay();
        
        // 保存状态
        this.saveState();
        
        console.log(`切换到${this.isCountdown ? '倒计时' : '正计时'}模式`);
    },
    
    // 格式化时间为 MM:SS
    formatTime(seconds) {
        const mins = Math.floor(Math.abs(seconds) / 60);
        const secs = Math.abs(seconds) % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },
    
    // 更新显示
    updateDisplay() {
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay && !this.isEditing) {
            timerDisplay.textContent = this.formatTime(this.time);
        }
    },
    
    // 时间到时的处理
    onTimeUp() {
        // 播放提示音
        try {
            const audio = new Audio();
            // 使用 demo.mp3 作为提示音
            audio.src = '/musics/demo.mp3';
            // 添加到全局，便于停止
            window.timerAudio = audio;
            audio.play();
            
            // 音频播放结束后自动清除引用
            audio.onended = () => {
                window.timerAudio = null;
            };
        } catch (e) {
            console.error('播放提示音失败:', e);
        }

        
        // 自动重置到之前设定的时间
        if (this.isCountdown) {
            this.time = this.targetTime;
            this.isRunning = false;
            this.updateDisplay();
            console.log(`定时器已自动重置为${this.formatTime(this.time)}`);
        }
        
        // 保存状态
        this.saveState();
        
        console.log('定时器时间到');
    }
};

// 导出定时器模块
window.Timer = window.timerModule; 

// 运行定时器
function runTimer() {
    console.log('========== 定时器初始化 ==========');
    
    // 初始化定时器模块
    window.timerModule.init();
    
    // 创建UI并使用权限系统管理显隐状态
    if (window.ui && typeof window.ui.showTimer === 'function') {
        window.ui.showTimer();
    }
    
    console.log('定时器已初始化完成');
}

// 页面加载完成后运行定时器
document.addEventListener('DOMContentLoaded', runTimer); 