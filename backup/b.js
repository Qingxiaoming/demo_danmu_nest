//test1 

const fs = require('fs')
const axios = require('axios');
const http = require('http')
const express = require('express')
const WebSocket = require('ws');
const path = require('path');
const mysql = require('mysql');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
};
// 存储已打印的弹幕 ID
const printedDanmuIds = new Set();

// B站用户 UID 和会话对象 UID
const USER_UID = '359491411';
const TALKER_ID = '673536698';

 //白夜'9938996';
 //我的'23415751'
 const roomId = '23415751';

// 存储已打印的弹幕数据
const updatedData = {
    uid:[],
    nickname:[],
    text:[], 
    createtime:[], 
    status:[],
    account:[],
    password:[]
}

//链接数据库
const connection = mysql.createConnection({
    host : '127.0.0.1',
    user : 'root',
    password : 'admin123',
    database : 'b_schema'
});
connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to the database');
});



// WebSocket 服务器
wss.on('connection', (ws) => {
    console.log('客户端已连接');
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('收到的 WebSocket 消息:', data);
            const action = data.action;
            const uid = data.index;

            // 根据 action 类型执行不同的操作
            switch (action) {
                case 'delete':
                    const deleteSql = 'UPDATE now_queue SET status = ? WHERE uid = ?';
                    const deleteParams = ['deleted', uid];
                    connection.query(deleteSql, deleteParams, (err, result) => {
                        if (err) {
                            console.error('数据库更新失败:', err);
                            ws.send(JSON.stringify({ error: '删除失败' }));
                        } else {
                            console.log('删除成功:', result);
                            ws.send(JSON.stringify({ success: '删除成功' }));
                        }
                    });
                    break;

                case 'completed':
                    const completedSql = 'UPDATE now_queue SET status = ? WHERE uid = ?';
                    const completedParams = ['completed', uid];
                    connection.query(completedSql, completedParams, (err, result) => {
                        if (err) {
                            console.error('数据库更新失败:', err);
                            ws.send(JSON.stringify({ error: '标记为已完成失败' }));
                        } else {
                            console.log('标记为已完成成功:', result);
                            ws.send(JSON.stringify({ success: '标记为已完成成功' }));
                        }
                    });
                    break;

                case 'edit':
                    const newText = data.text;
                    if (!newText) {
                        console.error('编辑操作需要提供新的文本内容');
                        ws.send(JSON.stringify({ error: '编辑失败：缺少文本内容' }));
                        return;
                    }
                    const editSql = 'UPDATE now_queue SET text = ? WHERE uid = ?';
                    const editParams = [newText, uid];
                    connection.query(editSql, editParams, (err, result) => {
                        if (err) {
                            console.error('数据库更新失败:', err);
                            ws.send(JSON.stringify({ error: '编辑失败' }));
                        } else {
                            console.log('编辑成功:', result);
                            ws.send(JSON.stringify({ success: '编辑成功' }));
                        }
                    });
                    break;

                case 'get_acps':
                    const getAcpsSql = 'SELECT account, password FROM now_queue WHERE uid = ?';
                    connection.query(getAcpsSql, uid, (err, results) => {
                        if (err) {
                            console.error('查询账号密码失败:', err);
                            ws.send(JSON.stringify({ action: 'get_acps', data:1}));
                            //client.send(JSON.stringify(updatedData));
                        } else {
                            console.log(`-------${JSON.stringify(results)}`);
                            ws.send(JSON.stringify({ action: 'get_acps', data: results ,uid:uid}));
                        }
                    });
                    break;

                case 'update_acps':
                    console.error('nihuozhem');
                    const updateAcpsSql = 'UPDATE now_queue SET account = ?, password = ? WHERE uid = ? ';
                    const [account, password] = data.text.split(' / ');
                    const updateAcpsParams = [account, password, uid];
                    connection.query(updateAcpsSql, updateAcpsParams, (err, result) => {
                        if (err) {
                            console.error('更新账号密码失败:', err);
                            ws.send(JSON.stringify({ action: 'update_acps', success: false }));
                        } else {
                            ws.send(JSON.stringify({ action: 'update_acps', success: true }));
                        }
                    });
                    break;

                default:
                    console.error('未知的操作类型:', action);
                    ws.send(JSON.stringify({ error: '未知的操作类型' }));
                    break;
            }
        } catch (error) {
            console.error('解析 WebSocket 消息失败:', error);
            ws.send(JSON.stringify({ error: '无效的消息格式' }));
        }
    });
});



// 更新数组并通知所有客户端
function updateData() {
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            //fetchDataAndPrint('now_queue');
            const sql = `
                SELECT uid, nickname, text, createtime, status
                FROM now_queue
            `;
            //WHERE status != 'deleted' AND status != 'completed'
            connection.query(sql, (err, results) => {
                if (err) {
                    console.error('从数据库获取弹幕数据失败:', err);
                    return;
                }
                updatedData.uid = results.map(item => item.uid);
                updatedData.nickname = results.map(item => item.nickname);
                updatedData.text = results.map(item => item.text);
                updatedData.createtime = results.map(item => item.createtime);
                updatedData.status = results.map(item => item.status);
                updatedData.account = results.map(item => item.account);
                updatedData.password = results.map(item => item.password);
            });
            //console.log(`-------${JSON.stringify(updatedData)}`);
            client.send(JSON.stringify(updatedData));
        }
    });
}

//保存函数
async function checkAndSaveDanmu(uid,nickname, text,createtime) {
    const status = 'waiting'; // 默认状态为 waiting

    const sql = `
        INSERT INTO now_queue (uid, nickname, text, createtime, status)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        nickname = VALUES(nickname),
        text = VALUES(text),
        createtime = VALUES(createtime),
        status = VALUES(status)
    `;
    connection.query(sql, [uid, nickname, text, createtime, status], (err, result) => {
        if (err) {
            console.error('保存弹幕到数据库失败:', err);
        } else {
            console.log('弹幕保存成功:', result.insertId);
        }
    });
}


// 获取弹幕并存入数据库
async function getDanmuData(para1) {
    try {
        const response = await axios.get(`https://api.live.bilibili.com/xlive/web-room/v1/dM/gethistory?roomid= ${roomId}&room_type=0`, { headers });
        const data = response.data.data.room;
        if (data && data.length > 0) {
            data.forEach(item => {
                const danmuId = item.id_str; // 弹幕的唯一标识符
                if (!printedDanmuIds.has(danmuId)) {
                    const nickname = item.nickname; // 发送弹幕的用户名
                    const uid = item.uid; // 发送弹幕的用户 ID
                    const text = item.text; // 弹幕内容
                    const createtime = item.timeline; // 弹幕发送时间
                    console.log(`nickname: ${nickname}, time: ${createtime}, text: ${text}`);
                    // 检查弹幕并存档
                    if (text.includes("晚安")) {
                        // 如果包含特定字符串，执行存档操作
                        checkAndSaveDanmu(uid, nickname, text, createtime);
                    }
                    // 将弹幕 ID 添加到已打印集合中
                    printedDanmuIds.add(danmuId);
                }
            });
        } else {
            console.log('没有获取到弹幕数据');
        }
    } catch (error) {
        console.error('请求弹幕数据失败:', error);
    }
}

setInterval(() => {
    //console.log('获取弹幕数据...');
    getDanmuData("晚安");
}, 5000);

setInterval(() => {
    //console.log('更新数据...');
    updateData();
}, 500);


fs.readFile(__dirname + '/files/11.txt', 'utf8', function(err, dataStr) {
    if (err) {
      return console.log('读取文件失败！' + err.message)
    }
    console.log('读取文件成功！' + dataStr)
  })

// 监听客户端的 GET 和 POST 请求，并向客户端响应具体的内容
app.get('/user', (req, res) => {
    res.send({ name: 'zs', age: 20, gender: '男' });
});

app.post('/user', (req, res) => {
    res.send('请求成功');
});

app.get('/', (req, res) => {
  console.log(req.query);
  res.sendFile(path.join(__dirname, 'index.html')); 
});

app.get('/user/:ids/:username', (req, res) => {
    console.log(req.params);
    res.send(req.params.username);
});



const PORT = 80;
server.listen(PORT, () => {
    console.log(`WebSocket  server running at http://127.0.0.1:${PORT}`);
});








//打印表
function fetchDataAndPrint(tableName) {
    const sql = `SELECT * FROM ${tableName};`;

    connection.query(sql, (err, results) => {
        if (err) {
            console.error('查询数据失败:', err);
            return;
        }

        if (results.length === 0) {
            console.log('表中没有数据');
        } else {
            console.log(`表 ${tableName} 的数据：`);
            results.forEach((row, index) => {
                console.log(`第 ${index + 1} 条数据：`, row);
            });
        }
    });
}
