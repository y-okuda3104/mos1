/**
 * shared-state.js - 全ページ共有の状態管理
 * AppState: 店舗全体の状態管理
 * 座席ID、QRスキャン状態、注文、決済状態などを統中管理
 */

const AppState = {
  seatId: null,
  qrScanned: false,
  canOrder: true,
  paymentStatus: null, // 'preparing', 'processing', 'completed'
  cart: {},
  orders: [],
  menuItems: [],
  soldOutItems: []
};

/**
 * アプリケーション状態を初期化（ページ読み込み時に呼び出す）
 */
function appStateInit() {
  const seatId = localStorage.getItem('seatId');
  if (seatId) {
    AppState.seatId = seatId;
    AppState.qrScanned = true;
    
    // localStorage から座席データを復元
    const cartKey = `cart_${seatId}`;
    const ordersKey = `orders_${seatId}`;
    const paymentKey = `paymentStatus_${seatId}`;
    
    const savedCart = localStorage.getItem(cartKey);
    if (savedCart) {
      AppState.cart = JSON.parse(savedCart);
    }
    
    const savedOrders = localStorage.getItem(ordersKey);
    if (savedOrders) {
      AppState.orders = JSON.parse(savedOrders);
    }
    
    const savedPaymentStatus = localStorage.getItem(paymentKey);
    if (savedPaymentStatus) {
      AppState.paymentStatus = savedPaymentStatus;
      if (savedPaymentStatus !== null && savedPaymentStatus !== 'completed') {
        AppState.canOrder = false;
      }
    }
  }
}

/**
 * 座席IDを設定（QRスキャン完了後）
 */
function setSeatId(seatId) {
  AppState.seatId = seatId;
  AppState.qrScanned = true;
  localStorage.setItem('seatId', seatId);
}

/**
 * カートに商品を追加
 */
function addToCart(itemId, quantity) {
  if (!AppState.canOrder) {
    return false;
  }
  
  if (!AppState.cart[itemId]) {
    AppState.cart[itemId] = 0;
  }
  AppState.cart[itemId] += quantity;
  saveCart();
  return true;
}

/**
 * カートから商品を削除
 */
function removeFromCart(itemId) {
  delete AppState.cart[itemId];
  saveCart();
}

/**
 * 注文を確定
 */
function submitOrder() {
  if (!AppState.canOrder || Object.keys(AppState.cart).length === 0) {
    return false;
  }
  
  const order = {
    id: 'ORD-' + Date.now(),
    items: { ...AppState.cart },
    timestamp: new Date().toISOString()
  };
  
  AppState.orders.push(order);
  AppState.cart = {};
  saveCart();
  saveOrders();
  return true;
}

/**
 * 決済処理を開始
 */
function startPaymentProcess() {
  AppState.paymentStatus = 'preparing';
  AppState.canOrder = false;
  savePaymentStatus();
}

/**
 * 決済処理を完了
 */
function completePayment() {
  AppState.paymentStatus = 'completed';
  savePaymentStatus();
}

/**
 * 決済ステータスをリセット
 */
function resetPaymentStatus() {
  AppState.paymentStatus = null;
  AppState.canOrder = true;
  
  const seatId = AppState.seatId;
  if (seatId) {
    const paymentKey = `paymentStatus_${seatId}`;
    localStorage.removeItem(paymentKey);
  }
}

/**
 * カートをlocalStorageに保存
 */
function saveCart() {
  if (AppState.seatId) {
    const cartKey = `cart_${AppState.seatId}`;
    localStorage.setItem(cartKey, JSON.stringify(AppState.cart));
  }
}

/**
 * 注文をlocalStorageに保存
 */
function saveOrders() {
  if (AppState.seatId) {
    const ordersKey = `orders_${AppState.seatId}`;
    localStorage.setItem(ordersKey, JSON.stringify(AppState.orders));
  }
}

/**
 * 決済ステータスをlocalStorageに保存
 */
function savePaymentStatus() {
  if (AppState.seatId && AppState.paymentStatus) {
    const paymentKey = `paymentStatus_${AppState.seatId}`;
    localStorage.setItem(paymentKey, AppState.paymentStatus);
  }
}

/**
 * 初期化（DOMContentLoaded時に呼び出される）
 */
document.addEventListener('DOMContentLoaded', appStateInit);
