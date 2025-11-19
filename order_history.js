(function(){
  // ユーティリティ
  function normalizeSeatId(input) {
    if (!input) return null;
    const s = String(input).trim().toUpperCase();
    const m = s.match(/^([A-Z])[-\s]?(\d{1,2})$/);
    return m ? `${m[1]}-${String(parseInt(m[2],10)).padStart(2,'0')}` : null;
  }
  function qs(id){ return document.getElementById(id); }
  function fmtTs(ts){
    try {
      const d = new Date(Number(ts));
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    } catch(e){ return ''; }
  }

  // 状態
  let seatId = normalizeSeatId(localStorage.getItem('seatId') || 'C-01');
  let orders = [];
  let currentFilter = 'all'; // all | pending | delivered
  const ordersKey = () => `orders_${seatId || 'unknown'}`;

  // DOM
  const elSeatLabel = qs('seatLabel');
  const elDelivered = qs('deliveredCount');
  const elPending = qs('pendingCount');
  const elOrdersList = qs('ordersList');
  const elToast = qs('toast');

  // 初期化
  function init(){
    updateSeatLabel();
    loadOrders();
    bindEvents();
    render();
    if (typeof startClock === 'function') {
      try { startClock(); } catch(e){ /* ignore */ }
    }
  }

  function updateSeatLabel(){
    if (elSeatLabel) elSeatLabel.textContent = `席：${seatId || '未設定'}`;
  }

  function loadOrders(){
    try {
      const raw = localStorage.getItem(ordersKey());
      orders = raw ? JSON.parse(raw) : [];
    } catch(e){
      console.error('orders load err', e);
      orders = [];
    }
  }

  function saveOrders(){
    try {
      localStorage.setItem(ordersKey(), JSON.stringify(orders));
    } catch(e){
      console.error('orders save err', e);
    }
  }

  function bindEvents(){
    // filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn=>{
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter || 'all';
        render();
      });
    });

    const clearBtn = qs('clearHistory');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (!confirm('注文履歴を本当に削除しますか？')) return;
      orders = [];
      saveOrders();
      render();
      if (typeof showToast === 'function') showToast('履歴を削除しました');
    });
  }

  function render(){
    renderCounts();
    renderList();
  }

  function renderCounts(){
    const summary = orders.reduce((s,o)=>{
      if (o.delivered) s.delivered += o.qty || 0;
      else s.pending += o.qty || 0;
      return s;
    }, {delivered:0,pending:0});
    if (elDelivered) elDelivered.textContent = String(summary.delivered);
    if (elPending) elPending.textContent = String(summary.pending);
  }

  function renderList(){
    if (!elOrdersList) return;
    elOrdersList.innerHTML = '';
    const list = filteredOrders();
    if (list.length === 0){
      elOrdersList.innerHTML = '<div class="no-results">注文履歴がありません</div>';
      return;
    }

    list.forEach((o, idx) => {
      const card = document.createElement('div');
      card.className = 'order-card';

      const info = document.createElement('div');
      info.className = 'order-info';
      const meta = document.createElement('div');
      meta.className = 'order-meta';
      const name = document.createElement('div');
      name.className = 'order-name';
      name.textContent = o.name || o.id || '不明';
      const qty = document.createElement('div');
      qty.className = 'order-qty';
      qty.textContent = `x${o.qty || 0}  —  ¥${(o.price||0) * (o.qty||0)}`;
      const ts = document.createElement('div');
      ts.className = 'order-ts';
      ts.textContent = fmtTs(o.ts) + (o.ts ? ` (${new Date(Number(o.ts)).toLocaleDateString()})` : '');
      meta.appendChild(name);
      meta.appendChild(qty);
      meta.appendChild(ts);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'order-actions';

      const tag = document.createElement('div');
      tag.className = 'tag ' + (o.delivered ? 'delivered' : 'pending');
      tag.textContent = o.delivered ? '配膳済み' : '未配膳';
      actions.appendChild(tag);

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'primary';
      toggleBtn.textContent = o.delivered ? '未配膳に戻す' : '配膳済みにする';
      toggleBtn.addEventListener('click', () => {
        toggleDelivered(idx, o.id);
      });
      actions.appendChild(toggleBtn);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'secondary';
      removeBtn.textContent = '削除';
      removeBtn.addEventListener('click', () => {
        if (!confirm('この注文を削除しますか？')) return;
        removeOrderByIndex(idx);
      });
      actions.appendChild(removeBtn);

      card.appendChild(info);
      card.appendChild(actions);
      elOrdersList.appendChild(card);
    });
  }

  function filteredOrders(){
    if (currentFilter === 'all') return orders.slice().reverse(); // 新しい順
    if (currentFilter === 'pending') return orders.filter(o => !o.delivered).slice().reverse();
    return orders.filter(o => o.delivered).slice().reverse();
  }

  function toggleDelivered(idxReversed, id){
    // idxReversed corresponds to reversed list index; map to original index
    // Simpler: find by id and timestamp if provided; otherwise use index mapping from filtered list
    const filtered = filteredOrders();
    const item = filtered[idxReversed];
    if (!item) return;
    // find actual index in orders array by matching unique ts+id
    const realIdx = orders.findIndex(o => (o.ts == item.ts) && (o.id == item.id));
    if (realIdx === -1) return;
    orders[realIdx] = { ...orders[realIdx], delivered: !orders[realIdx].delivered };
    saveOrders();
    render();
    if (typeof showToast === 'function') showToast(orders[realIdx].delivered ? '配膳済みにしました' : '未配膳に戻しました');
  }

  function removeOrderByIndex(idxReversed){
    const filtered = filteredOrders();
    const item = filtered[idxReversed];
    if (!item) return;
    const realIdx = orders.findIndex(o => (o.ts == item.ts) && (o.id == item.id));
    if (realIdx === -1) return;
    orders.splice(realIdx,1);
    saveOrders();
    render();
    if (typeof showToast === 'function') showToast('注文を削除しました');
  }

  // 外部デバッグ用
  window.__ordersHistory = orders;
  window.refreshOrderHistory = function(){
    loadOrders();
    render();
  };

  // 起動
  document.addEventListener('DOMContentLoaded', init);
})();
