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

(function () {
  'use strict';

  /* -------------------------
     設定 / 状態
     ------------------------- */
  const storeId = '001';
  const ordersKeyBase = 'orders_';

  // シートIDはローカルで扱う（トップと衝突させない）
  const currentSeat = (function () {
    const s = localStorage.getItem('seatId') || 'C-01';
    const m = String(s).trim().toUpperCase().match(/^([A-Z])[-\s]?(\d{1,2})$/);
    return m ? `${m[1]}-${String(parseInt(m[2], 10)).padStart(2, '0')}` : 'C-01';
  })();

  const cartKey = `cart_${currentSeat}`;

  // ダミーデータ（画像は空にして表示しない）
  const DUMMY_MENU = Array.from({ length: 12 }, (_, i) => {
    const idx = i + 1;
    return {
      id: `m${String(idx).padStart(2, '0')}`,
      name: `居酒屋メニュー ${idx}`,
      price: (idx % 5 === 0) ? 0 : 500 + (idx * 50),
      imageUrl: '',
      category: (idx % 3 === 0) ? '酒肴' : (idx % 3 === 1) ? '串焼き' : '揚げ物',
      recommend: Math.floor(Math.random() * 100),
      quickOrder: Math.floor(Math.random() * 10),
      soldOut: false
    };
  });

  let menuItems = [];
  let cart = {};   // { itemId: qty }
  let orders = []; // [{id,name,price,qty,delivered,ts}, ...]

  /* -------------------------
     ユーティリティ
     ------------------------- */
  function ordersKey() { return ordersKeyBase + currentSeat; }
  function lsGet(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ } }
  function safeShowToast(msg) { if (typeof showToast === 'function') showToast(msg); else console.log('[toast]', msg); }

  /* -------------------------
     データ読み込み / 保存
     ------------------------- */
  function loadMenuFromApi() {
    return fetch(`/api/menu?storeId=${storeId}`)
      .then(r => r.ok ? r.json() : Promise.reject('no-res'))
      .then(j => (j && j.items && j.items.length) ? j.items : DUMMY_MENU)
      .catch(() => DUMMY_MENU);
  }

  function loadCart() {
    const saved = lsGet(cartKey) || {};
    cart = (typeof saved === 'object') ? saved : {};
  }
  function saveCart() { lsSet(cartKey, cart); }

  function loadOrders() {
    orders = lsGet(ordersKey()) || [];
  }
  function saveOrders() { lsSet(ordersKey(), orders); }

  /* -------------------------
     描画ロジック
     ------------------------- */
  function renderMenu() {
    const container = document.getElementById('menuContainer');
    if (!container) return;

    const keyword = (document.getElementById('searchInput') || {}).value || '';
    const category = (document.getElementById('categoryFilter') || {}).value || '';
    const sort = (document.getElementById('sortOrder') || {}).value || 'recommend';

    let items = menuItems.filter(item =>
      (!category || item.category === category) &&
      (!keyword || item.name.toLowerCase().includes(keyword.toLowerCase()))
    );

    if (sort === 'recommend') items.sort((a, b) => b.recommend - a.recommend);
    if (sort === 'category') items.sort((a, b) => a.category.localeCompare(b.category));
    if (sort === 'quick') items.sort((a, b) => a.quickOrder - b.quickOrder);

    container.innerHTML = '';
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'menuItem' + (item.soldOut ? ' soldOut' : '');
      // 画像は存在する場合のみ表示
      const imgHtml = item.imageUrl ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.name)}">` : '';
      card.innerHTML = `
        ${imgHtml}
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="price">${item.price === 0 ? '¥0（無料）' : `¥${item.price}`}</div>
        <button ${item.soldOut ? 'disabled' : ''} data-id="${escapeHtml(item.id)}">${item.soldOut ? '売切' : '追加'}</button>
      `;
      container.appendChild(card);

      const btn = card.querySelector('button[data-id]');
      if (btn && !item.soldOut) {
        btn.addEventListener('click', () => { addToCart(item.id); });
      }
    });
  }

  // 簡易 HTML エスケープ（表示目的）
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function populateCategories() {
    const sel = document.getElementById('categoryFilter');
    if (!sel) return;
    sel.innerHTML = '<option value="">すべてのカテゴリ</option>';
    const cats = Array.from(new Set(menuItems.map(i => i.category))).filter(Boolean);
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  }

  // カートの要約（点数）と詳細（商品一覧）を描画
  function renderCart() {
    const summaryCount = document.getElementById('cartCount');
    const details = document.getElementById('miniCartDetails');
    const listEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    if (!summaryCount || !listEl || !totalEl) return;

    // 要約点数
    const totalItems = Object.values(cart).reduce((s, q) => s + (Number(q) || 0), 0);
    summaryCount.textContent = String(totalItems);

    // 詳細リスト（商品名と数量、プラマイボタン）
    listEl.innerHTML = '';
    let total = 0;
    Object.entries(cart).forEach(([id, qty]) => {
      const item = menuItems.find(i => i.id === id) || { id, name: id, price: 0 };
      const li = document.createElement('li');
      li.className = 'cart-line';
      // 左：名前 xN
      const left = document.createElement('div');
      left.textContent = `${item.name} `;
      const strong = document.createElement('strong');
      strong.textContent = `x${qty}`;
      left.appendChild(strong);
      // 右：プラマイボタン
      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.gap = '6px';
      const minus = document.createElement('button');
      minus.className = 'primary';
      minus.textContent = '−';
      minus.setAttribute('aria-label', `減らす ${item.name}`);
      minus.addEventListener('click', () => { decreaseCart(id); });
      const plus = document.createElement('button');
      plus.className = 'primary';
      plus.textContent = '+';
      plus.setAttribute('aria-label', `増やす ${item.name}`);
      plus.addEventListener('click', () => { increaseCart(id); });
      right.appendChild(minus);
      right.appendChild(plus);

      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.alignItems = 'center';
      li.appendChild(left);
      li.appendChild(right);
      listEl.appendChild(li);

      total += (item.price || 0) * (Number(qty) || 0);
    });

    totalEl.textContent = `合計: ¥${total}`;
  }

  // 配膳ステータスを画面に表示
  function renderOrderStatus() {
    const del = document.getElementById('deliveredCount');
    const pend = document.getElementById('pendingCount');
    if (!del || !pend) return;
    const [delivered, pending] = orders.reduce((acc, o) => {
      acc[o.delivered ? 0 : 1] += (Number(o.qty) || 0);
      return acc;
    }, [0, 0]);
    del.textContent = String(delivered);
    pend.textContent = String(pending);
  }

  /* -------------------------
     カート操作（外部公開的な関数）
     ------------------------- */
  function addToCart(itemId) {
    cart[itemId] = (Number(cart[itemId]) || 0) + 1;
    saveCart();
    renderCart();
  }
  function removeFromCart(itemId) {
    delete cart[itemId];
    saveCart();
    renderCart();
  }
  function increaseCart(itemId) { addToCart(itemId); }
  function decreaseCart(itemId) {
    if (!cart[itemId]) return;
    if (cart[itemId] <= 1) removeFromCart(itemId);
    else { cart[itemId] = Number(cart[itemId]) - 1; saveCart(); renderCart(); }
  }

  /* -------------------------
     注文確定
     ------------------------- */
  function confirmOrder() {
    if (Object.keys(cart).length === 0) {
      safeShowToast('カートが空です');
      return;
    }
    const ts = Date.now();
    Object.entries(cart).forEach(([id, qty]) => {
      const item = menuItems.find(i => i.id === id) || { id, name: id, price: 0 };
      orders.push({ id: item.id, name: item.name, price: item.price || 0, qty: Number(qty) || 0, delivered: false, ts });
    });
    saveOrders();
    renderOrderStatus();
    cart = {};
    saveCart();
    renderCart();
    // close details if open
    const details = document.getElementById('miniCartDetails');
    const toggle = document.getElementById('miniCartToggle');
    if (details && toggle) { details.hidden = true; toggle.textContent = '表示'; }
    safeShowToast('注文を確定しました');
  }

  /* -------------------------
     初期化 / イベント登録
     ------------------------- */
  function initBindings() {
    // search / filter / sort
    const si = document.getElementById('searchInput');
    const cf = document.getElementById('categoryFilter');
    const so = document.getElementById('sortOrder');
    if (si) si.addEventListener('input', renderMenu);
    if (cf) cf.addEventListener('change', renderMenu);
    if (so) so.addEventListener('change', renderMenu);

    // cart toggle
    const toggle = document.getElementById('miniCartToggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const details = document.getElementById('miniCartDetails');
        if (!details) return;
        const nowHidden = details.hidden;
        details.hidden = !nowHidden;
        toggle.textContent = nowHidden ? '閉じる' : '表示';
        if (!details.hidden) renderCart();
      });
    }

    // confirm order
    const confirmBtn = document.getElementById('confirmOrder');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmOrder);
  }

  /* -------------------------
     初期化エントリ
     ------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    initBindings();
    loadCart();
    loadOrders();
    menuItems = await loadMenuFromApi();
    populateCategories();
    renderMenu();
    renderCart();
    renderOrderStatus();

    // startClock がトップ側で提供されていれば実行（時刻表示）
    if (typeof startClock === 'function') {
      try { startClock(); } catch (e) { console.warn('startClock failed', e); }
    }
  });

  /* -------------------------
     デバッグ用（手動で配膳済みにする等）
     ------------------------- */
  window.__menu_debug = {
    addToCart,
    removeFromCart,
    increaseCart,
    decreaseCart,
    confirmOrder,
    markDelivered: (id) => { orders = orders.map(o => o.id === id ? ({ ...o, delivered: true }) : o); saveOrders(); renderOrderStatus(); }
  };
})();
