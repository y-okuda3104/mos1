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
      // API.getMenuItems() を使用してメニュー取得
      const items = await API.getMenuItems(MENU_CONFIG.STORE_ID);
      menuState.items = items && items.length ? items : this.generateDummyMenu();
    } catch (error) {
      console.warn('Menu API unavailable, using dummy menu:', error);
      menuState.items = this.generateDummyMenu();
    } finally {
      menuState.isLoading = false;
    }

    // メニュー表示の初期化
    uiManager.populateCategories();
    uiManager.renderMenu();
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
    return [
      { id: 'm01', name: '枝豆', category: '冷菜', price: 390, image: '🥬' },
      { id: 'm02', name: '唐揚げ', category: '揚げ物', price: 590, image: '🍗' },
      { id: 'm03', name: 'だし巻き卵', category: '卵料理', price: 450, image: '🥚', soldOut: true },
      { id: 'm04', name: 'もつ煮込み', category: '煮込み', price: 520, image: '🍲' },
      { id: 'm05', name: 'チーズ唐揚げ', category: '揚げ物', price: 650, image: '🧀' },
      { id: 'm06', name: 'ポテトサラダ', category: '冷菜', price: 420, image: '🥔' },
      { id: 'm07', name: '牛タン塩焼き', category: '焼き物', price: 880, image: '🥩', soldOut: true },
      { id: 'm08', name: 'イカ塩辛', category: '冷菜', price: 480, image: '🦑' },
      { id: 'm09', name: '豚足揚げ', category: '揚げ物', price: 520, image: '🍖' },
      { id: 'm10', name: '明太バター', category: '冷菜', price: 540, image: '🧈' },
      { id: 'm11', name: '焼鳥盛合わせ', category: '焼き物', price: 720, image: '🔥' },
      { id: 'm12', name: 'お絞り', category: '取り皿', price: 0, image: '🧻' }
    ];
  },

  getCategoryByIndex(index) {
    const categories = ['冷菜', '揚げ物', '卵料理', '煮込み', '焼き物', '取り皿'];
    return categories[index % categories.length];
  },

  filterItems(keyword, category) {
    let filtered = menuState.items.filter(item => {
      const matchesCategory = !category || item.category === category;
      const matchesKeyword = !keyword || 
        item.name.toLowerCase().includes(keyword.toLowerCase());
      return matchesCategory && matchesKeyword;
    });

    // ソート処理（デフォルト：名前順）
    const sortBy = document.querySelector('[data-sort]')?.dataset.sort || 'name';
    if (sortBy === 'price') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      filtered.sort((a, b) => b.price - a.price);
    } else {
      // デフォルト：名前順
      filtered.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    }

    return filtered;
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
    if (Object.keys(AppState.cart).length === 0) {
      this.showMessage('カートが空です');
      return;
    }

    if (!AppState.canOrder) {
      this.showMessage('会計中のため注文できません');
      return;
    }

    // AppState を使用して注文を送信
    const orderId = submitOrder();
    
    if (!orderId) {
      this.showMessage('注文処理に失敗しました');
      return;
    }

    // UIの更新
    uiManager.renderCart();
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
      const category = this.getActiveCategory();

      // 並び順機能を削除し、フィルターのみ適用
      const items = menuManager.filterItems(keyword, category);

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
    // AppState の soldOutItems をチェック
    const isSoldOut = AppState.soldOutItems.includes(item.id) || item.soldOut;
    
    const card = document.createElement('div');
    card.className = 'menuItem' + (isSoldOut ? ' soldOut' : '');
    
    const imgHtml = item.image ? 
      `<div style="font-size:32px;text-align:center">${item.image}</div>` : '';
    
    const priceDisplay = item.price === 0 ? '¥0（無料）' : `¥${item.price}`;
    const isOrderDisabled = !AppState.canOrder || isSoldOut;
    
    card.innerHTML = `
      ${imgHtml}
      <div class="name">${utils.escapeHtml(item.name)}</div>
      <div class="price">${priceDisplay}</div>
      ${isSoldOut ? '<div class="soldout-badge">売切</div>' : ''}
      <button ${isOrderDisabled ? 'disabled' : ''} 
              data-id="${utils.escapeHtml(item.id)}"
              aria-label="${isSoldOut ? '売切' : (AppState.canOrder ? item.name + 'をカートに追加' : '会計中のため操作できません')}">
        ${isSoldOut ? '売切' : '追加'}
      </button>
    `;
    
    container.appendChild(card);

    const btn = card.querySelector('button[data-id]');
    if (btn && !isSoldOut && AppState.canOrder) {
      btn.addEventListener('click', () => this.handleAddToCart(item.id));
    }
  },

  handleAddToCart(itemId) {
    try {
      // AppState を使用してカートに追加
      if (!addToCart(itemId, 1)) {
        orderManager.showMessage('会計中のため追加できません');
        return;
      }
      
      // UIの更新
      this.renderCart();
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

  getActiveCategory() {
    const activeTab = document.querySelector('.category-tab.active');
    return activeTab ? activeTab.dataset.category : '';
  },

  // populateCategories関数をタブ生成に変更
  populateCategories() {
    const tabContainer = document.getElementById('categoryTabs');
    if (!tabContainer) return;
    
    try {
      // 既存タブをクリア
      tabContainer.innerHTML = '';
      
      // 「すべて」タブを追加
      const allTab = document.createElement('button');
      allTab.className = 'category-tab active';
      allTab.textContent = 'すべて';
      allTab.dataset.category = '';
      allTab.addEventListener('click', () => this.selectCategory(allTab));
      tabContainer.appendChild(allTab);
      
      // カテゴリタブを生成
      const categories = Array.from(new Set(menuState.items.map(item => item.category))).filter(Boolean);
      
      categories.forEach(category => {
        const tab = document.createElement('button');
        tab.className = 'category-tab';
        tab.textContent = category;
        tab.dataset.category = category;
        tab.addEventListener('click', () => this.selectCategory(tab));
        tabContainer.appendChild(tab);
      });
    } catch (error) {
      console.error('カテゴリタブ生成エラー:', error);
    }
  },

  selectCategory(selectedTab) {
    // 全タブから active クラスを削除
    document.querySelectorAll('.category-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    // 選択されたタブに active クラスを追加
    selectedTab.classList.add('active');
    
    // メニューを再描画
    this.renderMenu();
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

    if (Object.keys(AppState.cart).length === 0) {
      listEl.innerHTML = '<li class="empty-cart">カートは空です</li>';
      totalEl.textContent = '合計: ¥0';
      return;
    }

    Object.entries(AppState.cart).forEach(([itemId, quantity]) => {
      const item = menuState.items.find(i => i.id === itemId) || 
        { id: itemId, name: itemId, price: 0 };
      
      const li = this.createCartItem(item, quantity);
      listEl.appendChild(li);
    });

    totalEl.textContent = `合計: ¥${getCartTotal()}`;
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
      
      // 「お会計」ボタン
      const checkoutBtn = document.getElementById('btnCheckout');
      if (checkoutBtn) {
        checkoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          startPaymentProcess();
          window.location.href = 'checkout.html';
        });
        // 会計中は disabled
        checkoutBtn.disabled = !AppState.canOrder;
      }
    } catch (error) {
      console.error('イベントハンドラー設定エラー:', error);
    }
  },

  bindSearchHandlers() {
    const searchInput = document.getElementById('searchInput');
    
    if (searchInput) {
      searchInput.addEventListener('input', this.debounce(() => this.renderMenu(), 300));
    }
    
    // カテゴリフィルター・ソート関連のイベントハンドラーを削除
    // タブのイベントハンドラーは populateCategories() 内で設定済み
  },

  bindCartHandlers() {
    const toggleBtn = document.getElementById('miniCartToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleCartDetails());
    }
  },

  bindOrderHandlers() {\n    const confirmBtn = document.getElementById('confirmOrder');\n    if (confirmBtn) {\n      confirmBtn.addEventListener('click', () => orderManager.confirmOrder());\n    }\n  },

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
    // QRスキャン済みかチェック
    if (!AppState.qrScanned || !AppState.seatId) {
      window.location.href = 'qr_entry.html';
      return;
    }

    // メニューロード＆初期化
    await menuManager.loadMenu();
    
    // 売切アイテムを AppState に設定
    const soldOut = await API.getSoldOutItems();
    menuState.soldOutItems = soldOut;
    
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
