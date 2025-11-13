/**
 * トップメニュー（更新版）
 * - 店舗名表示
 * - 現在時刻（右上）を1秒ごと更新
 * - ラストオーダーまでの残時間表示・通知
 * - 席ID設定（localStorage）／スタッフ呼び出し（モック）
 * 
 * 今後の変更・修正点
 * - 座席ID様式未設定
 * 
 */

/* ===== 設定（営業時間） ===== */
const STORE_NAME = 'みどり亭 ○○店';
const STORE_CLOSE = { hour: 24, minute: 0 };  // 0:00
const LO_MINUS_MIN = 30;                      // 閉店30分前
// ===== トースト設定 =====
// モード:
//  - 'overwrite' : スナックバーのように上書き（イベントが来たら表示を更新し、タイマーをリセット）
//  - 'queue'     : 表示中は新着を保留し、表示が消えたら保留中の最新だけを表示する（連続時は最後のみ）
const TOAST_MODE = 'overwrite'; // 'overwrite' | 'queue'
const TOAST_DURATION_MS = 3000; // 表示時間（ミリ秒）

/* ===== 状態 ===== */
let seatId = null;
let notifiedLO = false;

/* ===== 新規設定 ===== */
const SEAT_REGEX = /^[A-Z]-\d{2}$/; // 英字1文字-2桁（例: C-05）
const COOLDOWN_MS = 30_000;         // 呼び出しのクールダウン（ミリ秒）
const LO_API = '/api/lo';           // LO情報取得（サーバー） 単純化したエンドポイント名
const CALL_API = '/api/call';       // スタッフ呼び出しAPI（mock）

let lastCallTs = 0;
let callInProgress = false;

/* ===== 初期化 ===== */
document.addEventListener('DOMContentLoaded', () => {
  // 店舗名表示
  const storeEl = document.getElementById('storeName');
  if (storeEl) storeEl.textContent = STORE_NAME;

  // 席ID既存値の読み出し
  seatId = localStorage.getItem('seatId') || null;
  updateSeatLabel();

  // イベント
  const setBtn = document.getElementById('btnSetSeat');
  if (setBtn) setBtn.addEventListener('click', onSetSeat);
  const callBtn = document.getElementById('btnCall');
  if (callBtn) callBtn.addEventListener('click', onCallStaff);
  // モーダル内のボタン（存在すればイベントを紐付け）
  const confirmBtn = document.getElementById('confirmCall');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmCall);
  const cancelBtn = document.getElementById('cancelCall');
  if (cancelBtn) cancelBtn.addEventListener('click', closeCallModal);
  const backdrop = document.querySelector('#callModal .modal__backdrop');
  if (backdrop) backdrop.addEventListener('click', closeCallModal);
  // 座席モーダル関連
  const seatConfirm = document.getElementById('confirmSeat');
  if (seatConfirm) seatConfirm.addEventListener('click', confirmSeat);
  const seatCancel = document.getElementById('cancelSeat');
  if (seatCancel) seatCancel.addEventListener('click', closeSeatModal);
  const seatBackdrop = document.querySelector('#seatModal .modal__backdrop');
  if (seatBackdrop) seatBackdrop.addEventListener('click', closeSeatModal);
  // プルダウンを動的に生成
  populateSeatOptions();

  // LO残時間のタイマー開始
  startLoTimer();

  // 現在時刻の表示
  startClock();

  // --- 新規: 呼び出し完了モーダル関連の初期化 ---
  const closeResultBtn = document.getElementById('closeCallResult');
  if (closeResultBtn) closeResultBtn.addEventListener('click', closeCallResult);
  const resultBackdrop = document.querySelector('#callResultModal .modal__backdrop');
  if (resultBackdrop) resultBackdrop.addEventListener('click', closeCallResult);
  const retryBtn = document.getElementById('retryCall');
  if (retryBtn) retryBtn.addEventListener('click', () => {
    // 再試行は confirmCall を再実行（既に進行中なら無視）
    if (!callInProgress) confirmCall();
  });
});

/* ===== 席ID設定 ===== */
function onSetSeat() {
  openSeatModal();
}
function updateSeatLabel() {
  const el = document.getElementById('seatLabel');
  if (el) el.textContent = `座席：${seatId || '未設定'}`;
}

/* ===== LO残時間の表示・通知 ===== */
function startLoTimer() {
  const label = document.getElementById('loLabel');

  // サーバーから LO 情報を取得して表示（UIは表示のみ、判定基準はサーバー）
  const updateFromServer = async () => {
    if (!label) return;
    try {
      const resp = await fetch(LO_API, { cache: 'no-store' });
      if (!resp.ok) throw new Error('no server');
      const j = await resp.json();
      // 期待フォーマット例: { remainingMinutes: 90, loTime: "23:30", notify: false }
      if (typeof j.remainingMinutes === 'number') {
        const mins = Math.max(0, Math.floor(j.remainingMinutes));
        const hrs = Math.floor(mins / 60);
        const mm = String(mins % 60).padStart(2, '0');
        label.textContent = `ラストオーダー（サーバー基準）まで：${hrs}時間${mm}分`;
        // 通知はサーバーから指示があった場合にのみ表示（重複防止）
        if (j.notify && !notifiedLO) {
          notifiedLO = true;
          showToast('ラストオーダー（サーバー基準）です');
        }
        return;
      }
      throw new Error('invalid payload');
    } catch (e) {
      // フォールバック：ローカル計算（既存ロジック）を短期的に表示
      const now = new Date();
      const close = new Date(now);
      close.setHours(STORE_CLOSE.hour % 24, STORE_CLOSE.minute, 0, 0);
      if (STORE_CLOSE.hour === 24) close.setDate(close.getDate() + 1);
      const lo = new Date(close.getTime() - LO_MINUS_MIN * 60 * 1000);
      const remainMs = lo.getTime() - now.getTime();
      if (remainMs <= 0) {
        label.textContent = 'ラストオーダーまで：0分（LO到達）';
        return;
      }
      const mins = Math.floor(remainMs / 1000 / 60);
      const hrs = Math.floor(mins / 60);
      const mm = String(mins % 60).padStart(2, '0');
      label.textContent = `ラストオーダーまで：${hrs}時間${mm}分`;
    }
  };

  // 初回とポーリング
  updateFromServer();
  setInterval(updateFromServer, 15000);
}

/* ===== スタッフ呼び出し（確認モーダル） ===== */
function onCallStaff() {
  if (!seatId) {
    showToast('席IDを設定してください');
    return;
  }
  const now = Date.now();
  const elapsed = now - lastCallTs;
  if (elapsed < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    showToast(`呼び出しはあと ${wait} 秒で再度可能です`);
    return;
  }
  openCallModal();
}

function openCallModal() {
  const modal = document.getElementById('callModal');
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  // フォーカスを確認ボタンへ
  const btn = document.getElementById('confirmCall');
  if (btn) btn.focus();
}

function closeCallModal() {
  const modal = document.getElementById('callModal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

/* ===== 座席選択モーダル ===== */
function openSeatModal() {
  const modal = document.getElementById('seatModal');
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  const sel = document.getElementById('seatSelect');
  if (sel && seatId) sel.value = seatId;
}

function closeSeatModal() {
  const modal = document.getElementById('seatModal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

function populateSeatOptions() {
  const sel = document.getElementById('seatSelect');
  if (!sel) return;
  // クリア
  sel.innerHTML = '';
  // カウンター席 C-01 ～ C-10
  const addOption = (value, label) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    sel.appendChild(opt);
  };
  addOption('', '選択してください');
  for (let i = 1; i <= 10; i++) {
    const v = `C-${String(i).padStart(2, '0')}`;
    addOption(v, `カウンター席：${v}`);
  }
  // フロアの表記を英字-2桁フォーマットに統一（A=1F, B=2F 等）
  for (let i = 1; i <= 5; i++) {
    const v = `A-${String(i).padStart(2, '0')}`; // 1階 -> A-01..
    addOption(v, `1階テーブル：${v}`);
  }
  for (let i = 1; i <= 15; i++) {
    const v = `B-${String(i).padStart(2, '0')}`; // 2階 -> B-01..
    addOption(v, `2階テーブル：${v}`);
  }
}

function confirmSeat() {
  const sel = document.getElementById('seatSelect');
  if (!sel) return;
  const val = sel.value;
  if (!val) {
    showToast('座席を選択してください');
    return;
  }
  const normalized = String(val).toUpperCase();
  if (!SEAT_REGEX.test(normalized)) {
    showToast('座席IDは英字1文字-2桁の形式で指定してください（例 C-05）');
    return;
  }
  seatId = normalized;
  localStorage.setItem('seatId', seatId);
  updateSeatLabel();
  closeSeatModal();
  showToast(`座席を設定しました：${seatId}`);
}

async function confirmCall() {
  if (!seatId) {
    showToast('座席IDを設定してください');
    return;
  }
  // 連打・多重送信防止
  if (callInProgress) return;
  callInProgress = true;
  // ボタン無効化
  const confirmBtn = document.getElementById('confirmCall');
  if (confirmBtn) confirmBtn.disabled = true;
  closeCallModal();

  /* 
   補足：
   - ここにあった実際のサーバー呼び出し（fetch(CALL_API...)）はコメントアウトしました。
   - サーバー側で呼び出し成否を判定・通知する運用になる想定です。実運用では下記コメント内の fetch 処理を復元し、
     成功/失敗に応じて openCallResult(..., { retry: false/true }) を呼び出してください。
   - ここではフロントエンド側のみで「連打抑止（クールダウン）」を実装し、ローカル成功表示を行います。
  */

  /*
  // --- 参考：実際の API 呼び出し（コメントアウト中） ---
  try {
    const resp = await fetch(CALL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seat: seatId })
    });
    if (!resp.ok) throw new Error('call failed');
    // 成功時の処理
    lastCallTs = Date.now();
    setCallCooldown(true);
    openCallResult(`スタッフを呼び出しました（座席：${seatId}）`, { retry: false });
  } catch (e) {
    console.error(e);
    // 失敗時：再試行導線を表示する
    openCallResult('呼び出しに失敗しました。再試行してください。', { retry: true });
    showToast('呼び出しに失敗しました');
  } finally {
    callInProgress = false;
    if (confirmBtn) confirmBtn.disabled = false;
  }
  // --- /参考 ---
  */

  // クライアント側のみの動作（連打抑止／クールダウン開始／ローカル成功表示）
  lastCallTs = Date.now();
  setCallCooldown(true);
  openCallResult(`スタッフを呼び出しました（座席：${seatId}）`, { retry: false });

  // フラグとボタン状態を戻す（処理は完了と見なす）
  callInProgress = false;
  if (confirmBtn) confirmBtn.disabled = false;
}

/* ===== 現在時刻表示 ===== */
function startClock() {
  const el = document.getElementById('currentTime');
  if (!el) return;
  const fmt = (n) => String(n).padStart(2, '0');
  const tick = () => {
    const d = new Date();
    const hh = fmt(d.getHours());
    const mm = fmt(d.getMinutes());
    const ss = fmt(d.getSeconds());
    el.textContent = `${hh}:${mm}:${ss}`;
  };
  tick();
  setInterval(tick, 1000);
}

/* ===== トースト表示 ===== */
/* ===== トースト表示（改善版） =====
   仕様：
   - 既存の showToast(message) 呼び出しはそのまま使える。
   - TOAST_MODE によって挙動が変わる。
     - 'overwrite' : 既に表示中でも即座にメッセージを置換してタイマーをリセット（スナックバー風）。
     - 'queue'     : 既に表示中の場合は新着を保留（ただし複数来ても最新のみ保持）、現在の表示が消えたら保留中の最新を表示。
*/
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // 状態を保持するクロージャ変数（要素外で保持するためプロパティを利用）
  if (!toast._tm) {
    toast._tm = {
      visible: false,
      timeoutId: null,
      pending: null // queue モード時に最後のメッセージを保持
    };
  }
  const st = toast._tm;

  const doShow = (msg) => {
    toast.textContent = msg;
    toast.classList.add('show');
    st.visible = true;
    // 既存タイマーがあればクリア
    if (st.timeoutId) {
      clearTimeout(st.timeoutId);
      st.timeoutId = null;
    }
    st.timeoutId = setTimeout(() => {
      toast.classList.remove('show');
      st.visible = false;
      st.timeoutId = null;
      // queue モードなら保留中のメッセージを表示する
      if (TOAST_MODE === 'queue' && st.pending) {
        const next = st.pending;
        st.pending = null;
        // 少し遅延を入れて連続的な見た目を良くする（任意）
        setTimeout(() => doShow(next), 120);
      }
    }, TOAST_DURATION_MS);
  };

  if (TOAST_MODE === 'overwrite') {
    // すぐ上書きしてタイマーを再スタート
    doShow(message);
  } else {
    // queue モード
    if (!st.visible) {
      doShow(message);
    } else {
      // 表示中は pending を最新で置き換える（中間は破棄）
      st.pending = message;
    }
  }
}

/* ===== 呼び出し完了表示（中央モーダル） ===== */
function openCallResult(message, opts = { retry: false }) {
  const modal = document.getElementById('callResultModal');
  const msg = document.getElementById('callResultMessage');
  const retryBtn = document.getElementById('retryCall');
  if (!modal) return;
  if (msg) msg.textContent = message;
  if (retryBtn) {
    if (opts.retry) {
      retryBtn.hidden = false;
      retryBtn.disabled = false;
    } else {
      retryBtn.hidden = true;
    }
  }
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  const btn = document.getElementById('closeCallResult');
  if (btn) btn.focus();
}

function closeCallResult() {
  const modal = document.getElementById('callResultModal');
  if (!modal) return;
  const retryBtn = document.getElementById('retryCall');
  if (retryBtn) {
    retryBtn.hidden = true;
    retryBtn.disabled = false;
  }
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

function setCallCooldown(enable) {
  const callBtn = document.getElementById('btnCall');
  if (!callBtn) return;
  if (enable) {
    callBtn.disabled = true;
    setTimeout(() => {
      callBtn.disabled = false;
    }, COOLDOWN_MS);
  } else {
    callBtn.disabled = false;
  }
}

/* ===== 以前の showStickyToast はコール結果用に置き換えました（下部 toast は transient 用のまま維持） ===== */
