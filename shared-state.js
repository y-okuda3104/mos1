/**
 * グローバルアプリケーション状態管理
 * 全ページで共有する状態を一元管理
 */

const AppState = {
  // 座席・認証情報
  seatId: localStorage.getItem('seatId') || null,
  qrScanned: !!localStorage.getItem('seatId'),
  
  // メニュー・カート情報
  menuItems: [],
  cart: {},
  soldOutItems: [],
  
  // 注文・配膳情報
  orders: [],
  paymentStatus: 'idle', // idle | processing | completed
  canOrder: true,
  
  // 初期化
  init() {
    if (this.seatId) {
      this.loadCart();
      this.loadOrders();
    }
  },
  
  // 座席設定
  setSeatId(seatId) {
    this.seatId = seatId;
    this.qrScanned = true;
    localStorage.setItem('seatId', seatId);
    this.loadCart();
    this.loadOrders();
  },
  
  // カート操作
  addToCart(itemId, quantity = 1) {
    if (!this.seatId) return false;
    this.cart[itemId] = (this.cart[itemId] || 0) + quantity;
    this.saveCart();
    return true;
  },
  
  removeFromCart(itemId) {
    if (!this.seatId) return false;
    delete this.cart[itemId];
    this.saveCart();
    return true;
  },
  
  getCartTotal() {
    let total = 0;
    for (const itemId in this.cart) {
      const item = this.menuItems.find(i => i.id === itemId);
      if (item) {
        total += item.price * this.cart[itemId];
      }
    }
    return total;
  },
  
  getCartItemCount() {
    return Object.values(this.cart).reduce((sum, qty) => sum + qty, 0);
  },
  
  // カート永続化
  saveCart() {
    if (!this.seatId) return;
    localStorage.setItem(`cart_${this.seatId}`, JSON.stringify(this.cart));
  },
  
  loadCart() {
    if (!this.seatId) return;
    const saved = localStorage.getItem(`cart_${this.seatId}`);
    this.cart = saved ? JSON.parse(saved) : {};
  },
  
  clearCart() {
    this.cart = {};
    this.saveCart();
  },
  
  // 注文操作
  submitOrder(items) {
    if (!this.seatId) return false;
    const order = {
      id: `order_${Date.now()}`,
      seatId: this.seatId,
      items: items,
      total: this.getCartTotal(),
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    this.orders.push(order);
    this.saveOrders();
    return true;
  },
  
  // 注文永続化
  saveOrders() {
    if (!this.seatId) return;
    localStorage.setItem(`orders_${this.seatId}`, JSON.stringify(this.orders));
  },
  
  loadOrders() {
    if (!this.seatId) return;
    const saved = localStorage.getItem(`orders_${this.seatId}`);
    this.orders = saved ? JSON.parse(saved) : [];
  },
  
  // 支払い処理
  startPaymentProcess() {
    this.paymentStatus = 'processing';
    this.canOrder = false;
    localStorage.setItem(`paymentStatus_${this.seatId}`, 'processing');
  },
  
  completePayment() {
    this.paymentStatus = 'completed';
    localStorage.setItem(`paymentStatus_${this.seatId}`, 'completed');
  },
  
  resetPaymentStatus() {
    this.paymentStatus = 'idle';
    this.canOrder = true;
    if (this.seatId) {
      localStorage.removeItem(`paymentStatus_${this.seatId}`);
    }
  },
  
  // 売切り情報
  markAsSoldOut(itemId) {
    if (!this.soldOutItems.includes(itemId)) {
      this.soldOutItems.push(itemId);
    }
  },
  
  isSoldOut(itemId) {
    return this.soldOutItems.includes(itemId);
  }
};

// グローバルヘルパー関数
function addToCart(itemId, quantity = 1) {
  return AppState.addToCart(itemId, quantity);
}

function removeFromCart(itemId) {
  return AppState.removeFromCart(itemId);
}

function getCartTotal() {
  return AppState.getCartTotal();
}

function getCartItemCount() {
  return AppState.getCartItemCount();
}

function submitOrder() {
  const items = Object.keys(AppState.cart);
  if (items.length === 0) return null;
  
  const result = AppState.submitOrder(items);
  if (result) {
    AppState.clearCart();
    return true;
  }
  return false;
}

function startPaymentProcess() {
  AppState.startPaymentProcess();
}

function completePayment() {
  AppState.completePayment();
}

function resetPaymentStatus() {
  AppState.resetPaymentStatus();
}

// 初期化
AppState.init();
