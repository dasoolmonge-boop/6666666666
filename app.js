// app.js - Сервер для мини-приложения
const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ADMIN_ID = 1066867845; // ID администратора в Telegram
const BOT_TOKEN = "8714739961:AAG9l-7-G7duRNKuNtarP7rTchfvZQFCMxo"; // Токен для уведомлений

// MIME типы для статических файлов
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Файл для хранения данных
const DB_FILE = path.join(__dirname, 'db.json');
// Папка для загруженных изображений
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// Создаем папку для загрузок, если её нет
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Инициализация базы данных
function initDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            cakes: [
                {
                    id: 1,
                    name: 'Медовик',
                    price: 2500,
                    weight: 1.5,
                    description: 'Классический медовый торт с нежным кремом',
                    photo: '/uploads/medovik.jpg',
                    available: true
                },
                {
                    id: 2,
                    name: 'Наполеон',
                    price: 2800,
                    weight: 1.8,
                    description: 'Хрустящие коржи с заварным кремом',
                    photo: '/uploads/napoleon.jpg',
                    available: true
                },
                {
                    id: 3,
                    name: 'Красный бархат',
                    price: 3200,
                    weight: 2.0,
                    description: 'Красные коржи с сливочно-сырным кремом',
                    photo: '/uploads/red-velvet.jpg',
                    available: true
                }
            ],
            orders: [],
            nextCakeId: 4,
            nextOrderId: 1
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
}

// Чтение данных из БД
function readDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Ошибка чтения БД:', error);
        return { cakes: [], orders: [], nextCakeId: 1, nextOrderId: 1 };
    }
}

// Запись данных в БД
function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Ошибка записи БД:', error);
        return false;
    }
}

// Инициализируем БД при старте
initDB();

const server = http.createServer((req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // ============================================
    // API ДЛЯ ЗАГРУЗКИ ФОТО
    // ============================================

    if (pathname === '/api/upload' && req.method === 'POST') {
        const boundary = req.headers['content-type'].split('boundary=')[1];
        let body = [];

        req.on('data', chunk => {
            body.push(chunk);
        }).on('end', () => {
            try {
                const buffer = Buffer.concat(body);
                const text = buffer.toString('binary');

                // Ищем имя файла
                const filenameMatch = text.match(/filename="(.+?)"/);
                const filename = filenameMatch ? filenameMatch[1] : `photo_${Date.now()}.jpg`;

                // Ищем содержимое файла
                const fileDataStart = buffer.indexOf('\r\n\r\n') + 4;
                const fileDataEnd = buffer.lastIndexOf('\r\n--' + boundary);

                if (fileDataStart !== -1 && fileDataEnd !== -1) {
                    const fileData = buffer.slice(fileDataStart, fileDataEnd);

                    // Генерируем уникальное имя файла
                    const ext = path.extname(filename) || '.jpg';
                    const newFilename = `cake_${Date.now()}${ext}`;
                    const filePath = path.join(UPLOAD_DIR, newFilename);

                    // Сохраняем файл
                    fs.writeFileSync(filePath, fileData);

                    const fileUrl = `/uploads/${newFilename}`;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        url: fileUrl,
                        filename: newFilename
                    }));
                } else {
                    throw new Error('Не удалось извлечь данные файла');
                }
            } catch (error) {
                console.error('Ошибка загрузки файла:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Ошибка загрузки файла' }));
            }
        });
        return;
    }

    // ============================================
    // API ДЛЯ ТОРТОВ
    // ============================================

    // Получить все доступные торты (для клиентов)
    if (pathname === '/api/cakes' && req.method === 'GET') {
        const db = readDB();
        const availableCakes = db.cakes.filter(c => c.available);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(availableCakes));
        return;
    }

    // Получить все торты (для админа)
    if (pathname === '/api/admin/cakes' && req.method === 'GET') {
        const db = readDB();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(db.cakes));
        return;
    }

    // Добавить новый торт (админ)
    if (pathname === '/api/admin/cakes' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const cakeData = JSON.parse(body);
                const db = readDB();

                const newCake = {
                    id: db.nextCakeId++,
                    ...cakeData,
                    available: true
                };

                db.cakes.push(newCake);

                if (writeDB(db)) {
                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(newCake));
                } else {
                    throw new Error('Ошибка сохранения');
                }
            } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Ошибка сервера' }));
            }
        });
        return;
    }

    // Обновить торт (админ)
    if (pathname.startsWith('/api/admin/cakes/') && req.method === 'PUT') {
        const cakeId = parseInt(pathname.split('/').pop());
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const updates = JSON.parse(body);
                const db = readDB();

                const cakeIndex = db.cakes.findIndex(c => c.id === cakeId);
                if (cakeIndex === -1) {
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Торт не найден' }));
                    return;
                }

                db.cakes[cakeIndex] = { ...db.cakes[cakeIndex], ...updates };

                if (writeDB(db)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(db.cakes[cakeIndex]));
                } else {
                    throw new Error('Ошибка сохранения');
                }
            } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Ошибка сервера' }));
            }
        });
        return;
    }

    // Удалить торт (админ)
    if (pathname.startsWith('/api/admin/cakes/') && req.method === 'DELETE') {
        const cakeId = parseInt(pathname.split('/').pop());
        const db = readDB();

        // Удаляем фото торта
        const cake = db.cakes.find(c => c.id === cakeId);
        if (cake && cake.photo && cake.photo.startsWith('/uploads/')) {
            const photoPath = path.join(__dirname, 'public', cake.photo);
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
            }
        }

        db.cakes = db.cakes.filter(c => c.id !== cakeId);

        if (writeDB(db)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } else {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Ошибка сохранения' }));
        }
        return;
    }

    // ============================================
    // API ДЛЯ ЗАКАЗОВ
    // ============================================

    // Создать заказ
    if (pathname === '/api/orders' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const orderData = JSON.parse(body);
                const db = readDB();

                const newOrder = {
                    id: db.nextOrderId++,
                    ...orderData,
                    status: 'active',
                    createdAt: new Date().toISOString()
                };

                db.orders.push(newOrder);

                if (writeDB(db)) {
                    // Отправляем уведомление админу в Telegram
                    sendOrderToAdmin(newOrder);

                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, orderId: newOrder.id }));
                } else {
                    throw new Error('Ошибка сохранения');
                }
            } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Ошибка сервера' }));
            }
        });
        return;
    }

    // Получить все заказы (админ)
    if (pathname === '/api/admin/orders' && req.method === 'GET') {
        const db = readDB();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(db.orders));
        return;
    }

    // Получить заказы по статусу (админ)
    if (pathname === '/api/admin/orders/active' && req.method === 'GET') {
        const db = readDB();
        const activeOrders = db.orders.filter(o => o.status === 'active');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(activeOrders));
        return;
    }

    if (pathname === '/api/admin/orders/history' && req.method === 'GET') {
        const db = readDB();
        const historyOrders = db.orders.filter(o => o.status !== 'active');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(historyOrders));
        return;
    }

    // Обновить статус заказа (админ)
    if (pathname.startsWith('/api/admin/orders/') && req.method === 'PUT') {
        const orderId = parseInt(pathname.split('/').pop());
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const updates = JSON.parse(body);
                const db = readDB();

                const orderIndex = db.orders.findIndex(o => o.id === orderId);
                if (orderIndex === -1) {
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Заказ не найден' }));
                    return;
                }

                db.orders[orderIndex] = { ...db.orders[orderIndex], ...updates };

                if (writeDB(db)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(db.orders[orderIndex]));
                } else {
                    throw new Error('Ошибка сохранения');
                }
            } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Ошибка сервера' }));
            }
        });
        return;
    }

    // Проверка прав администратора
    if (pathname === '/api/check-admin' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { userId } = JSON.parse(body);
                const isAdminUser = userId === ADMIN_ID;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ isAdmin: isAdminUser }));
            } catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // ============================================
    // РАЗДАЧА СТАТИЧЕСКИХ ФАЙЛОВ
    // ============================================

    // Определяем, какой файл отдавать
    let filePath;
    if (pathname === '/') {
        filePath = path.join(__dirname, 'public', 'index.html');
    } else if (pathname === '/admin') {
        filePath = path.join(__dirname, 'public', 'admin.html');
    } else {
        filePath = path.join(__dirname, 'public', pathname);
    }

    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'text/plain';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // Если файл не найден, отдаем index.html
                fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, content) => {
                    if (err) {
                        res.writeHead(404);
                        res.end('Файл не найден');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end(`Ошибка сервера: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Функция отправки уведомления админу
function sendOrderToAdmin(orderData) {
    const { name, phone, address, deliveryDate, deliveryTime, wish, cart, totalPrice, userId, username } = orderData;

    const cakesList = cart.map(item =>
        `🍰 ${item.name} - ${item.price} ₽ (${item.weight} кг)`
    ).join('\n');

    // Определяем домен для ссылки
    const protocol = 'https';
    const host = 'cake-shop.bothost.ru'; // ЗАМЕНИТЕ НА ВАШ РЕАЛЬНЫЙ ДОМЕН
    const adminLink = `${protocol}://${host}/admin`;

    const message =
        `📩 **НОВЫЙ ЗАКАЗ ИЗ MINI APP**\n\n` +
        `🍰 **Торты:**\n${cakesList}\n` +
        `💰 **Итого:** ${totalPrice} ₽\n\n` +
        `👤 **Имя:** ${name}\n` +
        `🆔 **Username:** ${username ? '@' + username : 'нет'}\n` +
        `📱 **Телефон:** ${phone}\n` +
        `📍 **Адрес:** ${address}\n` +
        `📅 **Дата доставки:** ${deliveryDate}\n` +
        `⏰ **Время доставки:** ${deliveryTime}\n` +
        `📝 **Пожелания:** ${wish || 'Без пожеланий'}\n` +
        `🆔 **User ID:** ${userId}\n` +
        `📅 **Дата заказа:** ${new Date().toLocaleString('ru-RU')}\n\n` +
        `👑 **Управление заказами:** ${adminLink}`;

    const postData = JSON.stringify({
        chat_id: ADMIN_ID,
        text: message,
        parse_mode: 'Markdown'
    });

    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            console.log('Уведомление админу отправлено');
        });
    });

    req.on('error', (error) => {
        console.error('Ошибка отправки уведомления:', error);
    });

    req.write(postData);
    req.end();
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Mini App сервер запущен на порту ${PORT}`);
    console.log(`📱 Главная страница: http://localhost:${PORT}`);
    console.log(`👑 Админ-панель: http://localhost:${PORT}/admin`);
    console.log(`💾 Данные сохраняются в: ${DB_FILE}`);
    console.log(`📸 Загрузки сохраняются в: ${UPLOAD_DIR}`);
});