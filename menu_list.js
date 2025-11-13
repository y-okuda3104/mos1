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

function loadMenu() {
  fetch(`/api/menu?storeId=${storeId}`)
    .then(res => res.json())
    .then(data => {
      menuItems = data.items || [];
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
      <img src="${item.imageUrl}" alt="${item.name}">
      <div class="name">${item.name}</div>
      <div class="price">${item.price === 0 ? "¥0（無料）" : `¥${item.price}`}</div>
      <button ${item.soldOut ? "disabled" : ""} onclick="addToCart('${item.id}')">追加</button>
    `;
    container.appendChild(div);
  });
}

function populateCategories() {
  const select = document.getElementById("categoryFilter");
  const categories = [...new Set(menuItems.map(item => item.category))];
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
    const item = menuItems.find(i => i.id === id);
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

document.getElementById("searchInput").addEventListener("input", renderMenu);
document.getElementById("categoryFilter").addEventListener("change", renderMenu);
document.getElementById("sortOrder").addEventListener("change", renderMenu);
document.getElementById("confirmOrder").addEventListener("click", () => {
  window.location.href = "cart.html";
});

loadMenu();
loadCart();
