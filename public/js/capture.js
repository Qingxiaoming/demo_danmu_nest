/**
 * 截屏/录屏工具模块
 * 支持截图和录屏功能
 */

window.captureModule = {
    // 状态管理
    isRecording: false,
    mediaRecorder: null,
    recordedChunks: [],
    captureStream: null,
    isSelecting: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    selectionElement: null,
    
    // 初始化截屏工具
    init() {
        console.log('初始化截屏/录屏工具');
        this.createCaptureButton();

        // 监听眼睛状态变化和登录状态变化，更新按钮显示状态
        document.addEventListener('eyeStateChanged', this.updateButtonVisibility.bind(this));
        document.addEventListener('loginStateChanged', this.updateButtonVisibility.bind(this));
        
        // 初始化时立即检查一次显示状态
        setTimeout(() => this.updateButtonVisibility(), 500);
    },
    
    // 更新按钮可见性
    updateButtonVisibility() {
        const captureBtn = document.getElementById('capture-tool-btn');
        if (!captureBtn) return;
        
        // 检查权限状态
        const hasAccess = window.permissions && window.permissions.hasAccessToFeature('screenshot');
        const eyeOpen = window.danmu && window.danmu.showNonWaiting;
        
        if (hasAccess && !eyeOpen) {
            // 不再修改display属性，而是让CSS处理可见性
            // 但仍需确保按钮是可以被点击的
            captureBtn.style.opacity = '';
            captureBtn.style.pointerEvents = '';
        } else {
            // 强制隐藏按钮且禁用点击
            captureBtn.style.opacity = '0';
            captureBtn.style.pointerEvents = 'none';
            
            // 如果菜单正在显示，隐藏它
            const captureMenu = document.getElementById('capture-menu');
            if (captureMenu && captureMenu.classList.contains('show')) {
                captureMenu.classList.remove('show');
            }
        }
    },
    
    // 创建截屏按钮
    createCaptureButton() {
        // 如果按钮已存在则不再创建
        if (document.getElementById('capture-tool-btn')) return;
        
        // 创建按钮元素
        const captureBtn = document.createElement('button');
        captureBtn.id = 'capture-tool-btn';
        captureBtn.className = 'capture-tool-btn';
        captureBtn.title = '截屏/录屏工具';
        captureBtn.innerHTML = '<i class="fas fa-camera"></i>';
        
        // 获取工具箱容器并添加按钮
        const toolboxContainer = document.getElementById('toolbox-container');
        if (toolboxContainer) {
            toolboxContainer.appendChild(captureBtn);
        } else {
            // 如果工具箱容器不存在，则添加到body
            document.body.appendChild(captureBtn);
        }
        
        // 点击事件 - 显示功能菜单
        captureBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // 防止事件冒泡导致菜单立即关闭
            this.toggleCaptureMenu();
        });
        
        // 创建功能菜单
        this.createCaptureMenu();
        
        // 初始化时检查一次按钮显示状态
        this.updateButtonVisibility();
    },
    
    // 创建截屏功能菜单
    createCaptureMenu() {
        // 如果菜单已存在则不再创建
        if (document.getElementById('capture-menu')) return;
        
        // 创建菜单元素
        const menu = document.createElement('div');
        menu.id = 'capture-menu';
        menu.className = 'capture-menu';
        menu.innerHTML = `
            <div class="capture-menu-item" id="screenshot-full">
                <i class="fas fa-desktop"></i>全屏截图
            </div>
            <div class="capture-menu-item" id="screenshot-area">
                <i class="fas fa-crop-alt"></i>区域截图
            </div>
            <div class="capture-menu-item" id="screen-record">
                <i class="fas fa-video"></i>屏幕录制
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(menu);
        
        // 添加菜单项点击事件
        document.getElementById('screenshot-full').addEventListener('click', () => {
            this.hideCaptureMenu();
            this.captureFullScreen();
        });
        
        document.getElementById('screenshot-area').addEventListener('click', () => {
            this.hideCaptureMenu();
            this.startAreaSelection();
        });
        
        document.getElementById('screen-record').addEventListener('click', () => {
            this.hideCaptureMenu();
            this.toggleScreenRecording();
        });
        
        // 点击其他地方关闭菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#capture-tool-btn') && 
                !e.target.closest('#capture-menu') &&
                menu.classList.contains('show')) {
                this.hideCaptureMenu();
            }
        });
    },
    
    // 切换截屏菜单显示/隐藏
    toggleCaptureMenu() {
        const menu = document.getElementById('capture-menu');
        if (!menu) return;
        
        const captureBtn = document.getElementById('capture-tool-btn');
        if (!captureBtn) return;
        
        if (menu.classList.contains('show')) {
            this.hideCaptureMenu();
        } else {
            // 计算菜单显示位置 - 在按钮上方
            const rect = captureBtn.getBoundingClientRect();
            menu.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
            menu.style.left = rect.left + 'px';
            
            menu.classList.add('show');
        }
    },
    
    // 隐藏截屏菜单
    hideCaptureMenu() {
        const menu = document.getElementById('capture-menu');
        if (menu) {
            menu.classList.remove('show');
        }
    },
    
    // 全屏截图
    async captureFullScreen() {
        try {
            // 检查是否支持屏幕捕获API
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                this.showNotification('您的浏览器不支持屏幕捕获功能');
                return;
            }
            
            // 捕获整个屏幕
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'screen' }
            });
            
            // 创建临时视频元素来加载流
            const video = document.createElement('video');
            video.srcObject = stream;
            
            // 等待视频元数据加载
            await new Promise(resolve => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });
            
            // 创建画布并绘制视频帧
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // 停止所有轨道
            stream.getTracks().forEach(track => track.stop());
            
            // 提供下载链接
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `全屏截图_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
            link.click();
            
            this.showNotification('已保存全屏截图');
        } catch (error) {
            console.error('全屏截图失败:', error);
            this.showNotification('截图失败: ' + (error.message || '未知错误'));
        }
    },
    
    // 开始区域选择
    async startAreaSelection() {
        try {
            // 首先请求用户选择要共享的内容（整个屏幕或窗口）
            this.showNotification('请选择要共享的屏幕或窗口');
            
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { 
                    mediaSource: 'screen',
                    displaySurface: 'monitor',
                    logicalSurface: true,
                    cursor: 'always'
                }
            });
            
            // 创建视频元素显示共享内容
            const video = document.createElement('video');
            video.srcObject = stream;
            video.autoplay = true;
            video.style.position = 'fixed';
            video.style.top = '0';
            video.style.left = '0';
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'contain';
            video.style.backgroundColor = 'black';
            video.style.zIndex = '10000';
            
            // 等待视频加载元数据
            await new Promise(resolve => {
                video.onloadedmetadata = () => {
                    resolve();
                };
            });
            
            // 创建全屏遮罩
            const overlay = document.createElement('div');
            overlay.className = 'screen-capture-overlay';
            overlay.style.backgroundColor = 'transparent';
            overlay.style.zIndex = '10001';
            
            // 创建选择框元素
            this.selectionElement = document.createElement('div');
            this.selectionElement.className = 'capture-selection';
            this.selectionElement.style.zIndex = '10002';
            overlay.appendChild(this.selectionElement);
            
            // 添加指导文字
            const guideText = document.createElement('div');
            guideText.className = 'capture-guide-text';
            guideText.textContent = '在共享的内容上按住鼠标左键并拖动选择区域';
            guideText.style.position = 'fixed';
            guideText.style.top = '10px';
            guideText.style.left = '50%';
            guideText.style.transform = 'translateX(-50%)';
            guideText.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            guideText.style.color = 'white';
            guideText.style.padding = '8px 16px';
            guideText.style.borderRadius = '4px';
            guideText.style.fontSize = '14px';
            guideText.style.zIndex = '10003';
            overlay.appendChild(guideText);
            
            // 添加按键提示
            const keyGuide = document.createElement('div');
            keyGuide.className = 'capture-key-guide';
            keyGuide.innerHTML = '按<kbd>Esc</kbd>取消截图 | 选择完成后按<kbd>Enter</kbd>确认截图';
            keyGuide.style.position = 'fixed';
            keyGuide.style.bottom = '10px';
            keyGuide.style.left = '50%';
            keyGuide.style.transform = 'translateX(-50%)';
            keyGuide.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            keyGuide.style.color = 'white';
            keyGuide.style.padding = '8px 16px';
            keyGuide.style.borderRadius = '4px';
            keyGuide.style.fontSize = '14px';
            keyGuide.style.zIndex = '10003';
            
            // 样式化键盘按键
            Array.from(keyGuide.querySelectorAll('kbd')).forEach(kbd => {
                kbd.style.backgroundColor = '#f1f1f1';
                kbd.style.color = '#333';
                kbd.style.padding = '2px 4px';
                kbd.style.borderRadius = '3px';
                kbd.style.boxShadow = '0 1px 1px rgba(0,0,0,.2)';
                kbd.style.fontSize = '12px';
            });
            
            overlay.appendChild(keyGuide);
            
            // 添加元素到页面
            document.body.appendChild(video);
            document.body.appendChild(overlay);
            
            this.isSelecting = false;
            
            // 存储原始视频尺寸
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            
            console.log('视频尺寸:', videoWidth, 'x', videoHeight);
            
            // 计算视频在屏幕上的实际显示尺寸和位置
            let captureData = {
                stream: stream,
                video: video,
                overlay: overlay,
                selection: null,
                videoWidth: videoWidth,
                videoHeight: videoHeight
            };
            
            // 鼠标按下事件 - 开始选择
            overlay.addEventListener('mousedown', (e) => {
                this.isSelecting = true;
                this.startX = e.clientX;
                this.startY = e.clientY;
                
                // 设置初始位置
                this.selectionElement.style.left = `${this.startX}px`;
                this.selectionElement.style.top = `${this.startY}px`;
                this.selectionElement.style.width = '0';
                this.selectionElement.style.height = '0';
                this.selectionElement.style.display = 'block';
                
                // 隐藏指导文字
                guideText.style.opacity = '0.3';
            });
            
            // 鼠标移动事件 - 更新选择区域
            overlay.addEventListener('mousemove', (e) => {
                if (!this.isSelecting) return;
                
                this.endX = e.clientX;
                this.endY = e.clientY;
                
                // 计算选择框尺寸和位置
                const width = Math.abs(this.endX - this.startX);
                const height = Math.abs(this.endY - this.startY);
                const left = Math.min(this.startX, this.endX);
                const top = Math.min(this.startY, this.endY);
                
                // 更新选择框
                this.selectionElement.style.width = `${width}px`;
                this.selectionElement.style.height = `${height}px`;
                this.selectionElement.style.left = `${left}px`;
                this.selectionElement.style.top = `${top}px`;
                
                // 显示当前尺寸信息
                const sizeInfo = document.createElement('div');
                sizeInfo.className = 'selection-size-info';
                sizeInfo.textContent = `${width} × ${height}`;
                sizeInfo.style.position = 'fixed';
                sizeInfo.style.top = `${top - 25}px`;
                sizeInfo.style.left = `${left}px`;
                sizeInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                sizeInfo.style.color = 'white';
                sizeInfo.style.padding = '2px 8px';
                sizeInfo.style.borderRadius = '2px';
                sizeInfo.style.fontSize = '12px';
                sizeInfo.style.zIndex = '10004';
                
                // 移除之前的尺寸信息
                const prevSizeInfo = document.querySelector('.selection-size-info');
                if (prevSizeInfo) prevSizeInfo.remove();
                
                overlay.appendChild(sizeInfo);
            });
            
            // 鼠标释放事件 - 完成选择
            overlay.addEventListener('mouseup', () => {
                if (!this.isSelecting) return;
                this.isSelecting = false;
                
                // 获取选择区域
                const width = Math.abs(this.endX - this.startX);
                const height = Math.abs(this.endY - this.startY);
                
                // 如果选择区域太小，认为是误操作
                if (width < 10 || height < 10) {
                    this.selectionElement.style.display = 'none';
                    this.showNotification('选择区域太小，请重新选择');
                    return;
                }
                
                // 保存选择区域信息
                captureData.selection = {
                    x: Math.min(this.startX, this.endX),
                    y: Math.min(this.startY, this.endY),
                    width: width,
                    height: height
                };
                
                // 显示提示通知
                this.showNotification('区域选择完成，按Enter键确认截图');
            });
            
            // 按键事件
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    // 清理资源
                    stream.getTracks().forEach(track => track.stop());
                    video.remove();
                    overlay.remove();
                    this.showNotification('已取消截图');
                } else if (e.key === 'Enter' && captureData.selection) {
                    this.processAreaScreenshot(captureData);
                }
            });
            
            // 视频流结束事件（用户停止共享）
            stream.getVideoTracks()[0].onended = () => {
                video.remove();
                overlay.remove();
                this.showNotification('共享已结束');
            };
            
        } catch (error) {
            console.error('区域选择失败:', error);
            this.showNotification('启动区域截图失败: ' + (error.message || '未知错误'));
        }
    },
    
    // 处理区域截图
    async processAreaScreenshot(captureData) {
        try {
            const { video, selection, videoWidth, videoHeight } = captureData;
            
            // 获取视频当前在屏幕上的显示尺寸和位置
            const videoRect = video.getBoundingClientRect();
            
            // 计算选择区域在原始视频中的坐标和尺寸
            // 需要考虑视频的缩放和位置
            let scale, offsetX, offsetY;
            
            // 如果视频被缩放为"contain"，需要计算实际显示区域
            if (videoRect.width / videoRect.height > videoWidth / videoHeight) {
                // 视频高度适应，宽度有空白
                scale = videoRect.height / videoHeight;
                offsetX = (videoRect.width - (videoWidth * scale)) / 2;
                offsetY = 0;
            } else {
                // 视频宽度适应，高度有空白
                scale = videoRect.width / videoWidth;
                offsetX = 0;
                offsetY = (videoRect.height - (videoHeight * scale)) / 2;
            }
            
            // 将选择区域坐标转换为视频原始坐标
            const originalX = Math.max(0, (selection.x - videoRect.left - offsetX) / scale);
            const originalY = Math.max(0, (selection.y - videoRect.top - offsetY) / scale);
            const originalWidth = Math.min(videoWidth - originalX, selection.width / scale);
            const originalHeight = Math.min(videoHeight - originalY, selection.height / scale);
            
            console.log('视频区域:', videoRect);
            console.log('选择区域:', selection);
            console.log('缩放比例:', scale, '偏移:', offsetX, offsetY);
            console.log('原始坐标:', originalX, originalY, originalWidth, originalHeight);
            
            // 创建画布并裁剪选定区域
            const canvas = document.createElement('canvas');
            canvas.width = originalWidth;
            canvas.height = originalHeight;
            const ctx = canvas.getContext('2d');
            
            // 绘制视频帧到画布上
            ctx.drawImage(
                video,
                originalX, originalY, originalWidth, originalHeight,
                0, 0, originalWidth, originalHeight
            );
            
            // 停止视频流
            captureData.stream.getTracks().forEach(track => track.stop());
            captureData.video.remove();
            captureData.overlay.remove();
            
            // 提供下载链接
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `截图_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
            link.click();
            
            this.showNotification('已保存区域截图');
        } catch (error) {
            console.error('处理区域截图失败:', error);
            
            // 清理资源
            if (captureData.stream) {
                captureData.stream.getTracks().forEach(track => track.stop());
            }
            if (captureData.video) captureData.video.remove();
            if (captureData.overlay) captureData.overlay.remove();
            
            this.showNotification('截图失败: ' + (error.message || '未知错误'));
        }
    },
    
    // 将图像复制到剪贴板 (旧版本，仅作参考)
    async copyImageToClipboard(canvas) {
        try {
            // 提供下载链接
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `截图_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
            link.click();
            
            this.showNotification('已保存截图');
        } catch (error) {
            console.error('保存图片失败:', error);
            this.showNotification('保存图片失败: ' + (error.message || '未知错误'));
        }
    },
    
    // 切换屏幕录制
    async toggleScreenRecording() {
        if (this.isRecording) {
            this.stopScreenRecording();
        } else {
            await this.startScreenRecording();
        }
    },
    
    // 开始屏幕录制
    async startScreenRecording() {
        try {
            // 请求屏幕共享
            this.captureStream = await navigator.mediaDevices.getDisplayMedia({
                video: { 
                    mediaSource: 'screen',
                    frameRate: { ideal: 30 }
                },
                audio: true  // 可选择是否捕获音频
            });
            
            // 创建媒体记录器
            this.recordedChunks = [];
            this.mediaRecorder = new MediaRecorder(this.captureStream, {
                mimeType: 'video/webm; codecs=vp9'
            });
            
            // 设置数据处理器
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            // 录制结束处理
            this.mediaRecorder.onstop = () => {
                this.processRecordedVideo();
            };
            
            // 开始录制
            this.mediaRecorder.start();
            this.isRecording = true;
            
            // 更新按钮图标
            this.updateCaptureButtonIcon(true);
            
            // 显示录制中通知
            this.showNotification('正在录制屏幕，点击按钮停止录制');
            
            // 监听媒体流结束事件（如用户点击共享界面中的"停止共享"）
            this.captureStream.getVideoTracks()[0].onended = () => {
                if (this.isRecording) {
                    this.stopScreenRecording();
                }
            };
        } catch (error) {
            console.error('开始屏幕录制失败:', error);
            this.showNotification('录制失败: ' + (error.message || '未知错误'));
        }
    },
    
    // 停止屏幕录制
    stopScreenRecording() {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
            console.warn('录制已经停止或未开始');
            return;
        }
        
        this.mediaRecorder.stop();
        this.captureStream.getTracks().forEach(track => track.stop());
        this.isRecording = false;
        
        // 更新按钮图标
        this.updateCaptureButtonIcon(false);
        
        this.showNotification('录制已停止，正在处理视频...');
    },
    
    // 处理录制的视频
    async processRecordedVideo() {
        if (this.recordedChunks.length === 0) {
            this.showNotification('没有录制到任何内容');
            return;
        }
        
        // 创建Blob对象
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        
        try {
            // 尝试复制到剪贴板
            const clipboardItem = new ClipboardItem({ 'video/webm': blob });
            await navigator.clipboard.write([clipboardItem]);
            
            this.showNotification('视频已复制到剪贴板');
        } catch (error) {
            console.error('无法复制视频到剪贴板:', error);
            
            // 回退方案：提供下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `屏幕录制_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
            a.click();
            
            // 释放资源
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            this.showNotification('视频无法复制到剪贴板，已提供下载链接');
        }
        
        // 清理资源
        this.recordedChunks = [];
    },
    
    // 更新截屏按钮图标（录制状态）
    updateCaptureButtonIcon(isRecording) {
        const captureBtn = document.getElementById('capture-tool-btn');
        if (!captureBtn) return;
        
        if (isRecording) {
            captureBtn.innerHTML = '<i class="fas fa-circle"></i>';
            captureBtn.classList.add('recording');
            captureBtn.title = '正在录制，点击停止';
        } else {
            captureBtn.innerHTML = '<i class="fas fa-camera"></i>';
            captureBtn.classList.remove('recording');
            captureBtn.title = '截屏/录屏工具';
        }
    },
    
    // 显示通知
    showNotification(message) {
        // 检查是否已有通知
        let notification = document.getElementById('capture-notification');
        
        // 如果已存在通知，则移除它
        if (notification) {
            notification.remove();
        }
        
        // 创建新通知
        notification = document.createElement('div');
        notification.id = 'capture-notification';
        notification.textContent = message;
        
        // 设置通知初始样式
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(-50%) translateY(20px)';
        
        document.body.appendChild(notification);
        
        // 显示通知并添加过渡效果
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(-50%) translateY(0)';
        }, 10);
        
        // 3秒后自动消失
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
};

// 页面加载完成后初始化截屏工具
document.addEventListener('DOMContentLoaded', () => {
    window.captureModule.init();
}); 