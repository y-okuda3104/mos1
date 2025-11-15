const storeId = "001";
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

// ダミーメニュー
const DUMMY_MENU = Array.from({ length: 12 }, (_, i) => {
  const idx = i + 1;
  return {
    id: `m${String(idx).padStart(2, '0')}`,
    name: `居酒屋メニュー ${idx}`,
    price: (idx % 5 === 0) ? 0 : 500 + (idx * 50),
    imageUrl: `https://via.placeholder.com/400x300?text=Dish+${idx}`,
    category: (idx % 3 === 0) ? '酒肴' : (idx % 3 === 1) ? '串焼き' : '揚げ物',
    recommend: Math.floor(Math.random() * 100),
    quickOrder: Math.floor(Math.random() * 10),
    soldOut: false
  };
});

function loadMenu() {
  fetch(`/api/menu?storeId=${storeId}`)
    .then(res => res.json())
    .then(data => {
      menuItems = (data && data.items && data.items.length) ? data.items : DUMMY_MENU;
      renderMenu();
      populateCategories();
    })
    .catch(() => {
      menuItems = DUMMY_MENU;
      renderMenu();
      populateCategories();
    });
}

function renderMenu() {
  const container = document.getElementById("menuContainer");
  const keyword = document.getElementById("searchInput").value.toLowerCase();
  const category = document.getElementById("categoryFilter").value;
  const sort = document.getElementById("sortOrder").value;

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
      ${item.imageUrl}
      <div class="name">${item.name}</div>
      <div class="price">${item.price === 0 ? "¥0（無料）" : `¥${item.price}`}</div>
      <button ${item.soldOut ? "disabled" : ""} data-id="${item.id}">
        ${item.soldOut ? '売切' : '追加'}
      </button>
    `;
    container.appendChild(div);
    const btn = div.querySelector('button[data-id]');
    if (btn && !item.soldOut) {
      btn.addEventListener('click', () => addToCart(item.id));
    }
  });
}

function populateCategories() {
  const select = document.getElementById("categoryFilter");
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

function changeCartQty(itemId, delta) {
  const prev = cart[itemId] || 0;
  const next = Math.max(0, prev + delta);
  if (next === 0) delete cart[itemId];
  else cart[itemId] = next;
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
  const cartCountEl = document.getElementById('cartCount');
  let totalItems = 0;
  Object.values(cart).forEach(q => totalItems += q);
  if (cartCountEl) cartCountEl.textContent = String(totalItems);

  const ul = document.getElementById("cartItems");
  const totalDiv = document.getElementById("cartTotal");
  ul.innerHTML = "";
  let total = 0;
  Object.entries(cart).forEach(([id, qty]) => {
    const item = menuItems.find(i => i.id === id) || { id, name: id, price: 0 };
    const li = document.createElement("li");
    const left = document.createElement('div');
    left.textContent = `${item.name} x${qty}`;
    const right = document.createElement('div');
    const minus = document.createElement('button');
    minus.className = 'qty-btn secondary';
    minus.textContent = '−';
    minus.addEventListener('click', () => changeCartQty(id, -1));
    const plus = document.createElement('button');
    plus.className = 'qty-btn primary';
    plus.textContent = '+';
    plus.addEventListener('click', () => changeCartQty(id, 1));
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

document.getElementById("searchInput").addEventListener("input", renderMenu);
document.getElementById("categoryFilter").addEventListener("change", renderMenu);
document.getElementById("sortOrder").addEventListener("change", renderMenu);
document.getElementById("confirmOrder").addEventListener("click", () => {
  alert("注文を確定しました（モック）");
});

loadMenu();
loadCart();