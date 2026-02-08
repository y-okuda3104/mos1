/**
 * checkout.js - お会計・決済処理
 */

const checkoutState = {
  selectedPaymentMethod: null,
  orderTotal: 0,
  taxRate: 0.1 // 10%
};

/**
 * 初期化
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // QRスキャン済みか確認
    if (!AppState.qrScanned || !AppState.seatId) {
      window.location.href = 'qr_entry.html';
      return;
    }

    // 決済開始マーク
    startPaymentProcess();
    
    // UI初期化
    updateSeatLabel();
    await renderOrderSummary();
    calculateTotal();
    bindEventHandlers();
    
  } catch (error) {
    console.error('Checkout initialization error:', error);
    showError('初期化エラーが発生しました');
  }
});

/**
 * 座席ラベルを更新
 */
function updateSeatLabel() {
  const seatLabel = document.getElementById('seatLabel');
  if (seatLabel && AppState.seatId) {
    seatLabel.textContent = `席：${AppState.seatId}`;
  }
}

/**
 * 注文概要をレンダリング
 */
async function renderOrderSummary() {
  const container = document.getElementById('orderItems');
  if (!container) return;

  container.innerHTML = '';

  // AppState.cart から注文アイテムを取得
  const items = AppState.cart;
  if (!items || Object.keys(items).length === 0) {
    container.innerHTML = '<p>注文がありません</p>';
    return;
  }

  // メニューアイテムを取得して、カートアイテムと結合
  const menuItems = AppState.menuItems;
  if (!menuItems || menuItems.length === 0) {
    const fetchedItems = await API.getMenuItems();
    AppState.menuItems = fetchedItems;
  }

  // カート内の各アイテムを表示
  Object.entries(items).forEach(([itemId, quantity]) => {
    const menuItem = AppState.menuItems.find(item => item.id === itemId);
    if (!menuItem) return;

    const itemTotal = menuItem.price * quantity;
    
    const li = document.createElement('div');
    li.className = 'order-item';
    li.innerHTML = `
      <div class="order-item-info">
        <span class="order-item-name">${escapeHtml(menuItem.name)}</span>
        <span class="order-item-qty">×${quantity}個</span>
      </div>
      <span class="order-item-price">¥${itemTotal.toLocaleString()}</span>
    `;
    container.appendChild(li);
  });
}

/**
 * 合計を計算して表示
 */
function calculateTotal() {
  const items = AppState.cart;
  let subtotal = 0;

  Object.entries(items).forEach(([itemId, quantity]) => {
    const menuItem = AppState.menuItems.find(item => item.id === itemId);
    if (menuItem) {
      subtotal += menuItem.price * quantity;
    }
  });

  checkoutState.orderTotal = subtotal;
  const tax = Math.round(subtotal * checkoutState.taxRate);
  const total = subtotal + tax;

  // UIを更新
  const subtotalEl = document.getElementById('subtotal');
  const taxEl = document.getElementById('tax');
  const totalEl = document.getElementById('total');

  if (subtotalEl) subtotalEl.textContent = `¥${subtotal.toLocaleString()}`;
  if (taxEl) taxEl.textContent = `¥${tax.toLocaleString()}`;
  if (totalEl) totalEl.textContent = `¥${total.toLocaleString()}`;
}

/**
 * イベントハンドラをバインド
 */
function bindEventHandlers() {
  // 支払い方法ボタン
  const cardBtn = document.getElementById('btn-card');
  const cashBtn = document.getElementById('btn-cash');
  
  if (cardBtn) {
    cardBtn.addEventListener('click', () => selectPaymentMethod('card'));
  }
  if (cashBtn) {
    cashBtn.addEventListener('click', () => selectPaymentMethod('cash'));
  }

  // 決済実行ボタン
  const confirmBtn = document.getElementById('btnConfirmPayment');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', handleConfirmPayment);
  }

  // キャンセルボタン
  const cancelBtn = document.getElementById('btnCancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', handleCancel);
  }

  // 完了後のトップに戻るボタン
  const returnBtn = document.getElementById('btnReturnHome');
  if (returnBtn) {
    returnBtn.addEventListener('click', handleReturnHome);
  }
}

/**
 * 支払い方法を選択
 */
function selectPaymentMethod(method) {
  checkoutState.selectedPaymentMethod = method;
  
  // UIの更新
  const cardBtn = document.getElementById('btn-card');
  const cashBtn = document.getElementById('btn-cash');
  
  if (cardBtn) cardBtn.classList.toggle('selected', method === 'card');
  if (cashBtn) cashBtn.classList.toggle('selected', method === 'cash');
}

/**
 * 決済を実行
 */
async function handleConfirmPayment() {
  if (!checkoutState.selectedPaymentMethod) {
    alert('支払い方法を選択してください');
    return;
  }

  try {
    // UI遷移
    document.getElementById('confirmSection').hidden = true;
    document.getElementById('processingSection').hidden = false;

    // 決済初期化
    const paymentResponse = await API.initializePayment(
      AppState.seatId,
      checkoutState.orderTotal
    );

    if (!paymentResponse.success) {
      throw new Error('決済初期化に失敗しました');
    }

    // 決済実行
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const completeResponse = await API.completePayment(paymentResponse.paymentId);

    if (!completeResponse.success) {
      throw new Error('決済実行に失敗しました');
    }

    // 成功画面を表示
    completePayment();
    showCompletionScreen();

  } catch (error) {
    console.error('Payment error:', error);
    document.getElementById('processingSection').hidden = true;
    document.getElementById('confirmSection').hidden = false;
    alert('決済処理に失敗しました。もう一度お試しください。');
  }
}

/**
 * キャンセル処理
 */
function handleCancel() {
  if (confirm('お会計をキャンセルしますか？')) {
    resetPaymentStatus();
    window.location.href = 'menu_list.html';
  }
}

/**
 * 完了画面を表示
 */
function showCompletionScreen() {
  document.getElementById('processingSection').hidden = true;
  document.getElementById('confirmSection').hidden = true;
  document.getElementById('completionSection').hidden = false;
}

/**
 * トップに戻る
 */
function handleReturnHome() {
  // ローカルストレージをクリア
  if (AppState.seatId) {
    const cartKey = `cart_${AppState.seatId}`;
    const ordersKey = `orders_${AppState.seatId}`;
    const paymentKey = `paymentStatus_${AppState.seatId}`;
    
    localStorage.removeItem(cartKey);
    localStorage.removeItem(ordersKey);
    localStorage.removeItem(paymentKey);
  }

  // セッション情報もクリア
  sessionStorage.clear();
  
  // トップページへ遷移
  window.location.href = 'top_page.html';
}

/**
 * エラーメッセージを表示
 */
function showError(message) {
  alert(message);
}

/**
 * HTML エスケープ
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
