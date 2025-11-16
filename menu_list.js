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
    imageUrl: `https://via.placeholder.com/400x300/ff7f32/ffffff?text=Dish+${idx}`,
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

function renderCart() {
  // 要約（個数）更新
  const cartCountEl = document.getElementById('cartCount');
  let totalItems = 0;
  Object.values(cart).forEach(q => totalItems += q || 0);
  if (cartCountEl) cartCountEl.textContent = String(totalItems);

  // 詳細リストが開かれている場合は内容を描画
  const details = document.getElementById('miniCartDetails');
  const ul = document.getElementById("cartItems");
  const totalDiv = document.getElementById("cartTotal");
  if (!ul || !totalDiv) return;
  ul.innerHTML = "";
  let total = 0;
  Object.entries(cart).forEach(([id, qty]) => {
    const item = menuItems.find(i => i.id === id);
    if (!item) return;
    const li = document.createElement("li");
    // 商品名、数量、+/-ボタン表示
    li.innerHTML = `
      <span>${item.name} x${qty}</span>
      <button class="qty-btn" data-id="${id}" data-action="dec">−</button>
      <button class="qty-btn" data-id="${id}" data-action="inc">+</button>
    `;
    ul.appendChild(li);
    // イベントリスナーを追加
    const decBtn = li.querySelector('button[data-action="dec"]');
    const incBtn = li.querySelector('button[data-action="inc"]');
    if (decBtn) decBtn.addEventListener('click', () => {
      if (cart[id] > 1) {
        cart[id]--;
      } else {
        delete cart[id];
      }
      saveCart();
      renderCart();
    });
    if (incBtn) incBtn.addEventListener('click', () => {
      cart[id]++;
      saveCart();
      renderCart();
    });
    total += (item.price || 0) * qty;
  });
  totalDiv.textContent = `合計: ¥${total}`;

  // 詳細が非表示なら中身は空にしてもよい（上で描画済み）
  if (details && details.hidden) {
    // do nothing (summary already updated)
  }
}

// ミニカートのトグル処理
const cartToggleBtn = document.getElementById('miniCartToggle');
if (cartToggleBtn) {
  cartToggleBtn.addEventListener('click', () => {
    const details = document.getElementById('miniCartDetails');
    if (!details) return;
    const shown = !details.hidden;
    details.hidden = shown;
    cartToggleBtn.textContent = shown ? '表示' : '閉じる';
    // render in case contents changed
    renderCart();
  });
}

// 注文確定ボタンイベントは既存の confirmOrder ハンドラで処理しているためそのまま使う。
// （既に confirmBtn のイベント登録が行われています）
const confirmBtn = document.getElementById('confirmOrder');
if (confirmBtn) confirmBtn.addEventListener('click', () => {
  // 注文確定：カート内の商品をordersに移す（未配膳）
  if (Object.keys(cart).length === 0) {
    showToast('カートが空です');
    return;
  }
  const now = Date.now();
  Object.entries(cart).forEach(([id, qty]) => {
    const item = menuItems.find(i => i.id === id) || { id, name: id, price: 0 };
    orders.push({ id: item.id, name: item.name, price: item.price, qty, delivered: false, ts: now });
  });
  // 保存してUIを更新
  saveOrders();
  cart = {};
  saveCart();
  renderCart();
  renderOrderStatus();
  showToast('注文を確定しました');
  // カート詳細を非表示に
  const details = document.getElementById('miniCartDetails');
  if (details) details.hidden = true;
  const toggle = document.getElementById('miniCartToggle');
  if (toggle) toggle.textContent = '表示';
});

// 注文ステータス描画
function renderOrderStatus() {
  const delEl = document.getElementById('deliveredCount');
  const pendEl = document.getElementById('pendingCount');
  if (!delEl || !pendEl) return;
  const delivered = orders.reduce((s,o) => s + ((o.delivered) ? o.qty : 0), 0);
  const pending = orders.reduce((s,o) => s + ((o.delivered) ? 0 : o.qty), 0);
  delEl.textContent = String(delivered);
  pendEl.textContent = String(pending);
}

// 初期ロード
loadMenu();
loadCart();
loadOrders();

// 時刻表示の補強：DOMContentLoaded後に明示的に呼び出す
document.addEventListener('DOMContentLoaded', () => {
  if (typeof startClock === 'function') {
    try { startClock(); } catch (e) { /* ignore */ }
  }
});

// タイムアウトフォールバック（top_menu.js が読み込まれていない場合に手動実装）
setTimeout(() => {
  if (typeof startClock === 'undefined') {
    const el = document.getElementById('currentTime');
    if (el) {
      const fmt = (n) => String(n).padStart(2, '0');
      const tick = () => {
        const d = new Date();
        el.textContent = `${fmt(d.getHours())}:${fmt(d.getMinutes())}:${fmt(d.getSeconds())}`;
      };
      tick();
      setInterval(tick, 1000);
    }
  }
}, 100);

// expose helpers in console for manual testing: mark delivered
window.__orders = orders;
window.markDelivered = (id) => {
  // マニュアルで特定注文を配膳済みにするユーティリティ（デバッグ用）
  orders = orders.map(o => o.id === id ? ({...o, delivered: true}) : o);
  saveOrders();
  renderOrderStatus();
};
