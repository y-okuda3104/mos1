<?php
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/includes/functions.php';

// POSTリクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    if ($action === 'addToCart') {
        $itemId = $_POST['itemId'] ?? '';
        if ($itemId) {
            $cart = addToCart($itemId);
            jsonResponse(['success' => true, 'cart' => $cart]);
        }
    } elseif ($action === 'removeFromCart') {
        $itemId = $_POST['itemId'] ?? '';
        if ($itemId) {
            $cart = removeFromCart($itemId);
            jsonResponse(['success' => true, 'cart' => $cart]);
        }
    } elseif ($action === 'updateQuantity') {
        $itemId = $_POST['itemId'] ?? '';
        $quantity = intval($_POST['quantity'] ?? 0);
        if ($itemId) {
            $cart = updateCartQuantity($itemId, $quantity);
            jsonResponse(['success' => true, 'cart' => $cart]);
        }
    } elseif ($action === 'confirmOrder') {
        $cart = getCart();
        $menuItems = getMenuItems();
        
        if (empty($cart)) {
            jsonResponse(['success' => false, 'error' => 'カートが空です'], 400);
        }
        
        $timestamp = round(microtime(true) * 1000);
        
        foreach ($cart as $itemId => $quantity) {
            $item = array_filter($menuItems, function($i) use ($itemId) {
                return $i['id'] === $itemId;
            });
            $item = reset($item);
            
            if ($item) {
                addOrder([
                    'id' => $item['id'],
                    'name' => $item['name'],
                    'price' => $item['price'] ?? 0,
                    'qty' => $quantity,
                    'delivered' => false,
                    'ts' => $timestamp
                ]);
            }
        }
        
        clearCart();
        jsonResponse(['success' => true, 'message' => '注文を確定しました']);
    }
    exit;
}

// GETリクエストでカートデータをJSON形式で返す（Ajax用）
if (isset($_GET['ajax']) && $_GET['ajax'] === 'getCart') {
    $cart = getCart();
    $menuItems = getMenuItems();
    $total = calculateCartTotal($cart, $menuItems);
    $count = calculateCartCount($cart);
    $orders = getOrders();
    $deliveryStatus = calculateDeliveryStatus($orders);
    
    jsonResponse([
        'cart' => $cart,
        'total' => $total,
        'count' => $count,
        'deliveryStatus' => $deliveryStatus
    ]);
}

// 現在の状態を取得
$seatId = getSeatId();
$loText = getLODisplayText();
$currentTime = getCurrentTime();
$menuItems = getMenuItems();
$cart = getCart();
$orders = getOrders();
$categories = getCategories($menuItems);
$deliveryStatus = calculateDeliveryStatus($orders);
$cartCount = calculateCartCount($cart);
$cartTotal = calculateCartTotal($cart, $menuItems);

// フィルタリング
$keyword = $_GET['search'] ?? '';
$category = $_GET['category'] ?? '';
$filteredItems = filterMenuItems($menuItems, $keyword, $category);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="みどり亭 メニュー一覧 - 料理の検索・注文・カート管理">
  <meta name="theme-color" content="#ff7f32">
  <title>メニュー一覧 - 居酒屋みどり亭</title>
  <link rel="stylesheet" href="menu_list.css">
</head>
<body>
  <!-- ヘッダー：店舗情報・座席・LO・現在時刻 -->
  <header class="app-header" role="banner">
    <div class="header-inner">
      <div class="header-left">
        <h1 id="storeName"><?= h(STORE_NAME) ?></h1>
        <div class="status" role="status" aria-live="polite">
          <span id="seatLabel" aria-label="現在の座席">席：<?= h($seatId) ?></span>
          <span id="loLabel" aria-label="ラストオーダーまでの時間"><?= h($loText) ?></span>
        </div>
      </div>
      <div class="header-right">
        <a href="top_menu.php" class="top-link" aria-label="トップメニューへ戻る">TOPへ</a>
        <time id="currentTime" class="current-time" aria-live="polite" role="timer"><?= h($currentTime) ?></time>
      </div>
    </div>
  </header>
  
  <!-- 検索・フィルタ機能 -->
  <section class="search-bar container" role="search" aria-label="メニュー検索・フィルタ">
    <div class="search-input-row">
      <label for="searchInput" class="visually-hidden">メニュー検索</label>
      <input type="text" id="searchInput" 
             placeholder="メニュー検索" 
             aria-label="料理名で検索"
             value="<?= h($keyword) ?>">
    </div>
    
    <div id="categoryTabs" class="category-tabs" role="tablist" aria-label="カテゴリ選択">
      <button class="category-tab <?= $category === '' ? 'active' : '' ?>" 
              data-category="" type="button">すべて</button>
      <?php foreach ($categories as $cat): ?>
        <button class="category-tab <?= $category === $cat ? 'active' : '' ?>" 
                data-category="<?= h($cat) ?>" type="button"><?= h($cat) ?></button>
      <?php endforeach; ?>
    </div>
  </section>
  
  <!-- メニュー表示エリア -->
  <main id="menuContainer" class="container" role="main" aria-label="メニュー一覧">
    <?php if (empty($filteredItems)): ?>
      <div class="no-results">該当するメニューが見つかりません</div>
    <?php else: ?>
      <?php foreach ($filteredItems as $item): ?>
        <div class="menuItem<?= $item['soldOut'] ? ' soldOut' : '' ?>">
          <?php if ($item['imageUrl']): ?>
            <img src="<?= h($item['imageUrl']) ?>" alt="<?= h($item['name']) ?>" loading="lazy">
          <?php endif; ?>
          <div class="name"><?= h($item['name']) ?></div>
          <div class="price">
            <?= $item['price'] === 0 ? '¥0（無料）' : '¥' . h($item['price']) ?>
          </div>
          <button <?= $item['soldOut'] ? 'disabled' : '' ?>
                  data-id="<?= h($item['id']) ?>"
                  data-name="<?= h($item['name']) ?>"
                  aria-label="<?= $item['soldOut'] ? '売切' : h($item['name']) . 'をカートに追加' ?>">
            <?= $item['soldOut'] ? '売切' : '追加' ?>
          </button>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </main>
  
  <!-- カートシステム -->
  <aside id="miniCart" role="complementary" aria-label="注文カート">
    <div id="miniCartSummary">
      <div class="cart-summary__info">
        <span role="status" aria-live="polite">
          カート：<strong id="cartCount" aria-label="カート内商品数"><?= h($cartCount) ?></strong> 点
        </span>
        <span class="order-status" role="status" aria-live="polite">
          配膳済み: <span id="deliveredCount" aria-label="配膳済み商品数"><?= h($deliveryStatus['delivered']) ?></span> 点　/　
          未配膳: <span id="pendingCount" aria-label="未配膳商品数"><?= h($deliveryStatus['pending']) ?></span> 点
        </span>
      </div>
      <div>
        <button id="miniCartToggle" class="secondary" type="button"
                aria-expanded="false" aria-controls="miniCartDetails">
          表示
        </button>
      </div>
    </div>

    <div id="miniCartDetails" hidden aria-hidden="true">
      <h3>カートの中身</h3>
      <ul id="cartItems" role="list" aria-label="カート内商品一覧">
        <?php if (empty($cart)): ?>
          <li class="empty-cart">カートは空です</li>
        <?php else: ?>
          <?php foreach ($cart as $itemId => $quantity): ?>
            <?php
              $item = array_filter($menuItems, function($i) use ($itemId) {
                return $i['id'] === $itemId;
              });
              $item = reset($item) ?: ['id' => $itemId, 'name' => $itemId, 'price' => 0];
            ?>
            <li class="cart-item">
              <div class="cart-item__info">
                <span class="cart-item__name"><?= h($item['name']) ?></span>
                <strong class="cart-item__quantity">x<?= h($quantity) ?></strong>
              </div>
              <div class="cart-item__controls">
                <button class="primary cart-button decrease-btn" 
                        data-id="<?= h($itemId) ?>"
                        aria-label="減らす <?= h($item['name']) ?>">−</button>
                <button class="primary cart-button increase-btn" 
                        data-id="<?= h($itemId) ?>"
                        aria-label="増やす <?= h($item['name']) ?>">+</button>
              </div>
            </li>
          <?php endforeach; ?>
        <?php endif; ?>
      </ul>
      <div id="cartTotal" role="status" aria-live="polite">
        合計: ¥<?= h($cartTotal) ?>
      </div>
      <button id="confirmOrder" class="primary" type="button">
        注文確定
      </button>
    </div>
  </aside>
  
  <script>
    /**
     * メニュー一覧システム（PHPバージョン）
     */
    
    const CONFIG = {
      CLOCK_UPDATE_INTERVAL: 1000,
      LO_UPDATE_INTERVAL: 60000,
      SEARCH_DEBOUNCE_MS: 300
    };

    const state = {
      timers: { clock: null, loUpdate: null },
      searchTimeout: null
    };

    // 初期化
    document.addEventListener('DOMContentLoaded', () => {
      bindEventHandlers();
      startTimers();
    });

    function bindEventHandlers() {
      // メニュー追加ボタン
      document.querySelectorAll('.menuItem button[data-id]').forEach(btn => {
        btn.addEventListener('click', handleAddToCart);
      });

      // カート操作
      document.getElementById('miniCartToggle')?.addEventListener('click', toggleCartDetails);
      document.getElementById('confirmOrder')?.addEventListener('click', confirmOrder);
      
      document.querySelectorAll('.increase-btn').forEach(btn => {
        btn.addEventListener('click', (e) => updateQuantity(e.target.dataset.id, 1));
      });
      
      document.querySelectorAll('.decrease-btn').forEach(btn => {
        btn.addEventListener('click', (e) => updateQuantity(e.target.dataset.id, -1));
      });

      // 検索
      document.getElementById('searchInput')?.addEventListener('input', handleSearch);

      // カテゴリタブ
      document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', handleCategoryChange);
      });
    }

    function handleSearch(e) {
      clearTimeout(state.searchTimeout);
      state.searchTimeout = setTimeout(() => {
        const keyword = e.target.value;
        const category = document.querySelector('.category-tab.active')?.dataset.category || '';
        const url = new URL(window.location);
        url.searchParams.set('search', keyword);
        url.searchParams.set('category', category);
        window.location.href = url.toString();
      }, CONFIG.SEARCH_DEBOUNCE_MS);
    }

    function handleCategoryChange(e) {
      const category = e.target.dataset.category || '';
      const keyword = document.getElementById('searchInput')?.value || '';
      const url = new URL(window.location);
      url.searchParams.set('search', keyword);
      url.searchParams.set('category', category);
      window.location.href = url.toString();
    }

    async function handleAddToCart(e) {
      const btn = e.target;
      const itemId = btn.dataset.id;
      const itemName = btn.dataset.name;
      
      if (!itemId) return;

      const originalText = btn.textContent;
      btn.textContent = '追加済み';
      btn.disabled = true;

      try {
        const formData = new FormData();
        formData.append('action', 'addToCart');
        formData.append('itemId', itemId);
        
        const response = await fetch(window.location.href, {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          await updateCartDisplay();
        }
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 1000);
      } catch (error) {
        console.error('カート追加エラー:', error);
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }

    async function updateQuantity(itemId, delta) {
      try {
        // 現在の数量を取得
        const cartItem = document.querySelector(`.cart-item button[data-id="${itemId}"]`);
        if (!cartItem) return;
        
        const quantityEl = cartItem.closest('.cart-item').querySelector('.cart-item__quantity');
        const currentQty = parseInt(quantityEl.textContent.replace('x', '')) || 0;
        const newQty = currentQty + delta;

        const formData = new FormData();
        formData.append('action', 'updateQuantity');
        formData.append('itemId', itemId);
        formData.append('quantity', newQty);
        
        const response = await fetch(window.location.href, {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          location.reload();
        }
      } catch (error) {
        console.error('数量更新エラー:', error);
      }
    }

    function toggleCartDetails() {
      const details = document.getElementById('miniCartDetails');
      const toggle = document.getElementById('miniCartToggle');
      
      if (details && toggle) {
        const isHidden = details.hidden;
        details.hidden = !isHidden;
        toggle.textContent = isHidden ? '閉じる' : '表示';
        toggle.setAttribute('aria-expanded', String(!isHidden));
      }
    }

    async function confirmOrder() {
      if (confirm('注文を確定しますか？')) {
        try {
          const formData = new FormData();
          formData.append('action', 'confirmOrder');
          
          const response = await fetch(window.location.href, {
            method: 'POST',
            body: formData
          });
          
          const result = await response.json();
          
          if (result.success) {
            alert(result.message);
            location.reload();
          } else {
            alert(result.error || '注文に失敗しました');
          }
        } catch (error) {
          console.error('注文エラー:', error);
          alert('注文中にエラーが発生しました');
        }
      }
    }

    async function updateCartDisplay() {
      try {
        const response = await fetch('?ajax=getCart');
        const data = await response.json();
        
        document.getElementById('cartCount').textContent = data.count;
        document.getElementById('deliveredCount').textContent = data.deliveryStatus.delivered;
        document.getElementById('pendingCount').textContent = data.deliveryStatus.pending;
      } catch (error) {
        console.error('カート更新エラー:', error);
      }
    }

    function startTimers() {
      startClock();
      startLOTimer();
    }

    function startClock() {
      const updateClock = () => {
        const now = new Date();
        const timeString = [now.getHours(), now.getMinutes(), now.getSeconds()]
          .map(n => String(n).padStart(2, '0')).join(':');
        
        const clockEl = document.getElementById('currentTime');
        if (clockEl) {
          clockEl.textContent = timeString;
          clockEl.setAttribute('datetime', now.toISOString());
        }
      };
      
      updateClock();
      state.timers.clock = setInterval(updateClock, CONFIG.CLOCK_UPDATE_INTERVAL);
    }

    function startLOTimer() {
      const updateLO = () => {
        fetch(window.location.href, { 
          method: 'GET',
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(response => response.text())
        .then(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const loText = doc.getElementById('loLabel')?.textContent;
          if (loText) {
            document.getElementById('loLabel').textContent = loText;
          }
        })
        .catch(console.error);
      };
      
      state.timers.loUpdate = setInterval(updateLO, CONFIG.LO_UPDATE_INTERVAL);
    }

    window.addEventListener('beforeunload', () => {
      if (state.timers.clock) clearInterval(state.timers.clock);
      if (state.timers.loUpdate) clearInterval(state.timers.loUpdate);
    });
  </script>
</body>
</html>
