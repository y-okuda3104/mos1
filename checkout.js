/**
 * 会計処理スクリプト
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 2.5秒間、「会計処理中...」画面を表示
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // API呼び出し（デモのため成功を返す）
    await completePayment();
    
    // 完了画面を表示
    displayCompletedScreen();
    
  } catch (error) {
    console.error('Checkout error:', error);
    displayErrorScreen();
  }
});

async function completePayment() {
  try {
    // デモちょっと待つ
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // AppStateの支払い状態を完了に
    AppState.completePayment();
    
    // API呼び出し
    if (typeof API !== 'undefined' && API.completePayment) {
      await API.completePayment(AppState.seatId, AppState.getCartTotal());
    }
    
    // カートをクリア
    AppState.clearCart();
  } catch (error) {
    console.error('Payment completion failed:', error);
    throw error;
  }
}

function displayCompletedScreen() {
  const container = document.getElementById('checkoutContent');
  if (!container) return;
  
  const total = AppState.getCartTotal();
  const seatId = AppState.seatId || 'N/A';
  const itemCount = AppState.getCartItemCount();
  
  container.innerHTML = `
    <div class="completed-state">
      <h2>会計完了</h2>
      <div class="icon">✓</div>
      <p>お支払いが完了いたしました</p>
      <p style="font-size: 12px; color: #666; margin-top: 10px;">
        ご利用ありがとうございました
      </p>
      
      <div class="receipt">
        <div class="receipt-item">
          <span>座席</span>
          <strong>${escapeHtml(seatId)}</strong>
        </div>
        <div class="receipt-item">
          <span>商品数</span>
          <strong>${itemCount} 点</strong>
        </div>
        <div class="receipt-total">
          <span>合計金額</span>
          <span>¥${formatPrice(total)}</span>
        </div>
      </div>
      
      <button class="btn-return" onclick="returnToTop()">
        TOPへ戻る
      </button>
    </div>
  `;
}

function displayErrorScreen() {
  const container = document.getElementById('checkoutContent');
  if (!container) return;
  
  container.innerHTML = `
    <div class="completed-state">
      <h2>エラーが発生しました</h2>
      <p>会計処理中にエラーが発生しました</p>
      <button class="btn-return" onclick="returnToTop()">
        TOPへ戻る
      </button>
    </div>
  `;
}

function returnToTop() {
  // 支払い状態をリセット
  resetPaymentStatus();
  AppState.qrScanned = false;
  localStorage.removeItem('seatId');
  
  // QR entry へリダイレクト
  window.location.href = 'qr_entry.html';
}

function formatPrice(price) {
  return String(price).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
