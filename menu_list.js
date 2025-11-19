/**
 * メニュー一覧システム
 * 
 * 機能:
 * - メニュー表示・検索・フィルタリング
 * - カート管理システム
 * - 注文管理・配膳状態追跡
 * 
 * @version 2.0.0  
 * @author POS Development Team
 */

/* ===== 設定定数 ===== */
const MENU_CONFIG = {
  STORE_ID: "001",
  DUMMY_MENU_COUNT: 12,
  API: {
    MENU_ENDPOINT: '/api/menu',
    TIMEOUT_MS: 5000
  },
  STORAGE: {
    SEAT_KEY: 'seatId',
    CART_PREFIX: 'cart_',
    ORDERS_PREFIX: 'orders_'
  },
  UI: {
    BUTTON_MIN_SIZE: '44px',
    GRID_COLUMNS: 2
  }
};

/* ===== 状態管理 ===== */
const menuState = {
  items: [],
  cart: {},
  orders: [],
  currentSeat: null,
  isLoading: false
};

/* ===== ユーティリティ関数 ===== */
const utils = {
  normalizeSeatId(input) {
    if (!input) return null;
    const normalized = String(input).trim().toUpperCase();
    const match = normalized.match(/^([A-Z])[-\s]?(\d{1,2})$/);
    return match ? `${match[1]}-${String(parseInt(match[2], 10)).padStart(2, '0')}` : null;
  },

  generateStorageKey(prefix, seatId) {
    return `${prefix}${seatId || 'unknown'}`;
  },

  safeParseJSON(jsonString, fallback = null) {
    try {
      return jsonString ? JSON.parse(jsonString) : fallback;
    } catch (error) {
      console.error('JSON parse error:', error);
      return fallback;
    }
  },

  createElement(tag, className = '', content = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content) element.textContent = content;
    return element;
  },

  // XSS対策のためのエスケープ関数を追加
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // ローディング状態管理
  setLoadingState(isLoading) {
    const container = document.getElementById('menuContainer');
    if (!container) return;
    
    if (isLoading) {
      container.innerHTML = '<div class="loading-message">メニューを読み込み中...</div>';
    }
  },

  // エラー表示
  showError(message, container = null) {
    if (container) {
      container.innerHTML = `<div class="error-message">${this.escapeHtml(message)}</div>`;
    }
    console.error(message);
  }
};

/* ===== データ管理 ===== */
const dataManager = {
  loadSeatData() {
    const seatId = localStorage.getItem(MENU_CONFIG.STORAGE.SEAT_KEY) || "C-01";
    menuState.currentSeat = utils.normalizeSeatId(seatId);
  },

  loadCart() {
    const cartKey = utils.generateStorageKey(
      MENU_CONFIG.STORAGE.CART_PREFIX, 
      menuState.currentSeat
    );
    const cartData = localStorage.getItem(cartKey);
    menuState.cart = utils.safeParseJSON(cartData, {});
  },

  saveCart() {
    const cartKey = utils.generateStorageKey(
      MENU_CONFIG.STORAGE.CART_PREFIX,
      menuState.currentSeat
    );
    localStorage.setItem(cartKey, JSON.stringify(menuState.cart));
  },

  loadOrders() {
    const ordersKey = utils.generateStorageKey(
      MENU_CONFIG.STORAGE.ORDERS_PREFIX,
      menuState.currentSeat  
    );
    const ordersData = localStorage.getItem(ordersKey);
    menuState.orders = utils.safeParseJSON(ordersData, []);
  },

  saveOrders() {
    const ordersKey = utils.generateStorageKey(
      MENU_CONFIG.STORAGE.ORDERS_PREFIX,
      menuState.currentSeat
    );
    localStorage.setItem(ordersKey, JSON.stringify(menuState.orders));
  }
};

/* ===== メニュー管理 ===== */
const menuManager = {
  async loadMenu() {
    menuState.isLoading = true;
    
    try {
      const response = await this.fetchMenuFromAPI();
      menuState.items = response.items && response.items.length ? 
        response.items : this.generateDummyMenu();
    } catch (error) {
      console.warn('Menu API unavailable, using dummy menu:', error);
      menuState.items = this.generateDummyMenu();
    } finally {
      menuState.isLoading = false;
    }

    uiManager.renderMenu();
    uiManager.populateCategories();
  },

  async fetchMenuFromAPI() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MENU_CONFIG.API.TIMEOUT_MS);

    try {
      const response = await fetch(
        `${MENU_CONFIG.API.MENU_ENDPOINT}?storeId=${MENU_CONFIG.STORE_ID}`,
        { signal: controller.signal }
      );
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  },

  generateDummyMenu() {
    return Array.from({ length: MENU_CONFIG.DUMMY_MENU_COUNT }, (_, i) => {
      const idx = i + 1;
      return {
        id: `m${String(idx).padStart(2, '0')}`,
        name: `居酒屋メニュー ${idx}`,
        price: (idx % 5 === 0) ? 0 : 500 + (idx * 50),
        imageUrl: '',
        category: this.getCategoryByIndex(idx),
        recommend: Math.floor(Math.random() * 100),
        quickOrder: Math.floor(Math.random() * 10),
        soldOut: false
      };
    });
  },

  getCategoryByIndex(index) {
    const categories = ['酒肴', '串焼き', '揚げ物'];
    return categories[index % 3];
  },

  filterAndSortItems(keyword, category, sortOrder) {
    let filtered = menuState.items.filter(item => {
      const matchesCategory = !category || item.category === category;
      const matchesKeyword = !keyword || 
        item.name.toLowerCase().includes(keyword.toLowerCase());
      return matchesCategory && matchesKeyword;
    });

    return this.sortItems(filtered, sortOrder);
  },

  sortItems(items, sortOrder) {
    const sortFunctions = {
      recommend: (a, b) => b.recommend - a.recommend,
      category: (a, b) => a.category.localeCompare(b.category),
      quick: (a, b) => a.quickOrder - b.quickOrder
    };

    const sortFn = sortFunctions[sortOrder] || sortFunctions.recommend;
    return [...items].sort(sortFn);
  }
};

/* ===== カート管理 ===== */
const cartManager = {
  addItem(itemId) {
    menuState.cart[itemId] = (menuState.cart[itemId] || 0) + 1;
    this.saveAndRender();
  },

  removeItem(itemId) {
    delete menuState.cart[itemId];
    this.saveAndRender();
  },

  increaseQuantity(itemId) {
    menuState.cart[itemId] = (menuState.cart[itemId] || 0) + 1;
    this.saveAndRender();
  },

  decreaseQuantity(itemId) {
    const currentQty = menuState.cart[itemId] || 0;
    if (currentQty <= 1) {
      this.removeItem(itemId);
    } else {
      menuState.cart[itemId] = currentQty - 1;
      this.saveAndRender();
    }
  },

  getTotalItems() {
    return Object.values(menuState.cart).reduce((sum, qty) => sum + (qty || 0), 0);
  },

  getTotalPrice() {
    return Object.entries(menuState.cart).reduce((total, [itemId, qty]) => {
      const item = menuState.items.find(i => i.id === itemId);
      return total + ((item?.price || 0) * qty);
    }, 0);
  },

  isEmpty() {
    return Object.keys(menuState.cart).length === 0;
  },

  clear() {
    menuState.cart = {};
    this.saveAndRender();
  },

  saveAndRender() {
    dataManager.saveCart();
    uiManager.renderCart();
  }
};

/* ===== 注文管理 ===== */
const orderManager = {
  confirmOrder() {
    if (cartManager.isEmpty()) {
      this.showMessage('カートが空です');
      return;
    }

    const timestamp = Date.now();
    
    Object.entries(menuState.cart).forEach(([itemId, quantity]) => {
      const item = menuState.items.find(i => i.id === itemId) || 
        { id: itemId, name: itemId, price: 0 };
      
      menuState.orders.push({
        id: item.id,
        name: item.name,
        price: item.price || 0,
        qty: quantity || 0,
        delivered: false,
        ts: timestamp
      });
    });

    dataManager.saveOrders();
    cartManager.clear();
    uiManager.renderOrderStatus();
    uiManager.hideCartDetails();
    
    this.showMessage('注文を確定しました');
  },

  getDeliveryStatus() {
    return menuState.orders.reduce(
      (status, order) => {
        if (order.delivered) {
          status.delivered += order.qty || 0;
        } else {
          status.pending += order.qty || 0;
        }
        return status;
      },
      { delivered: 0, pending: 0 }
    );
  },

  markAsDelivered(itemId) {
    menuState.orders = menuState.orders.map(order => 
      order.id === itemId ? { ...order, delivered: true } : order
    );
    dataManager.saveOrders();
    uiManager.renderOrderStatus();
  },

  showMessage(message) {
    if (typeof showToast === 'function') {
      showToast(message);
    } else {
      console.log('[Order]', message);
    }
  }
};

/* ===== UI管理 ===== */
const uiManager = {
  renderMenu() {
    const container = document.getElementById('menuContainer');
    if (!container) return;

    try {
      const keyword = this.getInputValue('searchInput');
      const category = this.getSelectValue('categoryFilter');
      const sort = this.getSelectValue('sortOrder', 'recommend');

      const items = menuManager.filterAndSortItems(keyword, category, sort);

      container.innerHTML = '';
      
      if (items.length === 0) {
        container.innerHTML = '<div class="no-results">該当するメニューが見つかりません</div>';
        return;
      }

      items.forEach(item => this.renderMenuItem(container, item));
    } catch (error) {
      utils.showError('メニューの表示中にエラーが発生しました', container);
    }
  },

  renderMenuItem(container, item) {
    const card = document.createElement('div');
    card.className = 'menuItem' + (item.soldOut ? ' soldOut' : '');
    
    const imgHtml = item.imageUrl ? 
      `<img src="${utils.escapeHtml(item.imageUrl)}" alt="${utils.escapeHtml(item.name)}" loading="lazy">` : '';
    
    const priceDisplay = item.price === 0 ? '¥0（無料）' : `¥${item.price}`;
    
    card.innerHTML = `
      ${imgHtml}
      <div class="name">${utils.escapeHtml(item.name)}</div>
      <div class="price">${priceDisplay}</div>
      <button ${item.soldOut ? 'disabled' : ''} 
              data-id="${utils.escapeHtml(item.id)}"
              aria-label="${item.soldOut ? '売切' : item.name + 'をカートに追加'}">
        ${item.soldOut ? '売切' : '追加'}
      </button>
    `;
    
    container.appendChild(card);

    const btn = card.querySelector('button[data-id]');
    if (btn && !item.soldOut) {
      btn.addEventListener('click', () => this.handleAddToCart(item.id));
    }
  },

  handleAddToCart(itemId) {
    try {
      cartManager.addItem(itemId);
      // フィードバック効果
      this.showAddToCartFeedback(itemId);
    } catch (error) {
      console.error('カート追加エラー:', error);
      orderManager.showMessage('カートへの追加に失敗しました');
    }
  },

  showAddToCartFeedback(itemId) {
    const button = document.querySelector(`button[data-id="${itemId}"]`);
    if (button) {
      const originalText = button.textContent;
      button.textContent = '追加済み';
      button.disabled = true;
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 1000);
    }
  },

  getInputValue(id) {
    const element = document.getElementById(id);
    return element ? String(element.value).trim() : '';
  },

  getSelectValue(id, defaultValue = '') {
    const element = document.getElementById(id);
    return element ? element.value : defaultValue;
  },

  populateCategories() {
    const select = document.getElementById('categoryFilter');
    if (!select) return;
    
    try {
      select.innerHTML = '<option value="">すべてのカテゴリ</option>';
      const categories = Array.from(new Set(menuState.items.map(item => item.category))).filter(Boolean);
      
      categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
      });
    } catch (error) {
      console.error('カテゴリ生成エラー:', error);
    }
  },

  renderCart() {
    try {
      this.updateCartSummary();
      this.updateCartDetails();
    } catch (error) {
      console.error('カート表示エラー:', error);
    }
  },

  updateCartSummary() {
    const summaryCount = document.getElementById('cartCount');
    if (summaryCount) {
      summaryCount.textContent = String(cartManager.getTotalItems());
    }
  },

  updateCartDetails() {
    const listEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    if (!listEl || !totalEl) return;

    listEl.innerHTML = '';
    const totalPrice = cartManager.getTotalPrice();

    if (cartManager.isEmpty()) {
      listEl.innerHTML = '<li class="empty-cart">カートは空です</li>';
      totalEl.textContent = '合計: ¥0';
      return;
    }

    Object.entries(menuState.cart).forEach(([itemId, quantity]) => {
      const item = menuState.items.find(i => i.id === itemId) || 
        { id: itemId, name: itemId, price: 0 };
      
      const li = this.createCartItem(item, quantity);
      listEl.appendChild(li);
    });

    totalEl.textContent = `合計: ¥${totalPrice}`;
  },

  createCartItem(item, quantity) {
    const li = document.createElement('li');
    li.className = 'cart-item';
    
    // 商品情報
    const itemInfo = document.createElement('div');
    itemInfo.className = 'cart-item__info';
    itemInfo.innerHTML = `
      <span class="cart-item__name">${utils.escapeHtml(item.name)}</span>
      <strong class="cart-item__quantity">x${quantity}</strong>
    `;
    
    // 操作ボタン
    const controls = document.createElement('div');
    controls.className = 'cart-item__controls';
    
    const decreaseBtn = this.createCartButton('−', `減らす ${item.name}`, () => 
      cartManager.decreaseQuantity(item.id)
    );
    const increaseBtn = this.createCartButton('+', `増やす ${item.name}`, () => 
      cartManager.increaseQuantity(item.id)
    );
    
    controls.appendChild(decreaseBtn);
    controls.appendChild(increaseBtn);
    
    li.appendChild(itemInfo);
    li.appendChild(controls);
    
    return li;
  },

  createCartButton(text, ariaLabel, onClick) {
    const button = document.createElement('button');
    button.className = 'primary cart-button';
    button.textContent = text;
    button.setAttribute('aria-label', ariaLabel);
    button.addEventListener('click', onClick);
    return button;
  },

  renderOrderStatus() {
    try {
      const status = orderManager.getDeliveryStatus();
      const deliveredEl = document.getElementById('deliveredCount');
      const pendingEl = document.getElementById('pendingCount');
      
      if (deliveredEl) deliveredEl.textContent = String(status.delivered);
      if (pendingEl) pendingEl.textContent = String(status.pending);
    } catch (error) {
      console.error('注文ステータス表示エラー:', error);
    }
  },

  bindEventHandlers() {
    try {
      this.bindSearchHandlers();
      this.bindCartHandlers();
      this.bindOrderHandlers();
    } catch (error) {
      console.error('イベントハンドラー設定エラー:', error);
    }
  },

  bindSearchHandlers() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const sortOrder = document.getElementById('sortOrder');
    
    if (searchInput) {
      searchInput.addEventListener('input', this.debounce(() => this.renderMenu(), 300));
    }
    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => this.renderMenu());
    }
    if (sortOrder) {
      sortOrder.addEventListener('change', () => this.renderMenu());
    }
  },

  bindCartHandlers() {
    const toggleBtn = document.getElementById('miniCartToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleCartDetails());
    }
  },

  bindOrderHandlers() {
    const confirmBtn = document.getElementById('confirmOrder');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => orderManager.confirmOrder());
    }
  },

  toggleCartDetails() {
    const details = document.getElementById('miniCartDetails');
    const toggle = document.getElementById('miniCartToggle');
    if (!details || !toggle) return;

    const isHidden = details.hidden;
    details.hidden = !isHidden;
    toggle.textContent = isHidden ? '閉じる' : '表示';
    
    if (!isHidden) {
      this.renderCart();
    }
  },

  hideCartDetails() {
    const details = document.getElementById('miniCartDetails');
    const toggle = document.getElementById('miniCartToggle');
    if (details && toggle) {
      details.hidden = true;
      toggle.textContent = '表示';
    }
  },

  // デバウンス関数（検索入力の最適化）
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
};

/* ===== 初期化 ===== */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    dataManager.loadSeatData();
    dataManager.loadCart();
    dataManager.loadOrders();
    
    await menuManager.loadMenu();
    
    uiManager.bindEventHandlers();
    uiManager.renderCart();
    uiManager.renderOrderStatus();
    
    // 外部依存の初期化
    if (typeof startClock === 'function') {
      startClock();
    }
  } catch (error) {
    console.error('Menu app initialization failed:', error);
  }
});

/* ===== 外部API ===== */
window.markDelivered = orderManager.markAsDelivered.bind(orderManager);
