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
  isLoading: false,
  currentSortBy: 'none'  // 'none' | 'price' | 'popular'
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
    // AppState.cart と同期
    AppState.cart = { ...menuState.cart };
  },

  saveCart() {
    const cartKey = utils.generateStorageKey(
      MENU_CONFIG.STORAGE.CART_PREFIX,
      menuState.currentSeat
    );
    localStorage.setItem(cartKey, JSON.stringify(menuState.cart));
    // AppState.cart と同期
    AppState.cart = { ...menuState.cart };
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
    utils.setLoadingState(true);
    
    try {
      // 新しいAPI経由でメニューを取得
      const menuItems = await API.getMenuItems();
      if (!menuItems || !Array.isArray(menuItems)) {
        throw new Error('Invalid menu data returned');
      }
      menuState.items = menuItems;
      
      // AppState にもメニューアイテムを保存
      AppState.menuItems = menuState.items;
      console.log('Menu loaded:', menuState.items.length, 'items');
    } catch (error) {
      console.error('Menu API error:', error);
      utils.showError('メニュー読み込みエラー: ' + error.message);
      menuState.items = [];
    } finally {
      menuState.isLoading = false;
      utils.setLoadingState(false);
    }

    // UI更新順序：1) メニュー, 2) カテゴリ, 3) ソートボタン
    try {
      uiManager.renderMenu();
      uiManager.populateCategories();
      console.log('Menu UI rendered');
    } catch (e) {
      console.error('UI render error:', e);
    }
    // ソートボタンはbindEventHandlers後に生成（イベントリスナー自体の初期化のため）
  },

  async fetchMenuFromAPI() {
    // AppState の API から取得（互換性のため保持）
    return await API.getMenuItems();
  },

  generateDummyMenu() {
    // 不要になったが、互換性のため保持
    return [];
  },

  getCategoryByIndex(index) {
    const categories = ['串もの', '揚げ物', '冷菜', '焼き物', '0円'];
    return categories[index % categories.length];
  },

  filterItems(keyword, category, sortBy = 'none') {
    let filtered = menuState.items.filter(item => {
      const matchesCategory = !category || item.category === category;
      const matchesKeyword = !keyword || 
        item.name.toLowerCase().includes(keyword.toLowerCase());
      return matchesCategory && matchesKeyword;
    });

    // ソート処理
    if (sortBy === 'price') {
      filtered = filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'popular') {
      filtered = filtered.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
    }
    
    return filtered;
  }
};

/* ===== カート管理 ===== */
const cartManager = {
  addItem(itemId) {
    AppState.cart[itemId] = (AppState.cart[itemId] || 0) + 1;
    menuState.cart = { ...AppState.cart };
    this.saveAndRender();
  },

  removeItem(itemId) {
    delete AppState.cart[itemId];
    menuState.cart = { ...AppState.cart };
    this.saveAndRender();
  },

  increaseQuantity(itemId) {
    AppState.cart[itemId] = (AppState.cart[itemId] || 0) + 1;
    menuState.cart = { ...AppState.cart };
    this.saveAndRender();
  },

  decreaseQuantity(itemId) {
    const currentQty = AppState.cart[itemId] || 0;
    if (currentQty <= 1) {
      this.removeItem(itemId);
    } else {
      AppState.cart[itemId] = currentQty - 1;
      menuState.cart = { ...AppState.cart };
      this.saveAndRender();
    }
  },

  getTotalItems() {
    return Object.values(AppState.cart).reduce((sum, qty) => sum + (qty || 0), 0);
  },

  getTotalPrice() {
    return Object.entries(AppState.cart).reduce((total, [itemId, qty]) => {
      const item = menuState.items.find(i => i.id === itemId) || AppState.menuItems?.find(i => i.id === itemId);
      return total + ((item?.price || 0) * qty);
    }, 0);
  },

  isEmpty() {
    return Object.keys(AppState.cart).length === 0;
  },

  clear() {
    AppState.cart = {};
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
      if (!menuState.items || menuState.items.length === 0) {
        container.innerHTML = '<div class="no-results">メニューを読み込んでいます...</div>';
        return;
      }

      const keyword = this.getInputValue('searchInput');
      const category = this.getActiveCategory();
      const sortBy = menuState.currentSortBy;

      // フィルタとソートを適用
      const items = menuManager.filterItems(keyword, category, sortBy);

      container.innerHTML = '';
      
      if (items.length === 0) {
        container.innerHTML = '<div class="no-results">該当するメニューが見つかりません</div>';
        return;
      }

      items.forEach(item => this.renderMenuItem(container, item));
    } catch (error) {
      console.error('Menu render error:', error);
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
      // cartManager を使用してカートに追加
      cartManager.addItem(itemId);
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
      const totalItems = Object.values(AppState.cart).reduce((sum, qty) => sum + (qty || 0), 0);
      summaryCount.textContent = String(totalItems);
    }
  },

  updateCartDetails() {
    const listEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    if (!listEl || !totalEl) return;

    listEl.innerHTML = '';

    if (Object.keys(AppState.cart).length === 0) {
      listEl.innerHTML = '<li class="empty-cart">カートは空です</li>';
      totalEl.textContent = '合計: ¥0';
      return;
    }

    let totalPrice = 0;
    Object.entries(AppState.cart).forEach(([itemId, quantity]) => {
      const item = menuState.items.find(i => i.id === itemId) || AppState.menuItems?.find(i => i.id === itemId) || 
        { id: itemId, name: itemId, price: 0 };
      
      totalPrice += (item.price || 0) * quantity;
      const li = this.createCartItem(item, quantity);
      listEl.appendChild(li);
    });

    totalEl.textContent = `合計: ¥${totalPrice.toLocaleString()}`;
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
    button.type = 'button';
    button.textContent = text;
    button.setAttribute('aria-label', ariaLabel);
    button.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });
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
          // 会計準備中モーダルを表示
          const modal = document.getElementById('paymentPreparingModal');
          if (modal) {
            modal.removeAttribute('hidden');
            modal.removeAttribute('aria-hidden');
          }
          // 会計状態を更新
          if (AppState && typeof AppState.startPaymentProcess === 'function') {
            AppState.startPaymentProcess();
          }
        });
        // 会計中は disabled
        checkoutBtn.disabled = !AppState.canOrder;
      }
      
      // ソートボタンを生成
      this.createSortButtons();
    } catch (error) {
      console.error('イベントハンドラー設定エラー:', error);
    }
  },

  bindSearchHandlers() {
    const searchInput = document.getElementById('searchInput');
    
    if (searchInput) {
      searchInput.addEventListener('input', this.debounce(() => this.renderMenu(), 300));
    }
  },

  createSortButtons() {
    const searchBar = document.querySelector('.search-bar');
    if (!searchBar) return;

    // 既存のソートボタン領域を削除
    const existingSortArea = searchBar.querySelector('.sort-buttons');
    if (existingSortArea) existingSortArea.remove();

    // ソートボタン領域を作成
    const sortArea = document.createElement('div');
    sortArea.className = 'sort-buttons';
    sortArea.style.cssText = 'display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;';
    
    const buttons = [
      { label: '標準', value: 'none' },
      { label: '安い順', value: 'price' },
      { label: '人気順', value: 'popular' }
    ];

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = btn.label;
      button.className = 'sort-btn secondary';
      button.style.cssText = `
        padding: 6px 12px;
        font-size: 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #fff;
        cursor: pointer;
        transition: all 0.2s;
      `;
      
      // アクティブ状態のスタイル
      if (menuState.currentSortBy === btn.value) {
        button.style.background = '#ff7f32';
        button.style.color = '#fff';
        button.style.borderColor = '#ff7f32';
      }

      button.addEventListener('click', () => {
        menuState.currentSortBy = btn.value;
        this.renderMenu();
        this.createSortButtons();  // ボタンの見た目を更新
      });

      sortArea.appendChild(button);
    });

    searchBar.appendChild(sortArea);
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
    // メニューロード＆初期化
    await menuManager.loadMenu();
    
    // 売切アイテムを AppState に設定
    const soldOut = await API.getSoldOutItems();
    AppState.soldOutItems = soldOut || [];
    
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
