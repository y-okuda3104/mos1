const storeId = "001"; // 仮の店舗ID
let menuItems = [];
let cart = {};
let seatId = localStorage.getItem("seatId") || "C-01";
const PAGE_SIZE = 6;
let currentPage = 1;

function normalizeSeatId(input) {
  if (!input) return null;
  const s = String(input).trim().toUpperCase();
  const m = s.match(/^([A-Z])[-\s]?(\d{1,2})$/);
  if (!m) return null;
  return `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, '0')}`;
}
seatId = normalizeSeatId(seatId) || 'C-01';
const cartKey = `cart_${seatId}`;
const ordersKey = `orders_${seatId}`;

// mock menu 12品（居酒屋風）
const mockMenu = [
  { id: 'm01', name: '枝豆', category: '小鉢', price: 300, imageUrl: 'https://via.placeholder.com/400x300?text=枝豆', recommend: 10, quickOrder: 5 },
  { id: 'm02', name: '冷奴', category: '小鉢', price: 280, imageUrl: 'https://via.placeholder.com/400x300?text=冷奴', recommend: 9, quickOrder: 6 },
  { id: 'm03', name: '唐揚げ', category: '揚物', price: 580, imageUrl: 'https://via.placeholder.com/400x300?text=唐揚げ', recommend: 15, quickOrder: 10 },
  { id: 'm04', name: 'ポテトフライ', category: '揚物', price: 420, imageUrl: 'https://via.placeholder.com/400x300?text=ポテトフライ', recommend: 12, quickOrder: 8 },
  { id: 'm05', name: '刺身盛り合わせ', category: '刺身', price: 1280, imageUrl: 'https://via.placeholder.com/400x300?text=刺身盛り', recommend: 20, quickOrder: 2 },
  { id: 'm06', name: 'だし巻き玉子', category: '焼物', price: 520, imageUrl: 'https://via.placeholder.com/400x300?text=だし巻き', recommend: 11, quickOrder: 4 },
  { id: 'm07', name: '焼き鳥（塩）', category: '焼物', price: 200, imageUrl: 'https://via.placeholder.com/400x300?text=焼き鳥', recommend: 14, quickOrder: 7 },
  { id: 'm08', name: '焼き鳥（タレ）', category: '焼物', price: 200, imageUrl: 'https://via.placeholder.com/400x300?text=焼き鳥', recommend: 13, quickOrder: 7 },
  { id: 'm09', name: '天ぷら盛り', category: '揚物', price: 980, imageUrl: 'https://via.placeholder.com/400x300?text=天ぷら', recommend: 8, quickOrder: 3 },
  { id: 'm10', name: '漬物盛り', category: '小鉢', price: 350, imageUrl: 'https://via.placeholder.com/400x300?text=漬物', recommend: 6, quickOrder: 9 },
  { id: 'm11', name: '白ごはん', category: 'ご飯', price: 200, imageUrl: 'https://via.placeholder.com/400x300?text=ごはん', recommend: 5, quickOrder: 15 },
  { id: 'm12', name: '味噌汁', category: '汁物', price: 180, imageUrl: 'https://via.placeholder.com/400x300?text=味噌汁', recommend: 4, quickOrder: 14 }
];

// 初期化処理
function init() {
  // UI イベント
  document.getElementById("searchInput").addEventListener("input", () => { currentPage = 1; renderMenu(); });
  document.getElementById("categoryFilter").addEventListener("change", () => { currentPage = 1; renderMenu(); });
  document.getElementById("sortOrder").addEventListener("change", () => { currentPage = 1; renderMenu(); });
  document.getElementById("prevPage").addEventListener("click", () => { if (currentPage>1) { currentPage--; renderMenu(); } });
  document.getElementById("nextPage").addEventListener("click", () => { currentPage++; renderMenu(); });
  document.getElementById("confirmOrder").addEventListener("click", placeOrder);

  loadMenu(); // fetch or mock
  loadCart();
  loadOrders();
  renderOrderSummary();
}

// メニュー読み込み（API フェッチ失敗時は mock を使う）
function loadMenu() {
  fetch(`/api/menu?storeId=${storeId}`)
    .then(res => {
      if (!res.ok) throw new Error('fetch failed');
      return res.json();
    })
    .then(data => {
      menuItems = data.items || mockMenu;
      renderMenu();
      populateCategories();
    })
    .catch(() => {
      // フォールバック：モックを使用
      menuItems = mockMenu;
      renderMenu();
      populateCategories();
    });
}

function renderMenu() {
  const container = document.getElementById("menuContainer");
  const keyword = (document.getElementById("searchInput").value || '').toLowerCase();
  const category = document.getElementById("categoryFilter").value;
  const sort = document.getElementById("sortOrder").value;

  let filtered = menuItems.filter(item => {
    return (!category || item.category === category) &&
           (!keyword || item.name.toLowerCase().includes(keyword));
  });

  if (sort === "recommend") filtered.sort((a, b) => (b.recommend || 0) - (a.recommend || 0));
  if (sort === "category") filtered.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  if (sort === "quick") filtered.sort((a, b) => (a.quickOrder || 0) - (b.quickOrder || 0));

  // ページ数計算
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  container.innerHTML = "";
  pageItems.forEach(item => {
    const div = document.createElement("div");
    div.className = "menuItem" + (item.soldOut ? " soldOut" : "");
    div.innerHTML = `
      <img src="${item.imageUrl}" alt="${item.name}">
      <div class="name">${item.name}</div>
      <div class="meta">${item.category}</div>
      <div class="price">${item.price === 0 ? "¥0（無料）" : `¥${item.price}`}</div>
      <button ${item.soldOut ? "disabled" : ""} data-id="${item.id}">追加</button>
    `;
    const btn = div.querySelector('button');
    btn.addEventListener('click', () => addToCart(item.id));
    container.appendChild(div);
  });

  // ページ情報表示切替
  document.getElementById('pageInfo').textContent = `${currentPage} / ${totalPages}`;
  document.getElementById('prevPage').disabled = (currentPage <= 1);
  document.getElementById('nextPage').disabled = (currentPage >= totalPages);
}

function populateCategories() {
  const select = document.getElementById("categoryFilter");
  select.innerHTML = '<option value="">すべてのカテゴリ</option>';
  const categories = [...new Set(menuItems.map(item => item.category || ''))];
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function addToCart(itemId) {
  cart[itemId] = (cart[itemId] || 0) + 1;
  saveCart();
  renderCart();
  showToast('カートに追加しました');
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
  const ul = document.getElementById("cartItems");
  const totalDiv = document.getElementById("cartTotal");
  ul.innerHTML = "";
  let total = 0;
  Object.entries(cart).forEach(([id, qty]) => {
    const item = menuItems.find(i => i.id === id) || mockMenu.find(i => i.id === id);
    if (!item) return;
    const li = document.createElement("li");
    li.textContent = `${item.name} x${qty} - ¥${item.price * qty}`;
    const btn = document.createElement("button");
    btn.textContent = "削除";
    btn.onclick = () => removeFromCart(id);
    li.appendChild(btn);
    ul.appendChild(li);
    total += item.price * qty;
  });
  totalDiv.textContent = `合計: ¥${total}`;
}

// 注文（ローカル保存）と擬似配膳
function loadOrders() {
  const s = localStorage.getItem(ordersKey);
  return s ? JSON.parse(s) : [];
}
function saveOrders(orders) {
  localStorage.setItem(ordersKey, JSON.stringify(orders));
  renderOrderSummary();
}

function placeOrder() {
  if (!Object.keys(cart).length) {
    showToast('カートが空です');
    return;
  }
  const orders = loadOrders();
  const order = {
    id: `o_${Date.now()}`,
    items: { ...cart },
    served: false,
    createdAt: Date.now()
  };
  orders.push(order);
  saveOrders(orders);
  // カートクリア
  cart = {};
  saveCart();
  renderCart();
  showToast('注文を確定しました（未配膳）');

  // 擬似配膳：数秒後に配膳済みにする（デモ用）
  setTimeout(() => {
    const os = loadOrders();
    const idx = os.findIndex(o => o.id === order.id);
    if (idx !== -1) {
      os[idx].served = true;
      saveOrders(os);
      showToast('注文が配膳済みに更新されました');
    }
  }, 10000); // 10秒後に配膳済みに
}

function renderOrderSummary() {
  const orders = loadOrders();
  let servedCount = 0;
  let pendingCount = 0;
  orders.forEach(o => {
    const qty = Object.values(o.items).reduce((a,b)=>a+b,0);
    if (o.served) servedCount += qty; else pendingCount += qty;
  });
  const servedEl = document.getElementById('servedCount');
  const pendingEl = document.getElementById('pendingCount');
  if (servedEl) servedEl.textContent = `配膳済み: ${servedCount}`;
  if (pendingEl) pendingEl.textContent = `未配膳: ${pendingCount}`;
}

// 初期化実行
init();

// Expose some helpers for debugging (任意)
window._ml_debug = { reload: loadMenu, cartKey, ordersKey };
