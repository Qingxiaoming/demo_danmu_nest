/**
 * 文件传输模块
 * 实现同一局域网下的文件/文字互传功能
 */

window.fileTransferModule = {
    // 状态变量
    isConnected: false,
    transferHistory: [],
    peerConnections: {},
    currentRoom: null,
    
    // 初始化文件传输模块
    init() {
        console.log('初始化文件传输模块');
        
        // 确保文件缓冲区被正确初始化
        window.fileTransferModule.fileBuffers = window.fileTransferModule.fileBuffers || {};
        
        // 清理过期的文件缓冲区(如果会话中存在未完成的传输)
        this.cleanupStaleTransfers();
        
        // 创建UI元素
        this.createFileTransferButton();
        
        // 监听眼睛状态变化和登录状态变化，更新按钮显示状态
        document.addEventListener('eyeStateChanged', this.updateButtonVisibility.bind(this));
        document.addEventListener('loginStateChanged', this.updateButtonVisibility.bind(this));
        
        // 初始化时立即检查一次显示状态
        setTimeout(() => this.updateButtonVisibility(), 500);
        
        // 只有在socket存在时才设置事件监听
        if (window.socket) {
            // 确保socket连接后再设置事件监听
            if (window.socket.connected) {
                this.setupSocketEvents();
            } else {
                // 设置连接事件，连接后再设置其他事件
                window.socket.once('connect', () => {
                    console.log('Socket连接已建立，开始设置文件传输事件');
                    this.setupSocketEvents();
                });
                
                // 如果尚未连接，尝试连接
                window.socket.connect();
            }
        } else {
            // 如果socket不存在，等待socket初始化完成
            console.warn('Socket未初始化，等待socket初始化后再设置事件');
            const checkAndSetupInterval = setInterval(() => {
                if (window.socket) {
                    console.log('Socket已初始化，开始设置文件传输事件');
                    clearInterval(checkAndSetupInterval);
                    
                    if (window.socket.connected) {
                        this.setupSocketEvents();
                    } else {
                        window.socket.once('connect', () => {
                            this.setupSocketEvents();
                        });
                        window.socket.connect();
                    }
                }
            }, 1000);
        }
        
        // 添加网络状态恢复监听
        window.addEventListener('online', () => {
            console.log('网络已恢复，重新初始化文件传输事件');
            
            // 网络恢复后，尝试重新连接socket
            if (window.socket && !window.socket.connected) {
                window.socket.connect();
            }
            
            // 重新设置事件
            setTimeout(() => this.setupSocketEvents(), 2000);
        });
        
        console.log('文件传输模块初始化完成');
    },
    
    // 清理过期的文件传输
    cleanupStaleTransfers() {
        const now = Date.now();
        const timeout = 30 * 60 * 1000; // 30分钟超时
        
        for (const fileId in window.fileTransferModule.fileBuffers) {
            const fileBuffer = window.fileTransferModule.fileBuffers[fileId];
            // 如果缓冲区存在但没有时间戳或超过超时时间，则清理
            if (!fileBuffer.timestamp || (now - fileBuffer.timestamp > timeout)) {
                console.log(`清理过期的文件传输: ${fileId}`);
                delete window.fileTransferModule.fileBuffers[fileId];
                
                // 如果在历史记录中，标记为失败
                const historyItem = this.transferHistory.find(i => i.id === fileId);
                if (historyItem && historyItem.status !== 'completed' && historyItem.status !== 'failed') {
                    this.updateHistoryItemStatus(fileId, 'failed');
                }
            }
        }
    },
    
    // 更新按钮可见性
    updateButtonVisibility() {
        const fileTransferBtn = document.getElementById('file-transfer-btn');
        if (!fileTransferBtn) return;
        
        // 检查权限状态
        const hasAccess = window.permissions && window.permissions.hasAccessToFeature('filetransfer');
        const eyeOpen = window.danmu && window.danmu.showNonWaiting;
        
        if (hasAccess && !eyeOpen) {
            // 不再修改display属性，而是让CSS处理可见性
            // 但仍需确保按钮是可以被点击的
            fileTransferBtn.style.opacity = '';
            fileTransferBtn.style.pointerEvents = '';
        } else {
            // 强制隐藏按钮且禁用点击
            fileTransferBtn.style.opacity = '0';
            fileTransferBtn.style.pointerEvents = 'none';
            
            // 如果传输界面正在显示，也隐藏它
            const fileTransferPanel = document.getElementById('file-transfer-panel');
            if (fileTransferPanel && fileTransferPanel.classList.contains('show')) {
                fileTransferPanel.classList.remove('show');
            }
        }
    },
    
    // 创建文件传输按钮
    createFileTransferButton() {
        // 检查是否已存在按钮
        if (document.getElementById('file-transfer-btn')) return;
        
        // 创建主按钮
        const fileTransferBtn = document.createElement('button');
        fileTransferBtn.id = 'file-transfer-btn';
        fileTransferBtn.className = 'file-transfer-btn';
        fileTransferBtn.innerHTML = '<i class="fas fa-exchange-alt"></i>';
        fileTransferBtn.title = '文件/文字互传';
        // 不再设置display属性，让CSS控制可见性
        
        // 获取工具箱容器并添加按钮
        const toolboxContainer = document.getElementById('toolbox-container');
        if (toolboxContainer) {
            toolboxContainer.appendChild(fileTransferBtn);
        } else {
            // 如果工具箱容器不存在，则添加到body
            document.body.appendChild(fileTransferBtn);
        }
        
        // 创建传输面板
        const fileTransferPanel = document.createElement('div');
        fileTransferPanel.id = 'file-transfer-panel';
        fileTransferPanel.className = 'file-transfer-panel';
        fileTransferPanel.innerHTML = `
            <div class="file-transfer-header">
                <h3>局域网文件/文字互传</h3>
                <button id="file-transfer-close" class="file-transfer-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="file-transfer-content">
                <div class="connection-status">
                    <span id="connection-info">未连接</span>
                </div>
                <div class="room-info">
                    <input type="text" id="room-name" placeholder="输入房间名称" maxlength="20">
                    <button id="create-join-room">加入/创建房间</button>
                </div>
                <div class="transfer-tabs">
                    <button class="tab-btn active" data-tab="file">文件传输</button>
                    <button class="tab-btn" data-tab="text">文字传输</button>
                </div>
                <div class="tab-content" id="file-tab">
                    <div class="file-upload">
                        <label for="file-input" class="file-label">
                            <i class="fas fa-upload"></i> 选择文件
                        </label>
                        <input type="file" id="file-input" multiple>
                        <div class="selected-files" id="selected-files">未选择任何文件</div>
                        <button id="send-files" disabled>发送文件</button>
                    </div>
                </div>
                <div class="tab-content hidden" id="text-tab">
                    <textarea id="text-message" placeholder="输入要传输的文字"></textarea>
                    <button id="send-text">发送文字</button>
                </div>
                <div class="transfer-history">
                    <h4>传输历史</h4>
                    <div id="history-list" class="history-list">
                        <!-- 历史记录将在这里动态添加 -->
                    </div>
                </div>
            </div>
        `;
        
        // 添加面板到页面，不重复添加按钮
        document.body.appendChild(fileTransferPanel);
        
        // 添加事件监听
        fileTransferBtn.addEventListener('click', () => this.togglePanel());
        
        document.getElementById('file-transfer-close').addEventListener('click', () => {
            this.hidePanel();
        });
        
        document.getElementById('create-join-room').addEventListener('click', () => {
            const roomName = document.getElementById('room-name').value.trim();
            if (roomName) {
                this.joinRoom(roomName);
            } else {
                this.showNotification('请输入房间名称');
            }
        });
        
        // 文件选择事件
        document.getElementById('file-input').addEventListener('change', (e) => {
            const files = e.target.files;
            const selectedFilesDiv = document.getElementById('selected-files');
            const sendButton = document.getElementById('send-files');
            
            if (files.length > 0) {
                let filesList = '';
                for (let i = 0; i < files.length; i++) {
                    filesList += `<div class="file-item">${files[i].name} (${this.formatFileSize(files[i].size)})</div>`;
                }
                selectedFilesDiv.innerHTML = filesList;
                sendButton.disabled = false;
            } else {
                selectedFilesDiv.textContent = '未选择任何文件';
                sendButton.disabled = true;
            }
        });
        
        // 发送文件按钮
        document.getElementById('send-files').addEventListener('click', () => {
            const fileInput = document.getElementById('file-input');
            if (fileInput.files.length > 0) {
                this.sendFiles(fileInput.files);
            }
        });
        
        // 发送文字按钮
        document.getElementById('send-text').addEventListener('click', () => {
            const textMessage = document.getElementById('text-message').value.trim();
            if (textMessage) {
                this.sendText(textMessage);
                document.getElementById('text-message').value = '';
            } else {
                this.showNotification('请输入要发送的文字');
            }
        });
        
        // 标签切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
    },
    
    // 切换标签页
    switchTab(tabName) {
        // 更新标签按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // 更新标签内容显示
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('hidden', content.id !== `${tabName}-tab`);
        });
    },
    
    // 切换面板显示/隐藏
    togglePanel() {
        const panel = document.getElementById('file-transfer-panel');
        if (!panel) return;
        
        if (panel.classList.contains('show')) {
            this.hidePanel();
        } else {
            // 在显示面板前，先关闭工具箱的展开状态（如果是移动设备）
            const toolboxContainer = document.getElementById('toolbox-container');
            if (toolboxContainer && toolboxContainer.classList.contains('expanded')) {
                toolboxContainer.classList.remove('expanded');
            }
            
            // 显示面板
            panel.classList.add('show');
            console.log('显示文件传输面板');
        }
    },
    
    // 隐藏面板
    hidePanel() {
        const panel = document.getElementById('file-transfer-panel');
        panel.classList.remove('show');
    },
    
    // 加入/创建房间
    joinRoom(roomName) {
        if (!window.socket) {
            this.showNotification('Socket未初始化，无法加入房间');
            return;
        }
        
        if (!window.socket.connected) {
            console.warn('Socket未连接，尝试重新连接...');
            window.socket.connect();
            
            // 延迟加入房间
            setTimeout(() => {
                this.joinRoom(roomName);
            }, 1500);
            return;
        }
        
        console.log(`尝试加入房间: ${roomName}`);
        this.showNotification('正在加入房间...');
        
        // 先退出当前房间(如果有)
        if (this.currentRoom) {
            this.leaveRoom();
        }
        
        // 确保事件监听器已设置
        this.setupSocketEvents();
        
        // 加入新房间
        window.socket.emit('join_file_transfer_room', { roomName });
        
        // 为防止服务器响应丢失，设置超时检查
        setTimeout(() => {
            if (this.currentRoom !== roomName) {
                console.warn(`加入房间 ${roomName} 超时，重试...`);
                window.socket.emit('join_file_transfer_room', { roomName });
            }
        }, 5000);
    },
    
    // 离开当前房间
    leaveRoom() {
        if (this.currentRoom && window.socket && window.socket.connected) {
            window.socket.emit('leave_file_transfer_room', { roomName: this.currentRoom });
            this.currentRoom = null;
            document.getElementById('connection-info').textContent = '未连接';
        }
    },
    
    // 发送文件
    sendFiles(files) {
        if (!this.currentRoom) {
            this.showNotification('请先加入房间');
            return;
        }
        
        // 使用WebRTC或Socket.IO处理文件传输
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileId = this.generateUniqueId();
            const fileInfo = {
                id: fileId,
                name: file.name,
                type: file.type,
                size: file.size,
                sender: window.socket.id,
                roomName: this.currentRoom,
                timestamp: Date.now()
            };
            
            // 通知其他用户有文件将被发送
            window.socket.emit('file_transfer_offer', fileInfo);
            
            // 添加到传输历史
            this.addToHistory({
                type: 'file',
                direction: 'out',
                name: file.name,
                size: file.size,
                id: fileId,
                timestamp: Date.now(),
                status: 'pending'
            });
            
            // 读取文件内容并分片发送
            this.readAndSendFile(file, fileId);
        }
    },
    
    // 读取并发送文件
    readAndSendFile(file, fileId) {
        const chunkSize = 256 * 1024; // 增大到256KB，提高传输速度
        const totalChunks = Math.ceil(file.size / chunkSize);
        let currentChunk = 0;
        let inFlightChunks = 0; // 记录正在传输中的块数
        const maxConcurrentChunks = 5; // 最大并发传输块数
        
        console.log(`开始发送文件 "${file.name}", 大小: ${this.formatFileSize(file.size)}, 分块数: ${totalChunks}`);
        
        // 创建一个发送块的函数
        const sendChunk = (chunkIndex) => {
            if (chunkIndex >= totalChunks) return;
            
            // 计算该块的起始和结束位置
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const blob = file.slice(start, end);
            
            // 读取并发送块
            const reader = new FileReader();
            reader.onload = (e) => {
                const arrayBuffer = e.target.result;
                
                // 只记录第一个、每10个和最后一个块的信息
                if (chunkIndex === 0 || chunkIndex === totalChunks - 1 || chunkIndex % 10 === 0) {
                    console.log(`发送文件块 ${chunkIndex + 1}/${totalChunks}, 大小: ${arrayBuffer.byteLength} 字节`);
                }
                
                // 发送文件块
                window.socket.emit('file_chunk', {
                    fileId,
                    roomName: this.currentRoom,
                    chunk: arrayBuffer,
                    chunkIndex: chunkIndex,
                    totalChunks
                });
                
                // 更新进度
                const progress = Math.round((chunkIndex + 1) / totalChunks * 100);
                this.updateTransferProgress(fileId, progress);
                
                // 这个块已发送完成，减少正在传输的块计数
                inFlightChunks--;
                
                // 如果还有块，继续发送下一批
                if (currentChunk < totalChunks) {
                    sendNextChunk();
                } else if (inFlightChunks === 0) {
                    // 所有块都已发送完成
                    console.log(`文件 "${file.name}" 的所有块已发送完成`);
                    window.socket.emit('file_transfer_complete', {
                        fileId,
                        roomName: this.currentRoom
                    });
                    
                    // 更新历史状态
                    this.updateHistoryItemStatus(fileId, 'completed');
                }
            };
            
            reader.onerror = (error) => {
                console.error(`读取文件块 ${chunkIndex} 失败:`, error);
                inFlightChunks--;
                
                // 如果是关键块（第一个或最后一个），则标记传输失败
                if (chunkIndex === 0 || chunkIndex === totalChunks - 1) {
                    this.updateHistoryItemStatus(fileId, 'failed');
                    this.showNotification('文件块读取失败，传输中断');
                } else {
                    // 否则继续发送下一块
                    if (currentChunk < totalChunks) {
                        sendNextChunk();
                    }
                }
            };
            
            reader.readAsArrayBuffer(blob);
            inFlightChunks++;
        };
        
        // 发送下一批块
        const sendNextChunk = () => {
            // 尽可能填充并发传输槽
            while (inFlightChunks < maxConcurrentChunks && currentChunk < totalChunks) {
                sendChunk(currentChunk++);
            }
        };
        
        // 开始发送
        sendNextChunk();
    },
    
    // 接收文件
    receiveFile(fileInfo) {
        console.log(`接收文件请求: "${fileInfo.name}", 大小: ${this.formatFileSize(fileInfo.size)}, ID: ${fileInfo.id}`);
        
        // 确保文件缓冲区存在
        window.fileTransferModule.fileBuffers = window.fileTransferModule.fileBuffers || {};
        
        // 检查是否已存在此文件的缓冲区，如果存在且已标记为完成，则删除它
        if (window.fileTransferModule.fileBuffers[fileInfo.id]) {
            if (window.fileTransferModule.fileBuffers[fileInfo.id].finalized) {
                console.log(`删除已完成的文件缓冲区 ${fileInfo.id} 以准备接收新文件`);
                delete window.fileTransferModule.fileBuffers[fileInfo.id];
            } else {
                console.log(`文件 ${fileInfo.id} 正在接收中，跳过重复初始化`);
                return;
            }
        }
        
        // 添加到历史记录
        this.addToHistory({
            type: 'file',
            direction: 'in',
            name: fileInfo.name,
            size: fileInfo.size,
            id: fileInfo.id,
            timestamp: fileInfo.timestamp,
            status: 'receiving'
        });
        
        // 创建缓冲区来存储接收的数据
        window.fileTransferModule.fileBuffers[fileInfo.id] = {
            chunks: new Array(Math.ceil(fileInfo.size / (256 * 1024))), // 预分配数组大小，假定256KB块
            received: 0,
            total: fileInfo.size,
            name: fileInfo.name,
            type: fileInfo.type,
            finalized: false,
            startTime: Date.now(),
            lastProgressUpdate: Date.now()
        };
        
        console.log(`已为文件 ${fileInfo.id} 创建接收缓冲区，准备接收大约 ${window.fileTransferModule.fileBuffers[fileInfo.id].chunks.length} 个块`);
    },
    
    // 接收文件块
    receiveFileChunk(data) {
        const { fileId, chunk, chunkIndex, totalChunks } = data;
        
        // 确保文件缓冲区存在
        window.fileTransferModule.fileBuffers = window.fileTransferModule.fileBuffers || {};
        
        let fileBuffer = window.fileTransferModule.fileBuffers[fileId];
        
        if (!fileBuffer) {
            console.warn(`未找到文件缓冲区: ${fileId}`);
            return;
        }
        
        // 检查此块是否已经接收过，避免重复处理
        if (fileBuffer.chunks[chunkIndex] !== undefined) {
            return; // 静默跳过，减少不必要的日志
        }
        
        // 只记录第一个、每20个块和最后一个块的信息，减少日志量
        if (chunkIndex === 0 || chunkIndex === totalChunks - 1 || chunkIndex % 20 === 0) {
            console.log(`接收文件块 ${chunkIndex + 1}/${totalChunks}, 类型: ${typeof chunk}`);
        }
        
        // 高效处理不同类型的块数据
        try {
            let processedChunk = chunk;
            
            // 必要时转换块数据格式
            if (typeof chunk === 'string') {
                try {
                    const binaryString = window.atob(chunk);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    processedChunk = bytes.buffer;
                } catch (e) {
                    processedChunk = new ArrayBuffer(0);
                }
            } else if (chunk instanceof Blob) {
                // 如果收到的是Blob，转换为ArrayBuffer
                const reader = new FileReader();
                reader.onload = (e) => {
                    fileBuffer.chunks[chunkIndex] = e.target.result;
                    fileBuffer.received += e.target.result.byteLength;
                    
                    // 限制进度更新频率，最多每500ms更新一次UI
                    const now = Date.now();
                    if (now - fileBuffer.lastProgressUpdate > 500) {
                        const progress = Math.round(fileBuffer.received / fileBuffer.total * 100);
                        this.updateTransferProgress(fileId, progress);
                        fileBuffer.lastProgressUpdate = now;
                        
                        // 计算并显示传输速度
                        const elapsedSec = (now - fileBuffer.startTime) / 1000;
                        if (elapsedSec > 0) {
                            const bytesPerSec = fileBuffer.received / elapsedSec;
                            const speedText = this.formatFileSize(bytesPerSec) + '/s';
                            console.log(`文件传输速度: ${speedText} (${progress}%)`);
                        }
                    }
                    
                    // 检查是否所有块都已接收
                    this.checkAllChunksReceived(fileId, totalChunks);
                };
                reader.readAsArrayBuffer(chunk);
                return; // 异步处理，提前返回
            }
            
            // 存储块
            fileBuffer.chunks[chunkIndex] = processedChunk;
            fileBuffer.received += processedChunk.byteLength || 0;
            
            // 限制进度更新频率
            const now = Date.now();
            if (now - fileBuffer.lastProgressUpdate > 500) {
                const progress = Math.round(fileBuffer.received / fileBuffer.total * 100);
                this.updateTransferProgress(fileId, progress);
                fileBuffer.lastProgressUpdate = now;
                
                // 计算并显示传输速度
                const elapsedSec = (now - fileBuffer.startTime) / 1000;
                if (elapsedSec > 0) {
                    const bytesPerSec = fileBuffer.received / elapsedSec;
                    const speedText = this.formatFileSize(bytesPerSec) + '/s';
                    console.log(`文件传输速度: ${speedText} (${progress}%)`);
                }
            }
            
            // 检查是否所有块都已接收
            this.checkAllChunksReceived(fileId, totalChunks);
        } catch (error) {
            console.error(`处理文件块 ${chunkIndex}/${totalChunks} 时出错:`, error);
        }
    },
    
    // 检查是否所有块都已接收
    checkAllChunksReceived(fileId, totalChunks) {
        const fileBuffer = window.fileTransferModule.fileBuffers[fileId];
        if (!fileBuffer) return;
        
        // 如果文件已经处理过，不再继续检查
        if (fileBuffer.finalized) {
            return;
        }
        
        // 计算接收到的块数
        const receivedChunks = fileBuffer.chunks.filter(c => c).length;
        
        // 只在一定间隔或大比例变化时记录进度
        if (receivedChunks === totalChunks || receivedChunks === 1 || 
            receivedChunks % Math.max(Math.floor(totalChunks / 10), 1) === 0) {
            console.log(`文件 ${fileId}: 已接收 ${receivedChunks}/${totalChunks} 块 (${Math.round(receivedChunks/totalChunks*100)}%)`);
        }
        
        // 如果所有块都收到，合并并下载
        if (receivedChunks === totalChunks) {
            this.finalizeFileTransfer(fileId);
        }
    },
    
    // 完成文件传输
    async finalizeFileTransfer(fileId) {
        const fileBuffer = window.fileTransferModule.fileBuffers[fileId];
        if (!fileBuffer) {
            console.warn(`文件 ${fileId} 缓冲区不存在`);
            return;
        }
        
        // 检查是否已经处理过此文件
        if (fileBuffer.finalized) {
            console.warn(`文件 ${fileId} 已处理过，跳过重复处理`);
            return;
        }
        
        // 标记为已处理
        fileBuffer.finalized = true;
        
        try {
            console.log(`准备合并文件 ${fileBuffer.name}`);
            const startTime = performance.now();
            
            // 计算传输速度
            const transferTime = (Date.now() - fileBuffer.startTime) / 1000;
            const averageSpeed = fileBuffer.total / transferTime;
            console.log(`文件传输完成，平均速度: ${this.formatFileSize(averageSpeed)}/s，传输耗时: ${transferTime.toFixed(1)}秒`);
            
            // 确保所有块都是正确的格式
            const validChunks = fileBuffer.chunks.filter(chunk => 
                chunk instanceof ArrayBuffer || 
                chunk instanceof Blob || 
                (chunk && typeof chunk === 'object')
            );
            
            console.log(`有效块数: ${validChunks.length}, 总块数: ${fileBuffer.chunks.length}`);
            
            // 合并文件 - 使用更高效的方法处理大文件
            let file;
            try {
                // 直接使用Blob构造函数合并 - 对于较小的文件效率更高
                if (fileBuffer.total < 100 * 1024 * 1024) { // 小于100MB的文件
                    file = new Blob(validChunks, { type: fileBuffer.type || 'application/octet-stream' });
                } else {
                    // 对于大文件，分批处理以避免内存问题
                    const BATCH_SIZE = 10; // 每批处理的块数
                    let batches = [];
                    
                    for (let i = 0; i < validChunks.length; i += BATCH_SIZE) {
                        const batchChunks = validChunks.slice(i, i + BATCH_SIZE);
                        const batchBlob = new Blob(batchChunks, { type: fileBuffer.type || 'application/octet-stream' });
                        batches.push(batchBlob);
                    }
                    
                    // 合并所有批次
                    file = new Blob(batches, { type: fileBuffer.type || 'application/octet-stream' });
                }
                
                console.log(`合并后文件大小: ${file.size} 字节, 合并耗时: ${((performance.now() - startTime)/1000).toFixed(2)}秒`);
            } catch (error) {
                console.error('合并文件块失败，尝试替代方法:', error);
                
                // 替代方法：对大文件进行分批处理
                const BATCH_SIZE = 20 * 1024 * 1024; // 20MB批量大小
                const totalLength = validChunks.reduce((total, chunk) => {
                    return total + (chunk.byteLength || chunk.size || 0);
                }, 0);
                
                // 创建一个临时Blob数组
                let tempBlobs = [];
                let processedBytes = 0;
                let currentBatch = [];
                let currentBatchSize = 0;
                
                for (const chunk of validChunks) {
                    let chunkArray;
                    
                    if (chunk instanceof ArrayBuffer) {
                        currentBatch.push(chunk);
                        currentBatchSize += chunk.byteLength;
                    } else if (chunk instanceof Blob) {
                        currentBatch.push(chunk);
                        currentBatchSize += chunk.size;
                    } else {
                        continue; // 跳过无法处理的块
                    }
                    
                    // 如果当前批次达到了批量大小，创建一个Blob并开始新的批次
                    if (currentBatchSize >= BATCH_SIZE) {
                        tempBlobs.push(new Blob(currentBatch, { type: 'application/octet-stream' }));
                        processedBytes += currentBatchSize;
                        currentBatch = [];
                        currentBatchSize = 0;
                        console.log(`批量处理: ${Math.round(processedBytes/totalLength*100)}%`);
                    }
                }
                
                // 添加最后一个批次
                if (currentBatch.length > 0) {
                    tempBlobs.push(new Blob(currentBatch, { type: 'application/octet-stream' }));
                }
                
                // 创建最终Blob
                file = new Blob(tempBlobs, { type: fileBuffer.type || 'application/octet-stream' });
                console.log(`替代方法合并后文件大小: ${file.size} 字节, 耗时: ${((performance.now() - startTime)/1000).toFixed(2)}秒`);
            }
            
            // 创建下载链接
            const url = URL.createObjectURL(file);
            
            if (this.isIOS()) {
                // iOS特别处理（Safari需要特殊处理）
                this.showNotification(`文件准备完成: ${fileBuffer.name}，正在打开...`);
                
                // 对于iOS，使用window.open来预览/下载文件
                const newTab = window.open(url, '_blank');
                if (!newTab) {
                    // 如果弹窗被阻止，提供一个直接下载的链接
                    this.showDownloadLink(url, fileBuffer.name);
                }
            } else {
                // 其他平台使用标准下载方法
                const link = document.createElement('a');
                link.href = url;
                link.download = fileBuffer.name;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            
            // 清理URL
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 60000);
            
            // 更新UI状态
            this.updateHistoryItemStatus(fileId, 'completed');
            this.showNotification(`已接收文件: ${fileBuffer.name}`);
            
            // 清理内存
            fileBuffer.chunks = null; // 帮助垃圾回收
            delete window.fileTransferModule.fileBuffers[fileId];
            
            // 额外清理
            if (window.gc) window.gc(); // 在支持手动GC的环境中触发GC
        } catch (error) {
            console.error(`文件 ${fileId} 处理失败:`, error);
            this.updateHistoryItemStatus(fileId, 'failed');
            this.showNotification(`文件接收失败: ${fileBuffer.name}`);
            
            // 删除缓冲区
            delete window.fileTransferModule.fileBuffers[fileId];
        }
    },
    
    // 显示下载链接（用于iOS设备无法自动下载时）
    showDownloadLink(url, fileName) {
        // 创建一个可见的下载链接
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '20%';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        container.style.backgroundColor = 'white';
        container.style.padding = '20px';
        container.style.borderRadius = '10px';
        container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        container.style.zIndex = '10000';
        container.style.textAlign = 'center';
        
        const message = document.createElement('p');
        message.textContent = `文件 "${fileName}" 已准备好，点击下方链接下载：`;
        container.appendChild(message);
        
        const link = document.createElement('a');
        link.href = url;
        link.textContent = '下载文件';
        link.style.display = 'block';
        link.style.margin = '10px 0';
        link.style.padding = '10px 15px';
        link.style.backgroundColor = '#4CAF50';
        link.style.color = 'white';
        link.style.borderRadius = '4px';
        link.style.textDecoration = 'none';
        link.download = fileName;
        container.appendChild(link);
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.style.padding = '5px 10px';
        closeBtn.style.marginTop = '10px';
        closeBtn.onclick = () => document.body.removeChild(container);
        container.appendChild(closeBtn);
        
        document.body.appendChild(container);
    },
    
    // 检测是否为iOS设备
    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    },
    
    // 发送文字
    sendText(text) {
        if (!this.currentRoom) {
            this.showNotification('请先加入房间');
            return;
        }
        
        const textId = this.generateUniqueId();
        const textInfo = {
            id: textId,
            text: text,
            sender: window.socket.id,
            roomName: this.currentRoom,
            timestamp: Date.now()
        };
        
        window.socket.emit('text_transfer', textInfo);
        
        // 添加到历史记录
        this.addToHistory({
            type: 'text',
            direction: 'out',
            preview: text.length > 30 ? text.substring(0, 30) + '...' : text,
            content: text,
            id: textId,
            timestamp: Date.now(),
            status: 'completed'
        });
    },
    
    // 接收文字
    receiveText(textInfo) {
        // 添加到历史记录
        this.addToHistory({
            type: 'text',
            direction: 'in',
            preview: textInfo.text.length > 30 ? textInfo.text.substring(0, 30) + '...' : textInfo.text,
            content: textInfo.text,
            id: textInfo.id,
            timestamp: textInfo.timestamp,
            status: 'completed'
        });
        
        // 显示通知
        this.showNotification('收到新文字消息');
        
        // 如果用户在文字标签页，则自动填充文本框
        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        if (activeTab === 'text') {
            document.getElementById('text-message').value = textInfo.text;
        }
    },
    
    // 添加到传输历史
    addToHistory(item) {
        this.transferHistory.unshift(item);
        this.renderHistory();
    },
    
    // 渲染历史记录
    renderHistory() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;
        
        historyList.innerHTML = '';
        
        if (this.transferHistory.length === 0) {
            historyList.innerHTML = '<div class="no-history">暂无传输记录</div>';
            return;
        }
        
        this.transferHistory.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = `history-item ${item.direction} ${item.type} ${item.status}`;
            historyItem.dataset.id = item.id;
            
            const iconClass = item.type === 'file' ? 'fa-file' : 'fa-comment';
            const directionIcon = item.direction === 'out' ? 'fa-arrow-up' : 'fa-arrow-down';
            const timestamp = new Date(item.timestamp).toLocaleTimeString();
            
            let statusText = '';
            switch (item.status) {
                case 'pending': statusText = '准备中'; break;
                case 'receiving': statusText = '接收中'; break;
                case 'sending': statusText = '发送中'; break;
                case 'completed': statusText = '已完成'; break;
                case 'failed': statusText = '失败'; break;
                default: statusText = item.status;
            }
            
            let content = '';
            if (item.type === 'file') {
                content = `
                    <div class="item-icon"><i class="fas ${iconClass}"></i></div>
                    <div class="item-content">
                        <div class="item-name">${item.name}</div>
                        <div class="item-info">
                            <span class="item-size">${this.formatFileSize(item.size)}</span>
                            <span class="item-time">${timestamp}</span>
                        </div>
                        <div class="item-status">
                            <i class="fas ${directionIcon}"></i>
                            <span>${statusText}</span>
                        </div>
                        <div class="progress-bar ${item.status === 'completed' ? 'hidden' : ''}">
                            <div class="progress" style="width: 0%"></div>
                        </div>
                    </div>
                `;
            } else {
                content = `
                    <div class="item-icon"><i class="fas ${iconClass}"></i></div>
                    <div class="item-content">
                        <div class="item-preview">${item.preview}</div>
                        <div class="item-info">
                            <span class="item-time">${timestamp}</span>
                        </div>
                        <div class="item-status">
                            <i class="fas ${directionIcon}"></i>
                            <span>${statusText}</span>
                        </div>
                    </div>
                `;
            }
            
            historyItem.innerHTML = content;
            
            // 为文字消息添加点击事件，点击时复制到剪贴板
            if (item.type === 'text') {
                historyItem.addEventListener('click', () => {
                    this.copyToClipboard(item.content);
                    this.showNotification('已复制文字到剪贴板');
                });
            }
            
            // 为文件添加重新下载功能（如果是接收的文件）
            if (item.type === 'file' && item.direction === 'in' && item.status === 'completed') {
                const downloadButton = document.createElement('button');
                downloadButton.className = 'download-button';
                downloadButton.innerHTML = '<i class="fas fa-download"></i>';
                downloadButton.title = '重新下载';
                downloadButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // 这里需要处理文件重新下载的逻辑
                    // 由于我们可能没有保存文件内容，所以这个功能可能需要服务器支持
                });
                historyItem.querySelector('.item-content').appendChild(downloadButton);
            }
            
            historyList.appendChild(historyItem);
        });
    },
    
    // 更新传输进度
    updateTransferProgress(fileId, progress) {
        const historyItem = document.querySelector(`.history-item[data-id="${fileId}"]`);
        if (historyItem) {
            const progressBar = historyItem.querySelector('.progress');
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
        }
    },
    
    // 更新历史项目状态
    updateHistoryItemStatus(itemId, status) {
        // 更新内存中的数据
        const item = this.transferHistory.find(i => i.id === itemId);
        if (item) {
            item.status = status;
        }
        
        // 更新DOM
        const historyItem = document.querySelector(`.history-item[data-id="${itemId}"]`);
        if (historyItem) {
            // 移除所有状态类
            historyItem.classList.remove('pending', 'receiving', 'sending', 'completed', 'failed');
            // 添加新状态类
            historyItem.classList.add(status);
            
            // 更新状态文本
            const statusElement = historyItem.querySelector('.item-status span');
            if (statusElement) {
                let statusText = '';
                switch (status) {
                    case 'pending': statusText = '准备中'; break;
                    case 'receiving': statusText = '接收中'; break;
                    case 'sending': statusText = '发送中'; break;
                    case 'completed': statusText = '已完成'; break;
                    case 'failed': statusText = '失败'; break;
                    default: statusText = status;
                }
                statusElement.textContent = statusText;
            }
            
            // 隐藏进度条（如果完成或失败）
            if (status === 'completed' || status === 'failed') {
                const progressBar = historyItem.querySelector('.progress-bar');
                if (progressBar) {
                    progressBar.classList.add('hidden');
                }
            }
        }
    },
    
    // 设置Socket事件监听
    setupSocketEvents() {
        if (!window.socket) return;
        
        // 先检查socket连接状态
        if (!window.socket.connected) {
            console.warn('Socket未连接，尝试重新连接...');
            window.socket.connect();
            
            // 延迟执行绑定
            setTimeout(() => this.setupSocketEvents(), 1000);
            return;
        }
        
        console.log('开始设置文件传输事件监听器...');
        
        // 先清除所有可能存在的监听器，避免重复监听
        window.socket.off('file_transfer_room_joined');
        window.socket.off('file_transfer_room_client_update');
        window.socket.off('file_transfer_offer');
        window.socket.off('file_chunk');
        window.socket.off('file_transfer_complete');
        window.socket.off('text_transfer');
        
        // 绑定新的监听器
        window.socket.on('file_transfer_room_joined', (data) => {
            console.log(`加入房间成功: ${data.roomName}, ${data.clients}人在线`);
            this.currentRoom = data.roomName;
            document.getElementById('connection-info').textContent = `已连接到房间: ${data.roomName} (${data.clients}人在线)`;
            this.showNotification(`已加入房间: ${data.roomName}`);
        });
        
        window.socket.on('file_transfer_room_client_update', (data) => {
            if (this.currentRoom === data.roomName) {
                console.log(`房间人数更新: ${data.roomName}, ${data.clients}人在线`);
                document.getElementById('connection-info').textContent = `已连接到房间: ${data.roomName} (${data.clients}人在线)`;
            }
        });
        
        window.socket.on('file_transfer_offer', (fileInfo) => {
            console.log(`收到文件传输请求: ${fileInfo.name} (${fileInfo.id})`);
            this.receiveFile(fileInfo);
        });
        
        window.socket.on('file_chunk', (data) => {
            // 只记录第一个和最后一个块以减少日志量
            const { chunkIndex, totalChunks, fileId } = data;
            if (chunkIndex === 0 || chunkIndex === totalChunks - 1) {
                console.log(`收到文件块: ${fileId}, ${chunkIndex + 1}/${totalChunks}`);
            }
            this.receiveFileChunk(data);
        });
        
        window.socket.on('file_transfer_complete', (data) => {
            console.log(`收到文件传输完成信号: ${data.fileId}`);
            // 检查如果文件缓冲区还在处理中，则手动触发完成
            const fileBuffer = window.fileTransferModule.fileBuffers[data.fileId];
            if (fileBuffer && !fileBuffer.finalized) {
                console.log(`手动触发文件完成处理: ${data.fileId}`);
                // 检查是否已接收所有块
                const totalChunks = fileBuffer.chunks.length;
                const receivedChunks = fileBuffer.chunks.filter(c => c).length;
                
                if (receivedChunks === totalChunks) {
                    this.finalizeFileTransfer(data.fileId);
                } else {
                    console.warn(`文件 ${data.fileId} 块接收不完整: ${receivedChunks}/${totalChunks}`);
                }
            }
        });
        
        window.socket.on('text_transfer', (textInfo) => {
            console.log(`收到文字传输: ${textInfo.id}`);
            this.receiveText(textInfo);
        });
        
        // 添加重连和断开事件
        window.socket.on('connect', () => {
            console.log('Socket连接已建立，可以传输文件');
            // 如果有房间信息，重新加入房间
            if (this.currentRoom) {
                setTimeout(() => {
                    console.log(`尝试重新加入房间: ${this.currentRoom}`);
                    window.socket.emit('join_file_transfer_room', { roomName: this.currentRoom });
                }, 500);
            }
        });
        
        window.socket.on('disconnect', () => {
            console.log('Socket连接已断开，文件传输可能中断');
        });
        
        console.log('文件传输事件监听器已重新初始化');
    },
    
    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // 生成唯一ID
    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },
    
    // 复制文本到剪贴板
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('无法复制到剪贴板:', err);
            
            // 使用传统方法作为备选
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        });
    },
    
    // 显示通知
    showNotification(message) {
        // 显示通知的方法，可以复用现有的窗口通知系统
        if (window.utils && window.utils.showNotification) {
            window.utils.showNotification(message);
        } else {
            // 创建一个简单的通知
            const notification = document.createElement('div');
            notification.className = 'file-transfer-notification';
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 500);
            }, 3000);
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化文件传输模块，确保其他模块已加载
    setTimeout(() => {
        window.fileTransferModule.init();
    }, 1000);
}); 