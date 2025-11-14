const storeId = "001"; // 仮の店舗ID
let menuItems = [];
let cart = {};
let seatId = localStorage.getItem("seatId") || "C-01";

function normalizeSeatId(input) {
  if (!input) return null;
  const s = String(input).trim().toUpperCase();
  const m = s.match(/^([A-Z])[-\s]?(\d{1,2})$/);
  if (!m) return null;
  return `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, '0')}`;
}
seatId = normalizeSeatId(seatId);
const cartKey = `cart_${seatId}`;

// ダミーメニュー（API未応答時のフォールバック、12品）
const DUMMY_MENU = Array.from({length:12}, (_,i) => {
  const idx = i + 1;
  return {
    id: `m${String(idx).padStart(2,'0')}`,
    name: `居酒屋メニュー ${idx}`,
    price: (idx % 5 === 0) ? 0 : 500 + (idx * 50),
    imageUrl: `https://via.placeholder.com/400x300?text=Dish+${idx}`,
    category: (idx % 3 === 0) ? '酒肴' : (idx % 3 === 1) ? '串焼き' : '揚げ物',
    recommend: Math.floor(Math.random()*100),
    quickOrder: Math.floor(Math.random()*10),
    soldOut: false
  };
});

// orders を seat 単位で保存（配膳ステータスを持つ）
let orders = [];
const ordersKeyBase = 'orders_';

function getOrdersKey() {
  return ordersKeyBase + (seatId || 'unknown');
}

function loadOrders() {
  try {
    const raw = localStorage.getItem(getOrdersKey());
    orders = raw ? JSON.parse(raw) : [];
  } catch (e) {
    orders = [];
  }
  renderOrderStatus();
}

function saveOrders() {
  localStorage.setItem(getOrdersKey(), JSON.stringify(orders));
}

// API のフォールバック対応：空やエラーの場合は DUMMY_MENU を使う
function loadMenu() {
  fetch(`/api/menu?storeId=${storeId}`)
    .then(res => res.json())
    .then(data => {
      menuItems = (data && data.items && data.items.length) ? data.items : DUMMY_MENU;
      renderMenu();
      populateCategories();
    })
    .catch(() => {
      // フォールバック
      menuItems = DUMMY_MENU;
      renderMenu();
      populateCategories();
    });
}

function renderMenu() {
  const container = document.getElementById("menuContainer");
  const keywordEl = document.getElementById("searchInput");
  const categoryEl = document.getElementById("categoryFilter");
  const sortEl = document.getElementById("sortOrder");
  const keyword = keywordEl ? String(keywordEl.value).toLowerCase() : '';
  const category = categoryEl ? categoryEl.value : '';
  const sort = sortEl ? sortEl.value : 'recommend';

  let filtered = menuItems.filter(item => {
    return (!category || item.category === category) &&
           (!keyword || item.name.toLowerCase().includes(keyword));
  });

  if (sort === "recommend") filtered.sort((a, b) => b.recommend - a.recommend);
  if (sort === "category") filtered.sort((a, b) => a.category.localeCompare(b.category));
  if (sort === "quick") filtered.sort((a, b) => a.quickOrder - b.quickOrder);

  container.innerHTML = "";
  filtered.forEach(item => {
    const div = document.createElement("div");
    div.className = "menuItem" + (item.soldOut ? " soldOut" : "");
    div.innerHTML = `
      <img src="${item.imageUrl}" alt="${item.name}">
      <div class="name">${item.name}</div>
      <div class="price">${item.price === 0 ? "¥0（無料）" : `¥${item.price}`}</div>
      <button ${item.soldOut ? "disabled" : ""} data-id="${item.id}">${item.soldOut ? '売切' : '追加'}</button>
    `;
    container.appendChild(div);
    // 安全にボタンイベントを割り当て（onclick属性回避）
    const btn = div.querySelector('button[data-id]');
    if (btn && !item.soldOut) {
      btn.addEventListener('click', () => addToCart(item.id));
    }
  });
}

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

function addToCart(itemId) {
  cart[itemId] = (cart[itemId] || 0) + 1;
  saveCart();
  renderCart();
}

function removeFromCart(itemId) {
  delete cart[itemId];
  saveCart();
  renderCart();
}

function saveCart() {
  localStorage.setItem(cartKey, JSON.stringify(cart));
}

function loadCart() {
  const saved = localStorage.getItem(cartKey);
  cart = saved ? JSON.parse(saved) : {};
  renderCart();
}

/* ===== 初期化（UIイベントの確実な登録） ===== */
function initUI() {
  // 検索・フィルタ・ソート
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
      const currentlyShown = !details.hidden;
      details.hidden = currentlyShown;
      cartToggleBtn.textContent = currentlyShown ? '表示' : '閉じる';
      renderCart(); // 展開時に詳細を描画
    });
  }

  // 注文確定ボタン（存在すれば確実に登録）
  const confirmBtn = document.getElementById("confirmOrder");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      // 注文確定：カート内の商品を orders に移す（未配膳）
      const now = Date.now();
      Object.entries(cart).forEach(([id, qty]) => {
        if (!qty || qty <= 0) return;
        const item = menuItems.find(i => i.id === id) || { id, name: id, price: 0 };
        orders.push({ id: item.id, name: item.name, price: item.price, qty, delivered: false, ts: now });
      });
      // 保存してUIを更新
      saveOrders();
      cart = {};
      saveCart();
      // カート詳細は閉じる
      const details = document.getElementById('miniCartDetails');
      const toggle = document.getElementById('miniCartToggle');
      if (details) details.hidden = true;
      if (toggle) toggle.textContent = '表示';
      renderCart();
      renderOrderStatus();
      showToast('注文を確定しました（未配膳）');
    });
  }
}

// 数量を変更するユーティリティ（+/-）
// delta は正負の整数
function changeCartQty(itemId, delta) {
  const prev = cart[itemId] || 0;
  const next = Math.max(0, prev + delta);
  if (next === 0) {
    delete cart[itemId];
  } else {
    cart[itemId] = next;
  }
  saveCart();
  renderCart();
}

/* ===== renderCart の強化 ===== */
function renderCart() {
  // 要約（個数）更新
  const cartCountEl = document.getElementById('cartCount');
  let totalItems = 0;
  Object.values(cart).forEach(q => totalItems += q || 0);
  if (cartCountEl) cartCountEl.textContent = String(totalItems);

  // 注文ステータス要約も更新（配膳済/未配膳）
  const delEl = document.getElementById('deliveredCount');
  const pendEl = document.getElementById('pendingCount');
  if (delEl && pendEl) {
    const delivered = orders.reduce((s,o) => s + ((o.delivered) ? o.qty : 0), 0);
    const pending = orders.reduce((s,o) => s + ((o.delivered) ? 0 : o.qty), 0);
    delEl.textContent = String(delivered);
    pendEl.textContent = String(pending);
  }

  // 詳細リストが開かれている場合は内容を描画（＋/− ボタンを付与）
  const details = document.getElementById('miniCartDetails');
  const ul = document.getElementById("cartItems");
  const totalDiv = document.getElementById("cartTotal");
  if (!ul || !totalDiv) return;
  ul.innerHTML = "";
  let total = 0;
  Object.entries(cart).forEach(([id, qty]) => {
    const item = menuItems.find(i => i.id === id) || { id, name: id, price: 0 };
    const li = document.createElement("li");

    // 左：商品名 x 数量
    const left = document.createElement('div');
    left.textContent = `${item.name} x${qty}`;

    // 右：操作（− ボタン、＋ ボタン）と金額（optional）
    const right = document.createElement('div');

    // マイナスボタン
    const minus = document.createElement('button');
    minus.className = 'qty-btn secondary';
    minus.type = 'button';
    minus.textContent = '−';
    minus.addEventListener('click', () => {
      changeCartQty(id, -1);
    });

    // プラスボタン
    const plus = document.createElement('button');
    plus.className = 'qty-btn primary';
    plus.type = 'button';
    plus.textContent = '+';
    plus.addEventListener('click', () => {
      changeCartQty(id, +1);
    });

    // 合計金額小表示
    const priceSpan = document.createElement('span');
    priceSpan.style.marginLeft = '8px';
    priceSpan.textContent = `¥${(item.price || 0) * qty}`;

    right.appendChild(minus);
    right.appendChild(plus);
    right.appendChild(priceSpan);

    li.appendChild(left);
    li.appendChild(right);
    ul.appendChild(li);

    total += (item.price || 0) * qty;
  });
  totalDiv.textContent = `合計: ¥${total}`;
}

/* ===== renderOrderStatus の再利用（UI反映を確実に） ===== */
function renderOrderStatus() {
  const delEl = document.getElementById('deliveredCount');
  const pendEl = document.getElementById('pendingCount');
  if (!delEl || !pendEl) return;
  const delivered = orders.reduce((s,o) => s + ((o.delivered) ? o.qty : 0), 0);
  const pending = orders.reduce((s,o) => s + ((o.delivered) ? 0 : o.qty), 0);
  delEl.textContent = String(delivered);
  pendEl.textContent = String(pending);
}

/* ===== 初期ロード ===== */
// menuItems / cart / orders を読み込んでから UI 初期化・描画
loadMenu();
loadCart();
loadOrders();
initUI();
renderCart();
renderOrderStatus();

// 時刻表示の補強（top_menu.js の startClock が読み込まれている場合に呼び出す）
if (typeof startClock === 'function') {
  try { startClock(); } catch (e) { /* ignore */ }
}

// expose helpers in console for manual testing: mark delivered
window.__orders = orders;
window.markDelivered = (id) => {
  // マニュアルで特定注文を配膳済みにするユーティリティ（デバッグ用）
  orders = orders.map(o => o.id === id ? ({...o, delivered: true}) : o);
  saveOrders();
  renderOrderStatus();
};
