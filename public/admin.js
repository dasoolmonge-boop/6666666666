// admin.js - Логика админ-панели

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let currentUser = tg.initDataUnsafe.user || {};
let isAdmin = false;
let currentOrdersTab = 'active';

// Проверка прав администратора
async function checkAdmin() {
    try {
        const response = await fetch('/api/check-admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: currentUser.id })
        });

        const data = await response.json();
        isAdmin = data.isAdmin;

        if (!isAdmin) {
            showToast('У вас нет прав доступа к админ-панели', 'error');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            loadCakes();
            loadOrders();
            loadStats();
        }
    } catch (error) {
        console.error('Ошибка проверки прав:', error);
    }
}

// Переключение основных вкладок
function switchTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));

    document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');
    document.getElementById(`${tab}-section`).classList.add('active');

    if (tab === 'cakes') loadCakes();
    if (tab === 'orders') loadOrders();
    if (tab === 'stats') loadStats();
}

// Переключение вкладок заказов
function switchOrdersTab(tab) {
    currentOrdersTab = tab;

    document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.orders-tab-content').forEach(c => c.classList.remove('active'));

    document.querySelector(`[onclick="switchOrdersTab('${tab}')"]`).classList.add('active');
    document.getElementById(`${tab}-orders`).classList.add('active');

    loadOrders();
}

// Предпросмотр фото
function previewPhoto(input, previewId) {
    const preview = document.getElementById(previewId);

    if (input.files && input.files[0]) {
        const reader = new FileReader();

        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.classList.add('show');
        }

        reader.readAsDataURL(input.files[0]);
    }
}

// Загрузка фото на сервер
async function uploadPhoto(file) {
    const formData = new FormData();
    formData.append('photo', file);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            return data.url;
        } else {
            throw new Error('Ошибка загрузки');
        }
    } catch (error) {
        console.error('Ошибка загрузки фото:', error);
        showToast('Ошибка при загрузке фото', 'error');
        return null;
    }
}

// Загрузка тортов для админа
async function loadCakes() {
    try {
        const response = await fetch('/api/admin/cakes');
        const cakes = await response.json();
        renderAdminCakes(cakes);
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showToast('Ошибка загрузки тортов', 'error');
    }
}

// Отрисовка тортов в админке
function renderAdminCakes(cakes) {
    const grid = document.getElementById('adminCakesGrid');

    if (cakes.length === 0) {
        grid.innerHTML = '<div class="empty-cart">Торты не добавлены</div>';
        return;
    }

    grid.innerHTML = cakes.map(cake => `
        <div class="cake-card admin-card ${!cake.available ? 'unavailable' : ''}">
            <img src="${cake.photo}" alt="${cake.name}" class="cake-image"
                 onerror="this.src='https://via.placeholder.com/200?text=Торт'">
            <div class="cake-actions">
                <button class="cake-action-btn edit" onclick="editCake(${cake.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="cake-action-btn toggle" onclick="toggleCakeAvailability(${cake.id})">
                    <i class="fas ${cake.available ? 'fa-eye' : 'fa-eye-slash'}"></i>
                </button>
                <button class="cake-action-btn delete" onclick="deleteCake(${cake.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="cake-info">
                <div class="cake-name">${cake.name}</div>
                <div class="cake-price">${cake.price} ₽</div>
                <div class="cake-weight">⚖️ ${cake.weight} кг</div>
                <div class="cake-description">${cake.description}</div>
                <div class="cake-status">
                    Статус: ${cake.available ? '✅ Доступен' : '❌ Недоступен'}
                </div>
            </div>
        </div>
    `).join('');
}

// Добавление нового торта
async function addCake(event) {
    event.preventDefault();

    const photoInput = document.getElementById('cakePhotoInput');

    if (!photoInput.files || !photoInput.files[0]) {
        showToast('Выберите фото торта', 'error');
        return;
    }

    const submitBtn = event.target.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';

    try {
        // Сначала загружаем фото
        const photoUrl = await uploadPhoto(photoInput.files[0]);

        if (!photoUrl) {
            throw new Error('Ошибка загрузки фото');
        }

        const cakeData = {
            name: document.getElementById('cakeName').value,
            price: parseInt(document.getElementById('cakePrice').value),
            weight: parseFloat(document.getElementById('cakeWeight').value),
            description: document.getElementById('cakeDescription').value,
            photo: photoUrl
        };

        const response = await fetch('/api/admin/cakes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cakeData)
        });

        if (response.ok) {
            showToast('Торт успешно добавлен!', 'success');
            document.getElementById('addCakeForm').reset();
            document.getElementById('cakePhotoPreview').classList.remove('show');
            loadCakes();

            if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
        }
    } catch (error) {
        console.error('Ошибка добавления:', error);
        showToast('Ошибка при добавлении торта', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Добавить торт';
    }
}

// Редактирование торта
async function editCake(cakeId) {
    try {
        const response = await fetch('/api/admin/cakes');
        const cakes = await response.json();
        const cake = cakes.find(c => c.id === cakeId);

        if (cake) {
            document.getElementById('editCakeId').value = cake.id;
            document.getElementById('editCakeName').value = cake.name;
            document.getElementById('editCakePrice').value = cake.price;
            document.getElementById('editCakeWeight').value = cake.weight;
            document.getElementById('editCakeDescription').value = cake.description;
            document.getElementById('editCakePhoto').value = cake.photo;

            // Показываем превью текущего фото
            const preview = document.getElementById('editCakePhotoPreview');
            preview.src = cake.photo;
            preview.classList.add('show');

            document.getElementById('editCakeModal').classList.add('open');
        }
    } catch (error) {
        console.error('Ошибка загрузки данных торта:', error);
        showToast('Ошибка загрузки данных', 'error');
    }
}

// Сохранение изменений торта
async function saveCakeEdit(event) {
    event.preventDefault();

    const cakeId = document.getElementById('editCakeId').value;
    const photoInput = document.getElementById('editCakePhotoInput');
    let photoUrl = document.getElementById('editCakePhoto').value;

    const submitBtn = event.target.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';

    try {
        // Если выбрано новое фото, загружаем его
        if (photoInput.files && photoInput.files[0]) {
            const newPhotoUrl = await uploadPhoto(photoInput.files[0]);
            if (newPhotoUrl) {
                photoUrl = newPhotoUrl;
            }
        }

        const cakeData = {
            name: document.getElementById('editCakeName').value,
            price: parseInt(document.getElementById('editCakePrice').value),
            weight: parseFloat(document.getElementById('editCakeWeight').value),
            description: document.getElementById('editCakeDescription').value,
            photo: photoUrl
        };

        const response = await fetch(`/api/admin/cakes/${cakeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cakeData)
        });

        if (response.ok) {
            showToast('Изменения сохранены!', 'success');
            closeEditModal();
            loadCakes();

            if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
        }
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showToast('Ошибка при сохранении', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Сохранить изменения';
    }
}

// Переключение доступности торта
async function toggleCakeAvailability(cakeId) {
    try {
        const response = await fetch('/api/admin/cakes');
        const cakes = await response.json();
        const cake = cakes.find(c => c.id === cakeId);

        const updateResponse = await fetch(`/api/admin/cakes/${cakeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ available: !cake.available })
        });

        if (updateResponse.ok) {
            showToast(`Торт ${cake.available ? 'скрыт' : 'опубликован'}`, 'success');
            loadCakes();
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка при изменении статуса', 'error');
    }
}

// Удаление торта
async function deleteCake(cakeId) {
    if (!confirm('Вы уверены, что хотите удалить этот торт?')) return;

    try {
        const response = await fetch(`/api/admin/cakes/${cakeId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Торт удален', 'success');
            loadCakes();

            if (tg.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
        }
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showToast('Ошибка при удалении', 'error');
    }
}

// Закрытие модального окна редактирования
function closeEditModal() {
    document.getElementById('editCakeModal').classList.remove('open');
    document.getElementById('editCakeForm').reset();
    document.getElementById('editCakePhotoPreview').classList.remove('show');
}

// Загрузка заказов
async function loadOrders() {
    try {
        // Загружаем активные заказы
        const activeResponse = await fetch('/api/admin/orders/active');
        const activeOrders = await activeResponse.json();

        // Загружаем историю заказов
        const historyResponse = await fetch('/api/admin/orders/history');
        const historyOrders = await historyResponse.json();

        // Обновляем счетчики
        document.getElementById('activeOrdersCount').textContent = activeOrders.length;
        document.getElementById('historyOrdersCount').textContent = historyOrders.length;

        // Отображаем заказы в зависимости от выбранной вкладки
        if (currentOrdersTab === 'active') {
            renderOrders(activeOrders, 'activeOrdersList');
        } else {
            renderOrders(historyOrders, 'historyOrdersList');
        }
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
    }
}

// Отрисовка заказов
function renderOrders(orders, containerId) {
    const container = document.getElementById(containerId);

    if (orders.length === 0) {
        container.innerHTML = '<div class="empty-cart">Нет заказов</div>';
        return;
    }

    // Сортируем по дате (новые сверху)
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let html = '<div class="orders-grid">';

    orders.forEach(order => {
        const statusText = getStatusText(order.status);
        const statusClass = getStatusClass(order.status);

        html += `
            <div class="order-card">
                <div class="order-header">
                    <span class="order-id">#${order.id}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="order-info">
                    <div><i class="fas fa-user"></i> ${order.name}</div>
                    <div><i class="fas fa-phone"></i> ${order.phone}</div>
                    <div><i class="fas fa-map-marker-alt"></i> ${order.address}</div>
                    <div><i class="fas fa-calendar"></i> ${order.deliveryDate} ${order.deliveryTime}</div>
                    <div><i class="fas fa-comment"></i> ${order.wish}</div>
                    <div class="order-cakes">
                        ${order.cart.map(item => `
                            <div class="order-cake-item">
                                <span>${item.name} × ${item.quantity}</span>
                                <span>${item.price * item.quantity} ₽</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="order-total">Итого: ${order.totalPrice} ₽</div>
                    <div class="order-date">${new Date(order.createdAt).toLocaleString()}</div>
                </div>
                ${order.status === 'active' ? `
                    <div class="order-actions">
                        <button onclick="updateOrderStatus(${order.id}, 'processing')" class="action-btn processing-btn">
                            <i class="fas fa-play"></i> В обработку
                        </button>
                        <button onclick="updateOrderStatus(${order.id}, 'completed')" class="action-btn complete-btn">
                            <i class="fas fa-check"></i> Выполнен
                        </button>
                        <button onclick="updateOrderStatus(${order.id}, 'cancelled')" class="action-btn cancel-btn">
                            <i class="fas fa-times"></i> Отменить
                        </button>
                    </div>
                ` : order.status === 'processing' ? `
                    <div class="order-actions">
                        <button onclick="updateOrderStatus(${order.id}, 'completed')" class="action-btn complete-btn">
                            <i class="fas fa-check"></i> Выполнен
                        </button>
                        <button onclick="updateOrderStatus(${order.id}, 'cancelled')" class="action-btn cancel-btn">
                            <i class="fas fa-times"></i> Отменить
                        </button>
                    </div>
                ` : order.status === 'cancelled' ? `
                    <div class="order-actions">
                        <button onclick="updateOrderStatus(${order.id}, 'active')" class="action-btn restore-btn">
                            <i class="fas fa-undo"></i> Восстановить
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// Обновление статуса заказа
async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`/api/admin/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            showToast(`Статус заказа обновлен`, 'success');
            loadOrders();
            loadStats();

            if (tg.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('medium');
            }
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка при обновлении статуса', 'error');
    }
}

// Загрузка статистики
async function loadStats() {
    try {
        const response = await fetch('/api/admin/orders');
        const orders = await response.json();

        const activeOrders = orders.filter(o => o.status === 'active' || o.status === 'processing').length;
        const completedOrders = orders.filter(o => o.status === 'completed');
        const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const avgOrder = completedOrders.length ? Math.round(totalRevenue / completedOrders.length) : 0;

        // Подсчет популярных тортов
        const cakeCount = {};
        orders.forEach(order => {
            if (order.cart) {
                order.cart.forEach(item => {
                    cakeCount[item.name] = (cakeCount[item.name] || 0) + item.quantity;
                });
            }
        });

        let popularCake = 'Нет данных';
        let maxCount = 0;
        for (const [name, count] of Object.entries(cakeCount)) {
            if (count > maxCount) {
                maxCount = count;
                popularCake = name;
            }
        }

        document.getElementById('totalOrders').textContent = orders.length;
        document.getElementById('activeOrders').textContent = activeOrders;
        document.getElementById('completedOrders').textContent = completedOrders.length;
        document.getElementById('totalRevenue').textContent = `${totalRevenue} ₽`;
        document.getElementById('avgOrder').textContent = `${avgOrder} ₽`;
        document.getElementById('popularCake').textContent = popularCake;

        // График заказов по дням
        createOrdersChart(orders);

    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Создание графика заказов
function createOrdersChart(orders) {
    const ctx = document.getElementById('ordersChart').getContext('2d');

    // Группировка по дням
    const last7Days = [];
    const counts = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('ru-RU');
        last7Days.push(dateStr);

        const count = orders.filter(o => {
            const orderDate = new Date(o.createdAt).toLocaleDateString('ru-RU');
            return orderDate === dateStr;
        }).length;

        counts.push(count);
    }

    // Удаляем старый график, если есть
    if (window.ordersChart) {
        window.ordersChart.destroy();
    }

    window.ordersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Заказы',
                data: counts,
                borderColor: '#50a8eb',
                backgroundColor: 'rgba(80, 168, 235, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Вспомогательные функции
function getStatusText(status) {
    const statusMap = {
        'active': 'Активный',
        'processing': 'В обработке',
        'completed': 'Выполнен',
        'cancelled': 'Отменен'
    };
    return statusMap[status] || status;
}

function getStatusClass(status) {
    const classMap = {
        'active': 'status-active',
        'processing': 'status-processing',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return classMap[status] || '';
}

function showToast(message, type) {
    // Проверяем, есть ли уже тост
    let toast = document.querySelector('.toast');
    if (toast) {
        toast.remove();
    }

    toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' :
                       type === 'error' ? 'fa-exclamation-circle' :
                       'fa-info-circle'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', checkAdmin);