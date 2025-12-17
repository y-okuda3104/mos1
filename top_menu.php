<?php
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/includes/functions.php';

// POSTリクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    if ($action === 'setSeat') {
        $seatId = $_POST['seatId'] ?? '';
        if (setSeatId($seatId)) {
            jsonResponse(['success' => true, 'seatId' => getSeatId()]);
        } else {
            jsonResponse(['success' => false, 'error' => '無効な座席IDです'], 400);
        }
    } elseif ($action === 'callStaff') {
        // スタッフ呼び出し処理（ダミー）
        jsonResponse([
            'success' => true, 
            'message' => 'スタッフを呼び出しました（座席：' . getSeatId() . '）'
        ]);
    }
    exit;
}

// 現在の状態を取得
$seatId = getSeatId();
$loText = getLODisplayText();
$currentTime = getCurrentTime();
$seatOptions = generateSeatOptions();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="description" content="みどり亭 居酒屋POS注文システム - 座席管理、メニュー注文、スタッフ呼び出し" />
  <meta name="theme-color" content="#ff7f32" />
  <title>みどり亭｜トップメニュー</title>
  <link rel="stylesheet" href="top_menu.css" />
</head>
<body>
  <!-- メインヘッダー：店舗情報・座席・時刻表示 -->
  <header class="app-header" role="banner">
    <div class="header-inner">
      <div class="header-left">
        <h1 id="storeName"><?= h(STORE_NAME) ?></h1>
        <div class="status" role="status" aria-live="polite">
          <span id="seatLabel" aria-label="現在の座席">席：<?= h($seatId) ?></span>
          <span id="loLabel" aria-label="ラストオーダーまでの時間"><?= h($loText) ?></span>
          <button id="btnSetSeat" class="secondary" type="button" 
                  aria-describedby="seatLabel">
            座席変更
          </button>
        </div>
      </div>
      <div class="header-right">
        <time id="currentTime" class="current-time" 
              aria-live="polite" role="timer" 
              aria-label="現在時刻">
          <?= h($currentTime) ?>
        </time>
      </div>
    </div>
  </header>

  <!-- メインナビゲーション -->
  <main class="container" role="main">
    <nav class="grid" role="navigation" aria-label="メインメニュー">
      <a class="card" href="menu_list.php" 
         aria-describedby="menu-desc">
        <div class="card__icon" aria-hidden="true">🍽️</div>
        <h2 class="card__title">メニュー一覧</h2>
        <p class="card__desc" id="menu-desc">
          取り皿・おしぼりなどもこちらから
        </p>
      </a>

      <a class="card" href="order_history.php"
         aria-describedby="history-desc">
        <div class="card__icon" aria-hidden="true">📋</div>
        <h2 class="card__title">注文履歴</h2>
        <p class="card__desc" id="history-desc">
          ご注文の履歴・配膳状況を確認
        </p>
      </a>

      <button class="card" id="btnCall" type="button" 
              aria-describedby="call-desc">
        <div class="card__icon" aria-hidden="true">🔔</div>
        <h2 class="card__title">スタッフ呼び出し</h2>
        <p class="card__desc" id="call-desc">
          スタッフを呼び出します
        </p>
      </button>
    </nav>
  </main>

  <!-- トースト通知 -->
  <div id="toast" class="toast" role="status" aria-live="polite"></div>

  <!-- 呼び出し完了モーダル -->
  <div id="callResultModal" class="modal" hidden aria-hidden="true">
    <div class="modal__backdrop"></div>
    <div class="modal__dialog" role="dialog" aria-modal="true" 
         aria-labelledby="callResultTitle">
      <h3 id="callResultTitle">呼び出し完了</h3>
      <p id="callResultMessage">スタッフを呼び出しました</p>
      <div class="modal__actions">
        <button id="closeCallResult" class="primary" type="button">
          閉じる
        </button>
        <button id="retryCall" class="secondary" type="button" hidden>
          再試行
        </button>
      </div>
    </div>
  </div>

  <!-- 呼び出し確認モーダル -->
  <div id="callModal" class="modal" hidden aria-hidden="true">
    <div class="modal__backdrop"></div>
    <div class="modal__dialog" role="dialog" aria-modal="true" 
         aria-labelledby="callModalTitle">
      <h3 id="callModalTitle">スタッフ呼び出しの確認</h3>
      <p>呼び出したらスタッフに通知されます。呼び出しますか？</p>
      <div class="modal__actions">
        <button id="confirmCall" class="primary" type="button">
          呼び出す
        </button>
        <button id="cancelCall" class="secondary" type="button">
          閉じる
        </button>
      </div>
    </div>
  </div>

  <!-- 座席選択モーダル -->
  <div id="seatModal" class="modal" hidden aria-hidden="true">
    <div class="modal__backdrop"></div>
    <div class="modal__dialog" role="dialog" aria-modal="true" 
         aria-labelledby="seatModalTitle">
      <h3 id="seatModalTitle">座席を選択</h3>
      <p>ご利用になる座席を選択してください</p>
      <label for="seatSelect" class="form-label">座席選択</label>
      <select id="seatSelect" class="form-select" aria-required="true">
        <option value="" disabled>選択してください</option>
        <?php
        $currentGroup = '';
        foreach ($seatOptions as $option):
          if ($currentGroup !== $option['group']):
            if ($currentGroup !== '') echo '</optgroup>';
            echo '<optgroup label="' . h($option['group']) . '">';
            $currentGroup = $option['group'];
          endif;
        ?>
          <option value="<?= h($option['value']) ?>" <?= $option['value'] === $seatId ? 'selected' : '' ?>>
            <?= h($option['label']) ?>
          </option>
        <?php endforeach; ?>
        <?php if ($currentGroup !== '') echo '</optgroup>'; ?>
      </select>
      <div class="modal__actions">
        <button id="confirmSeat" class="primary" type="button">
          設定
        </button>
        <button id="cancelSeat" class="secondary" type="button">
          閉じる
        </button>
      </div>
    </div>
  </div>

  <footer class="app-footer" role="contentinfo">
    <small>&copy; 2024 みどり亭 POS システム</small>
  </footer>

  <script>
    /**
     * トップメニューシステム（PHPバージョン）
     * JavaScriptは最小限に保ち、主な処理はPHPで実行
     */
    
    const CONFIG = {
      TOAST_DURATION_MS: 3000,
      CALL_COOLDOWN_MS: 30000,
      CLOCK_UPDATE_INTERVAL: 1000,
      LO_UPDATE_INTERVAL: 60000
    };

    const state = {
      lastCallTs: 0,
      callInProgress: false,
      timers: { clock: null, loUpdate: null }
    };

    // 初期化
    document.addEventListener('DOMContentLoaded', () => {
      bindEventHandlers();
      startTimers();
    });

    function bindEventHandlers() {
      document.getElementById('btnSetSeat')?.addEventListener('click', openSeatModal);
      document.getElementById('btnCall')?.addEventListener('click', handleCallStaff);
      document.getElementById('confirmCall')?.addEventListener('click', confirmCall);
      document.getElementById('cancelCall')?.addEventListener('click', closeCallModal);
      document.getElementById('confirmSeat')?.addEventListener('click', confirmSeatSelection);
      document.getElementById('cancelSeat')?.addEventListener('click', closeSeatModal);
      document.getElementById('closeCallResult')?.addEventListener('click', closeCallResult);
      document.getElementById('retryCall')?.addEventListener('click', retryCall);
      
      document.querySelector('#callModal .modal__backdrop')?.addEventListener('click', closeCallModal);
      document.querySelector('#seatModal .modal__backdrop')?.addEventListener('click', closeSeatModal);
      document.querySelector('#callResultModal .modal__backdrop')?.addEventListener('click', closeCallResult);
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

    function openSeatModal() {
      showModal('seatModal');
    }

    function closeSeatModal() {
      hideModal('seatModal');
    }

    async function confirmSeatSelection() {
      const select = document.getElementById('seatSelect');
      const selectedSeat = select?.value;
      
      if (!selectedSeat) {
        showToast('座席を選択してください');
        return;
      }

      try {
        const formData = new FormData();
        formData.append('action', 'setSeat');
        formData.append('seatId', selectedSeat);
        
        const response = await fetch(window.location.href, {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          document.getElementById('seatLabel').textContent = '席：' + result.seatId;
          closeSeatModal();
          showToast('座席を設定しました：' + result.seatId);
          setTimeout(() => location.reload(), 1000);
        } else {
          showToast(result.error || '座席設定に失敗しました');
        }
      } catch (error) {
        console.error('座席設定エラー:', error);
        showToast('座席設定中にエラーが発生しました');
      }
    }

    function handleCallStaff() {
      const seatLabel = document.getElementById('seatLabel')?.textContent;
      if (!seatLabel || seatLabel.includes('未設定')) {
        showToast('席IDを設定してください');
        return;
      }

      if (isInCooldown()) {
        const remaining = getRemainingCooldownSeconds();
        showToast(`呼び出しはあと ${remaining} 秒で再度可能です`);
        return;
      }

      showModal('callModal');
    }

    function isInCooldown() {
      return (Date.now() - state.lastCallTs) < CONFIG.CALL_COOLDOWN_MS;
    }

    function getRemainingCooldownSeconds() {
      const remaining = CONFIG.CALL_COOLDOWN_MS - (Date.now() - state.lastCallTs);
      return Math.ceil(remaining / 1000);
    }

    async function confirmCall() {
      if (state.callInProgress) return;

      state.callInProgress = true;
      closeCallModal();

      try {
        const formData = new FormData();
        formData.append('action', 'callStaff');
        
        const response = await fetch(window.location.href, {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          state.lastCallTs = Date.now();
          showCallResult(result.message, false);
        } else {
          showCallResult('呼び出しに失敗しました', true);
        }
      } catch (error) {
        console.error('呼び出しエラー:', error);
        showCallResult('呼び出し中にエラーが発生しました', true);
      } finally {
        state.callInProgress = false;
      }
    }

    function retryCall() {
      confirmCall();
    }

    function closeCallModal() {
      hideModal('callModal');
    }

    function showCallResult(message, showRetry) {
      const messageEl = document.getElementById('callResultMessage');
      const retryBtn = document.getElementById('retryCall');
      
      if (messageEl) messageEl.textContent = message;
      if (retryBtn) retryBtn.hidden = !showRetry;
      
      showModal('callResultModal');
    }

    function closeCallResult() {
      hideModal('callResultModal');
    }

    function showModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        const focusTarget = modal.querySelector('button, input, select');
        if (focusTarget) focusTarget.focus();
      }
    }

    function hideModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
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

    window.addEventListener('beforeunload', () => {
      if (state.timers.clock) clearInterval(state.timers.clock);
      if (state.timers.loUpdate) clearInterval(state.timers.loUpdate);
    });
  </script>
</body>
</html>
