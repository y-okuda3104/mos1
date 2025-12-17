<?php
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/includes/functions.php';

// POSTリクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    if ($action === 'toggleDelivered') {
        $index = intval($_POST['index'] ?? -1);
        $orders = getOrders();
        
        if ($index >= 0 && $index < count($orders)) {
            $orders[$index]['delivered'] = !($orders[$index]['delivered'] ?? false);
            saveOrders($orders);
            jsonResponse([
                'success' => true, 
                'message' => $orders[$index]['delivered'] ? '配膳済みにしました' : '未配膳に戻しました'
            ]);
        }
    } elseif ($action === 'removeOrder') {
        $index = intval($_POST['index'] ?? -1);
        $orders = getOrders();
        
        if ($index >= 0 && $index < count($orders)) {
            array_splice($orders, $index, 1);
            saveOrders($orders);
            jsonResponse(['success' => true, 'message' => '注文を削除しました']);
        }
    } elseif ($action === 'clearHistory') {
        clearOrders();
        jsonResponse(['success' => true, 'message' => '履歴を削除しました']);
    }
    exit;
}

// 現在の状態を取得
$seatId = getSeatId();
$loText = getLODisplayText();
$currentTime = getCurrentTime();
$orders = getOrders();
$deliveryStatus = calculateDeliveryStatus($orders);

// フィルタリング
$filter = $_GET['filter'] ?? 'all';
$filteredOrders = $orders;

if ($filter === 'pending') {
    $filteredOrders = array_filter($orders, function($order) {
        return !($order['delivered'] ?? false);
    });
} elseif ($filter === 'delivered') {
    $filteredOrders = array_filter($orders, function($order) {
        return $order['delivered'] ?? false;
    });
}

// 新しい順に並べ替え
$filteredOrders = array_reverse($filteredOrders);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>注文履歴 - みどり亭</title>
  <link rel="stylesheet" href="order_history.css">
</head>
<body>
  <header class="app-header" role="banner">
    <div class="header-inner">
      <div class="header-left">
        <h1 id="storeName"><?= h(STORE_NAME) ?></h1>
        <div class="status" role="status" aria-live="polite">
          <span id="seatLabel">席：<?= h($seatId) ?></span>
          <span id="loLabel"><?= h($loText) ?></span>
        </div>
      </div>
      <div class="header-right">
        <a href="top_menu.php" class="top-link" aria-label="トップへ">TOPへ</a>
        <time id="currentTime" class="current-time" aria-live="polite"><?= h($currentTime) ?></time>
      </div>
    </div>
  </header>

  <main class="container" role="main">
    <section class="controls">
      <div class="counts">
        配膳済み: <strong id="deliveredCount"><?= h($deliveryStatus['delivered']) ?></strong> 点 /
        未配膳: <strong id="pendingCount"><?= h($deliveryStatus['pending']) ?></strong> 点
      </div>
      <div class="filters" role="tablist" aria-label="注文フィルタ">
        <a href="?filter=all" class="filter-btn <?= $filter === 'all' ? 'active' : '' ?>">全て</a>
        <a href="?filter=pending" class="filter-btn <?= $filter === 'pending' ? 'active' : '' ?>">未配膳</a>
        <a href="?filter=delivered" class="filter-btn <?= $filter === 'delivered' ? 'active' : '' ?>">配膳済み</a>
        <button id="clearHistory" class="secondary" type="button">履歴を削除</button>
      </div>
    </section>

    <section id="ordersList" class="orders-list" aria-live="polite">
      <?php if (empty($filteredOrders)): ?>
        <div class="no-results">注文履歴がありません</div>
      <?php else: ?>
        <?php 
        $reversedOrders = array_values($filteredOrders);
        foreach ($reversedOrders as $idx => $order): 
          // 元の配列のインデックスを取得
          $originalIndex = array_search($order, $orders);
        ?>
          <div class="order-card">
            <div class="order-info">
              <div class="order-meta">
                <div class="order-name"><?= h($order['name'] ?? $order['id'] ?? '不明') ?></div>
                <div class="order-qty">
                  x<?= h($order['qty'] ?? 0) ?> — ¥<?= h(($order['price'] ?? 0) * ($order['qty'] ?? 0)) ?>
                </div>
                <div class="order-ts">
                  <?php
                    $timestamp = $order['ts'] ?? 0;
                    $dateStr = date('Y/m/d', $timestamp / 1000);
                    $timeStr = formatTimestamp($timestamp);
                    echo h($timeStr) . ' (' . h($dateStr) . ')';
                  ?>
                </div>
              </div>
            </div>
            <div class="order-actions">
              <div class="tag <?= ($order['delivered'] ?? false) ? 'delivered' : 'pending' ?>">
                <?= ($order['delivered'] ?? false) ? '配膳済み' : '未配膳' ?>
              </div>
              <button class="primary toggle-delivered-btn" 
                      data-index="<?= h($originalIndex) ?>"
                      type="button">
                <?= ($order['delivered'] ?? false) ? '未配膳に戻す' : '配膳済みにする' ?>
              </button>
              <button class="secondary remove-order-btn" 
                      data-index="<?= h($originalIndex) ?>"
                      type="button">削除</button>
            </div>
          </div>
        <?php endforeach; ?>
      <?php endif; ?>
    </section>
  </main>

  <div id="toast" class="toast" role="status" aria-live="polite"></div>

  <script>
    /**
     * 注文履歴システム（PHPバージョン）
     */
    
    const CONFIG = {
      CLOCK_UPDATE_INTERVAL: 1000,
      LO_UPDATE_INTERVAL: 60000,
      TOAST_DURATION_MS: 3000
    };

    const state = {
      timers: { clock: null, loUpdate: null }
    };

    // 初期化
    document.addEventListener('DOMContentLoaded', () => {
      bindEventHandlers();
      startTimers();
    });

    function bindEventHandlers() {
      // 配膳状態トグル
      document.querySelectorAll('.toggle-delivered-btn').forEach(btn => {
        btn.addEventListener('click', handleToggleDelivered);
      });

      // 注文削除
      document.querySelectorAll('.remove-order-btn').forEach(btn => {
        btn.addEventListener('click', handleRemoveOrder);
      });

      // 履歴削除
      document.getElementById('clearHistory')?.addEventListener('click', handleClearHistory);
    }

    async function handleToggleDelivered(e) {
      const index = e.target.dataset.index;
      
      try {
        const formData = new FormData();
        formData.append('action', 'toggleDelivered');
        formData.append('index', index);
        
        const response = await fetch(window.location.href, {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          showToast(result.message);
          setTimeout(() => location.reload(), 500);
        }
      } catch (error) {
        console.error('配膳状態更新エラー:', error);
      }
    }

    async function handleRemoveOrder(e) {
      if (!confirm('この注文を削除しますか？')) return;
      
      const index = e.target.dataset.index;
      
      try {
        const formData = new FormData();
        formData.append('action', 'removeOrder');
        formData.append('index', index);
        
        const response = await fetch(window.location.href, {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          showToast(result.message);
          setTimeout(() => location.reload(), 500);
        }
      } catch (error) {
        console.error('注文削除エラー:', error);
      }
    }

    async function handleClearHistory() {
      if (!confirm('注文履歴を本当に削除しますか？')) return;
      
      try {
        const formData = new FormData();
        formData.append('action', 'clearHistory');
        
        const response = await fetch(window.location.href, {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          showToast(result.message);
          setTimeout(() => location.reload(), 500);
        }
      } catch (error) {
        console.error('履歴削除エラー:', error);
      }
    }

    function showToast(message) {
      const toast = document.getElementById('toast');
      if (!toast) return;

      toast.textContent = message;
      toast.classList.add('show');

      setTimeout(() => {
        toast.classList.remove('show');
      }, CONFIG.TOAST_DURATION_MS);
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
