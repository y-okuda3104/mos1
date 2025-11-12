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

  const tick = () => {
    const now = new Date();

    // 本日24:00（翌日0:00）を閉店、30分前をLO時刻とする
    const close = new Date(now);
    close.setHours(STORE_CLOSE.hour % 24, STORE_CLOSE.minute, 0, 0);
    if (STORE_CLOSE.hour === 24) {
      // 24:00は翌日0:00扱い
      close.setDate(close.getDate() + 1);
    }
    const lo = new Date(close.getTime() - LO_MINUS_MIN * 60 * 1000);

    // 残り時間（LOまで）
    const remainMs = lo.getTime() - now.getTime();
    if (!label) return;
    if (remainMs <= 0) {
      label.textContent = 'ラストオーダーまで：0分（LO到達）';
      // 一度だけ通知
      if (!notifiedLO) {
        notifiedLO = true;
        showToast('ラストオーダー開始（閉店30分前）です');
      }
      return;
    }
    const mins = Math.floor(remainMs / 1000 / 60);
    const hrs = Math.floor(mins / 60);
    const mm = String(mins % 60).padStart(2, '0');
    label.textContent = `ラストオーダーまで：${hrs}時間${mm}分`;
  };

  tick();
  // 15秒おきに更新（負荷と鮮度のバランス）
  setInterval(tick, 15000);
}

/* ===== スタッフ呼び出し（確認モーダル） ===== */
function onCallStaff() {
  if (!seatId) {
    showToast('席IDを設定してください');
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
  // 1階テーブル 1F-01 ～ 1F-05
  for (let i = 1; i <= 5; i++) {
    const v = `1F-${String(i).padStart(2, '0')}`;
    addOption(v, `1階テーブル：${v}`);
  }
  // 2階テーブル 2F-01 ～ 2F-15
  for (let i = 1; i <= 15; i++) {
    const v = `2F-${String(i).padStart(2, '0')}`;
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
  seatId = val;
  localStorage.setItem('seatId', seatId);
  updateSeatLabel();
  closeSeatModal();
  showToast(`座席を設定しました：${seatId}`);
}

async function confirmCall() {
  // 実際の呼び出し処理（ここは既存の onCallStaff の挙動を再利用）
  closeCallModal();
  try {
    // モック：実際は API 経由で通知
    // 呼び出し成功は画面中央の大きなモーダルで表示（閉じるまで残る）
    openCallResult(`スタッフを呼び出しました（座席：${seatId}）`);
  } catch (e) {
    console.error(e);
    showToast('呼び出しに失敗しました');
  }
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
function openCallResult(message) {
  const modal = document.getElementById('callResultModal');
  const msg = document.getElementById('callResultMessage');
  if (!modal) return;
  if (msg) msg.textContent = message;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  const btn = document.getElementById('closeCallResult');
  if (btn) btn.focus();
}

function closeCallResult() {
  const modal = document.getElementById('callResultModal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

/* ===== 以前の showStickyToast はコール結果用に置き換えました（下部 toast は transient 用のまま維持） ===== */
