/**
 * メニュー一覧ページ（menu_list.html）のロジック
 * 
 * 機能：
 * - ダミーメニュー12品を表示（API未応答時のフォールバック）
 * - 検索・カテゴリ絞込・ソート機能
 * - カート管理（localStorage に seat 単位で保存）
 * - 注文確定機能（orders に遷移して未配膳としてカウント）
 * - 配膳状態の表示（配膳済み / 未配膳）
 * 
 * 座席がトップメニューで「英字1文字-2桁」形式（例 C-05）で設定され、
 * localStorage['seatId'] に保存されることを前提としています。
 */

const storeId = "001"; // 仮の店舗ID
let menuItems = [];
let cart = {}; // { itemId: quantity, ... }
/* note: top_menu.js でも `seatId` をグローバルに定義しているため衝突を避ける。
   menu_list.js 側ではローカルな currentSeat を使用する。
   currentSeat は localStorage の seatId を正規化した値（例: C-05）を持つ。
*/
let currentSeat = normalizeSeatId(localStorage.getItem("seatId") || "C-01");

const cartKey = `cart_${currentSeat}`;

/**
 * ダミーメニュー生成（API未応答時のフォールバック用、12品）
 * 画像 URL は空に設定（プレースホルダー表示を避けるため）
 */
const DUMMY_MENU = Array.from({length:12}, (_,i) => {
  const idx = i + 1;
  return {
    id: `m${String(idx).padStart(2,'0')}`,
    name: `居酒屋メニュー ${idx}`,
    price: (idx % 5 === 0) ? 0 : 500 + (idx * 50),
    imageUrl: '', // 画像なし（URL を空に）
    category: (idx % 3 === 0) ? '酒肴' : (idx % 3 === 1) ? '串焼き' : '揚げ物',
    recommend: Math.floor(Math.random()*100),
    quickOrder: Math.floor(Math.random()*10),
    soldOut: false
  };
});

/**
 * 注文管理オブジェクト
 * orders は { id, name, price, qty, delivered, ts } の配列
 */
let orders = [];
const ordersKeyBase = 'orders_';

function getOrdersKey() {
  return ordersKeyBase + (currentSeat || 'unknown');
}

/**
 * localStorage から注文履歴を読み込む
 */
function loadOrders() {
  try {
    const raw = localStorage.getItem(getOrdersKey());
    orders = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load orders:', e);
    orders = [];
  }
  renderOrderStatus();
}

/**
 * 注文履歴を localStorage に保存
 */
function saveOrders() {
  localStorage.setItem(getOrdersKey(), JSON.stringify(orders));
}

/**
 * メニューを読み込む（API or ダミー）
 */
function loadMenu() {
  fetch(`/api/menu?storeId=${storeId}`)
    .then(res => res.json())
    .then(data => {
      menuItems = (data && data.items && data.items.length) ? data.items : DUMMY_MENU;
      renderMenu();
      populateCategories();
    })
    .catch(() => {
      // フォールバック：API 応答なしの場合
      console.warn('Menu API unavailable, using dummy menu');
      menuItems = DUMMY_MENU;
      renderMenu();
      populateCategories();
    });
}

/**
 * メニューを画面に描画
 * 検索・カテゴリ・ソート条件を適用してフィルタリング
 */
function renderMenu() {
  const container = document.getElementById("menuContainer");
  if (!container) return;

  const keywordEl = document.getElementById("searchInput");
  const categoryEl = document.getElementById("categoryFilter");
  const sortEl = document.getElementById("sortOrder");
  const keyword = keywordEl ? String(keywordEl.value).toLowerCase() : '';
  const category = categoryEl ? categoryEl.value : '';
  const sort = sortEl ? sortEl.value : 'recommend';

  // フィルタリング
  let filtered = menuItems.filter(item => {
    return (!category || item.category === category) &&
           (!keyword || item.name.toLowerCase().includes(keyword));
  });

  // ソート
  if (sort === "recommend") filtered.sort((a, b) => b.recommend - a.recommend);
  if (sort === "category") filtered.sort((a, b) => a.category.localeCompare(b.category));
  if (sort === "quick") filtered.sort((a, b) => a.quickOrder - b.quickOrder);

  container.innerHTML = "";
  filtered.forEach(item => {
    const div = document.createElement("div");
    div.className = "menuItem" + (item.soldOut ? " soldOut" : "");
    
    // 画像表示は URL が存在する場合のみ
    const imgHtml = item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}">` : '';
    
    div.innerHTML = `
      ${imgHtml}
      <div class="name">${item.name}</div>
      <div class="price">${item.price === 0 ? "¥0（無料）" : `¥${item.price}`}</div>
      <button ${item.soldOut ? "disabled" : ""} data-id="${item.id}">${item.soldOut ? '売切' : '追加'}</button>
    `;
    container.appendChild(div);

    // ボタンイベント登録（安全なデータ属性使用）
    const btn = div.querySelector('button[data-id]');
    if (btn && !item.soldOut) {
      btn.addEventListener('click', () => addToCart(item.id));
    }
  });
}

/**
 * カテゴリ選択肢を動的に生成
 */
function populateCategories() {
  const select = document.getElementById("categoryFilter");
  if (!select) return;
  select.innerHTML = '<option value="">すべてのカテゴリ</option>';
  const categories = [...new Set(menuItems.map(item => item.category))];
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

/**
 * カートに商品を追加
 */
function addToCart(itemId) {
  cart[itemId] = (cart[itemId] || 0) + 1;
  saveCart();
  renderCart();
}

/**
 * カートから商品を削除
 */
function removeFromCart(itemId) {
  delete cart[itemId];
  saveCart();
  renderCart();
}

/**
 * カートの数量を増やす
 */
function increaseCart(itemId) {
  cart[itemId] = (cart[itemId] || 0) + 1;
  saveCart();
  renderCart();
}

/**
 * カートの数量を減らす
 */
function decreaseCart(itemId) {
  if (!cart[itemId] || cart[itemId] <= 1) {
    removeFromCart(itemId);
  } else {
    cart[itemId]--;
    saveCart();
    renderCart();
  }
}

/**
 * カートを localStorage に保存
 */
function saveCart() {
  localStorage.setItem(cartKey, JSON.stringify(cart));
}

/**
 * localStorage からカートを読み込む
 */
function loadCart() {
  const saved = localStorage.getItem(cartKey);
  cart = saved ? JSON.parse(saved) : {};
  renderCart();
}

/**
 * カート UI を描画・更新
 * - 要約（点数表示）を常時表示
 * - 詳細（リスト・合計・プラマイボタン）は初期非表示
 */
function renderCart() {
  // 要約：カート内の総点数を計算
  const cartCountEl = document.getElementById('cartCount');
  let totalItems = 0;
  Object.values(cart).forEach(q => totalItems += (q || 0));
  if (cartCountEl) cartCountEl.textContent = String(totalItems);

  // 詳細リスト描画
  const ul = document.getElementById("cartItems");
  const totalDiv = document.getElementById("cartTotal");
  if (!ul || !totalDiv) return;

  ul.innerHTML = "";
  let total = 0;
  Object.entries(cart).forEach(([id, qty]) => {
    const item = menuItems.find(i => i.id === id);
    if (!item) return;

    // リスト行を作成
    const li = document.createElement("li");
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.justifyContent = 'space-between';
    li.style.marginBottom = '8px';
    li.style.padding = '8px';
    li.style.background = '#f5f5f5';
    li.style.borderRadius = '6px';

    // 商品名と数量
    const nameQty = document.createElement('span');
    nameQty.textContent = `${item.name} `;
    const nameQtyStrong = document.createElement('strong');
    nameQtyStrong.textContent = `x${qty}`;
    nameQty.appendChild(nameQtyStrong);

    // プラマイボタンコンテナ
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '4px';
    btnContainer.style.alignItems = 'center';

    // マイナスボタン
    const minusBtn = document.createElement('button');
    minusBtn.textContent = '−';
    minusBtn.className = 'primary';
    minusBtn.style.padding = '6px 10px';
    minusBtn.style.fontSize = '16px';
    minusBtn.style.minWidth = '44px'; // 44px 相当の操作領域に変更
    minusBtn.setAttribute('aria-label', `減らす ${item.name}`);
    minusBtn.addEventListener('click', () => decreaseCart(id));

    // プラスボタン
    const plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    plusBtn.className = 'primary';
    plusBtn.style.padding = '6px 10px';
    plusBtn.style.fontSize = '16px';
    plusBtn.style.minWidth = '44px'; // 44px 相当の操作領域に変更
    plusBtn.setAttribute('aria-label', `増やす ${item.name}`);
    plusBtn.addEventListener('click', () => increaseCart(id));

    btnContainer.appendChild(minusBtn);
    btnContainer.appendChild(plusBtn);

    li.appendChild(nameQty);
    li.appendChild(btnContainer);
    ul.appendChild(li);

    total += (item.price || 0) * qty;
  });
  totalDiv.textContent = `合計: ¥${total}`;
}

/**
 * 注文ステータス表示を更新
 * 配膳済み / 未配膳の点数を集計して表示
 */
function renderOrderStatus() {
  const delEl = document.getElementById('deliveredCount');
  const pendEl = document.getElementById('pendingCount');
  if (!delEl || !pendEl) return;

  // orders から配膳状態別に集計
  let delivered = 0;
  let pending = 0;
  orders.forEach(o => {
    if (o.delivered) {
      delivered += (o.qty || 0);
    } else {
      pending += (o.qty || 0);
    }
  });

  delEl.textContent = String(delivered);
  pendEl.textContent = String(pending);
}

/**
 * カート表示トグルボタンのイベント処理
 */
const cartToggleBtn = document.getElementById('miniCartToggle');
if (cartToggleBtn) {
  cartToggleBtn.addEventListener('click', () => {
    const details = document.getElementById('miniCartDetails');
    if (!details) return;
    const isHidden = details.hidden;
    details.hidden = !isHidden;
    cartToggleBtn.textContent = isHidden ? '閉じる' : '表示';
    // 詳細開時に内容を更新
    if (!details.hidden) {
      renderCart();
    }
  });
}

/**
 * 注文確定ボタンのイベント処理
 * カート内の商品を orders に移して未配膳としてカウント
 */
const confirmBtn = document.getElementById('confirmOrder');
if (confirmBtn) {
  confirmBtn.addEventListener('click', () => {
    // カートが空の場合は何もしない
    if (Object.keys(cart).length === 0) {
      showToast('カートが空です');
      return;
    }

    // 各商品を orders に追加（未配膳フラグを false で）
    const now = Date.now();
    Object.entries(cart).forEach(([id, qty]) => {
      const item = menuItems.find(i => i.id === id) || { id, name: id, price: 0 };
      orders.push({
        id: item.id,
        name: item.name,
        price: item.price || 0,
        qty: qty || 0,
        delivered: false,
        ts: now
      });
    });

    // 保存して UI を更新
    saveOrders();
    renderOrderStatus(); // 注文ステータスを先に更新
    cart = {};
    saveCart();
    renderCart();

    // トグルを閉じる
    const details = document.getElementById('miniCartDetails');
    if (details) {
      details.hidden = true;
      cartToggleBtn.textContent = '表示';
    }

    if (typeof showToast === 'function') {
      showToast('注文を確定しました');
    }
  });
}

/**
 * 追加：座席ID正規化関数を先に定義（currentSeat の初期化で使用するため）
 */
function normalizeSeatId(input) {
  if (!input) return null;
  const s = String(input).trim().toUpperCase();
  const m = s.match(/^([A-Z])[-\s]?(\d{1,2})$/);
  if (!m) return null;
  return `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, '0')}`;
}

/**
 * イベント登録（要素が存在するかチェック）
 */
document.addEventListener('DOMContentLoaded', () => {
  // 検索・フィルタ・ソートイベント
  const si = document.getElementById("searchInput");
  if (si) si.addEventListener("input", renderMenu);
  const cf = document.getElementById("categoryFilter");
  if (cf) cf.addEventListener("change", renderMenu);
  const so = document.getElementById("sortOrder");
  if (so) so.addEventListener("change", renderMenu);

  // ミニカートのトグル
  const cartToggleBtn = document.getElementById('miniCartToggle');
  if (cartToggleBtn) {
    cartToggleBtn.addEventListener('click', () => {
      const details = document.getElementById('miniCartDetails');
      if (!details) return;
      const isHidden = details.hidden;
      details.hidden = !isHidden;
      cartToggleBtn.textContent = isHidden ? '閉じる' : '表示';
      if (!details.hidden) {
        renderCart();
      }
    });
  }

  // 注文確定ボタン（カート→orders）
  const confirmBtn = document.getElementById('confirmOrder');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (Object.keys(cart).length === 0) {
        showToast('カートが空です');
        return;
      }

      const now = Date.now();
      Object.entries(cart).forEach(([id, qty]) => {
        const item = menuItems.find(i => i.id === id) || { id, name: id, price: 0 };
        orders.push({
          id: item.id,
          name: item.name,
          price: item.price || 0,
          qty: qty || 0,
          delivered: false,
          ts: now
        });
      });

      saveOrders();
      renderOrderStatus();
      cart = {};
      saveCart();
      renderCart();

      const details = document.getElementById('miniCartDetails');
      if (details) {
        details.hidden = true;
        if (cartToggleBtn) cartToggleBtn.textContent = '表示';
      }

      if (typeof showToast === 'function') {
        showToast('注文を確定しました');
      }
    });
  }

  // 初回データ読み込み（DOM 準備後に実行）
  loadMenu();
  loadCart();
  loadOrders();

  // top_menu.js に定義された startClock があれば即実行（なければ無視）
  if (typeof startClock === 'function') {
    try {
      startClock();
    } catch (e) {
      console.warn('startClock failed:', e);
    }
  }
});

/**
 * showToast 関数が top_menu.js から読み込まれない場合の代替実装
 */
if (typeof showToast === 'undefined') {
  window.showToast = (message) => {
    const toast = document.getElementById('toast');
    if (!toast) {
      console.log('[Toast]', message);
      return;
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  };
}

/**
 * デバッグ用ユーティリティ：配膳済みに手動で変更
 */
window.markDelivered = (id) => {
  orders = orders.map(o => o.id === id ? ({...o, delivered: true}) : o);
  saveOrders();
  renderOrderStatus();
};
