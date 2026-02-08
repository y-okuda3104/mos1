/**
 * チェックアウトページロジック
 * 
 * 注文合計表示・支払い処理
 * 
 * @version 2.1.0
 */

const CheckoutState = {
  paymentMethod: null,
  isProcessing: false
};

/* ===== 初期化 ===== */
document.addEventListener('DOMContentLoaded', () => {
  initializeCheckout();
});

function initializeCheckout() {
  // 座席情報が設定されていない場合はトップメニューへ
  if (!AppState.seatId) {
    setTimeout(() => {
      window.location.href = 'top_menu.html';
    }, 500);
    return;
  }

  loadCheckoutData();
  bindEventHandlers();
}

/* ===== チェックアウトデータ読み込み ===== */
function loadCheckoutData() {
  // 座席表示
  const seatInfo = document.getElementById('seatInfo');
  if (seatInfo) {
    seatInfo.textContent = AppState.seatId || '--';
  }

  // カート内容表示
  renderCartItems();

  // 合計金額の計算と表示
  updateTotalAmount();
}

function renderCartItems() {
  const cartContainer = document.getElementById('cartItems');
  if (!cartContainer) return;

  const cartEntries = Object.entries(AppState.cart);
  
  if (cartEntries.length === 0) {
    cartContainer.innerHTML = '<div class="empty-message">カートが空です</div>';
    return;
  }

  const items = AppState.menuItems || [];
  const html = cartEntries
    .map(([itemId, quantity]) => {
      const item = items.find(m => m.id === itemId);
      if (!item) return '';

      const subtotal = item.price * quantity;
      return `
        <div class="cart-item">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="item-qty">×${quantity}</span>
          <span class="item-price">¥${subtotal.toLocaleString()}</span>
        </div>
      `;
    })
    .join('');

  cartContainer.innerHTML = html;
}

function updateTotalAmount() {
  const cartTotal = AppState.getCartTotal();
  const totalElement = document.getElementById('totalAmount');
  const countElement = document.getElementById('itemCountInfo');

  if (totalElement) {
    totalElement.textContent = `¥${cartTotal.toLocaleString()}`;
  }

  if (countElement) {
    const itemCount = Object.values(AppState.cart).reduce((a, b) => a + b, 0);
    countElement.textContent = itemCount;
  }
}

/* ===== イベント バインディング ===== */
function bindEventHandlers() {
  const cashBtn = document.getElementById('cashBtn');
  const cardBtn = document.getElementById('cardBtn');
  const completeBtn = document.getElementById('completeBtn');
  const backBtn = document.getElementById('backBtn');
  const returnHomeBtn = document.getElementById('returnHomeBtn');

  if (cashBtn) {
    cashBtn.addEventListener('click', () => {
      selectPaymentMethod('cash');
    });
  }

  if (cardBtn) {
    cardBtn.addEventListener('click', () => {
      selectPaymentMethod('card');
    });
  }

  if (completeBtn) {
    completeBtn.addEventListener('click', handlePaymentComplete);
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (!CheckoutState.isProcessing) {
        window.location.href = 'top_menu.html';
      }
    });
  }

  if (returnHomeBtn) {
    returnHomeBtn.addEventListener('click', () => {
      window.location.href = 'top_menu.html';
    });
  }
}

/* ===== 支払い方法選択 ===== */
function selectPaymentMethod(method) {
  CheckoutState.paymentMethod = method;

  // ボタンのアクティブ状態を更新
  const cashBtn = document.getElementById('cashBtn');
  const cardBtn = document.getElementById('cardBtn');

  if (cashBtn) {
    cashBtn.style.background = method === 'cash' ? '#ff7f32' : '';
    cashBtn.style.color = method === 'cash' ? 'white' : '';
  }

  if (cardBtn) {
    cardBtn.style.background = method === 'card' ? '#ff7f32' : '';
    cardBtn.style.color = method === 'card' ? 'white' : '';
  }

  showToast(`支払い方法: ${method === 'cash' ? '現金' : 'カード'} を選択しました`);
}

/* ===== 支払い完了処理 ===== */
async function handlePaymentComplete() {
  if (CheckoutState.isProcessing) return;

  // カートが空の場合
  const cartTotal = Object.keys(AppState.cart).length;
  if (cartTotal === 0) {
    showToast('注文がありません');
    return;
  }

  CheckoutState.isProcessing = true;

  // 支払い処理中モーダルを表示
  showProcessingModal();

  try {
    // 支払い初期化API呼び出し
    const result = await API.initializePayment(AppState.seatId);

    // 注文を履歴に追加
    const order = {
      id: `order_${Date.now()}`,
      timestamp: new Date().toISOString(),
      items: { ...AppState.cart },
      total: AppState.getCartTotal(),
      status: 'completed',
      paymentMethod: CheckoutState.paymentMethod || 'cash'
    };

    AppState.orders.push(order);
    AppState.saveOrders();

    // カートをクリア
    AppState.clearCart();

    // 支払い状態を完了に設定
    AppState.completePayment();

    // 支払い完了モーダルを表示（1秒後）
    setTimeout(() => {
      hideProcessingModal();
      showCompleteModal();
    }, 2000);

  } catch (error) {
    console.error('Payment error:', error);
    showToast('支払い処理でエラーが発生しました');
    CheckoutState.isProcessing = false;
    hideProcessingModal();
  }
}

/* ===== モーダル管理 ===== */
function showProcessingModal() {
  const modal = document.getElementById('processingModal');
  if (modal) {
    modal.classList.add('show');
  }
}

function hideProcessingModal() {
  const modal = document.getElementById('processingModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

function showCompleteModal() {
  const modal = document.getElementById('completeModal');
  if (modal) {
    modal.classList.add('show');
  }
}

/* ===== 通知 ===== */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/* ===== ユーティリティ ===== */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
