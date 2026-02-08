# みどり亭 居酒屋POS システム - 実装ガイド

## システム概要

QRコードベースの入店管理とメニュー注文・会計処理を行う居酒屋POSシステムです。

## 実装されたファイル

### コア システムファイル

#### 1. **shared-state.js** (新規作成)
- グローバルアプリケーション状態を一元管理
- AppState オブジェクト：座席管理、カート、注文、支払い状態
- localStorage 経由で座席ごとのデータを永続化

#### 2. **api.js** (新規作成)
- API抽象化レイヤー（デモモード対応）
- getMenuItems() - 12個のダミーメニュー返却
- getSoldOutItems() - 売切品目返却（m02, m07）
- validateQRCode() - QRコード検証
- submitOrder() - 注文送信
- completePayment() - 支払い完了
- callStaff() - スタッフ呼び出し

#### 3. **qr_entry.html / qr_entry.js** (新規作成)
- QRコード入店画面
- 入力例：「SEAT:C-05」形式で座席設定
- マニュアル入力フォールバック機能付き
- バリデーション後、localStorage に seatId 保存



### ページ・ファイル群

#### 4. **top_menu.html** (既存・修正)
- スクリプト読み込み順序：shared-state.js → api.js → top_menu.js
- QR判定スクリプト：seatId なしは qr_entry.html へリダイレクト
- メニュー、注文履歴、スタッフ呼び出し、お会計ボタン

#### 5. **top_menu.js** (修正)
- confirmCall() - 即座に成功モーダルを表示（API呼び出しスキップ）
- showCallResult() - 3秒自動クローズ機能付き
- handleCheckout() - 会計処理開始関数

#### 6. **menu_list.html** (修正)
- checkoutModal div 要素追加（会計処理中表示用）
- progress-bar 要素で 2.5 秒アニメーション

#### 7. **menu_list.js** (大幅修正)
- loadMenu() - API.getMenuItems() から取得
- AppState.menuItems にメニュー同期
- renderMenuItem() - AppState.soldOutItems で売切判定
- updateCartSummary/Details - AppState.cart で管理
- showCheckoutModal() - 2.5 秒後に checkout.html へ遷移
- 勘定中フラグ (AppState.canOrder) で操作ロック

#### 8. **checkout.html / checkout.js** (新規作成)
- 「会計処理中...」画面（2.5 秒表示）
- 完了画面に領収書表示
- 座席、商品数、合計金額表示
- 「TOPへ戻る」で qr_entry.html にリセット

#### 9. **menu_list.css** (修正)
- .modal, .modal__dialog スタイル追加
- progress-bar, progress-fill アニメーション定義

#### 10. **order_history.html / order_history.js** (既存)
- 注文履歴・配膳状況表示
- AppState との連携

#### 11. **top_page.html** (修正)
- QR判定→qr_entry へリダイレクト
- 最終的に top_menu.html へ遷移

## 主要な動作フロー

### 1. 入店フロー
```
top_page.html または top_menu.html アクセス
  ↓
seatId チェック（ない場合）
  ↓
qr_entry.html（QRコード・座席入力）
  ↓
AppState.setSeatId() + localStorage 保存
  ↓
top_menu.html へ遷移
```

### 2. メニュー注文フロー
```
top_menu.html → メニュー一覧 クリック
  ↓
menu_list.html ロード
  ↓
AppState.qrScanned チェック（ない場合は qr_entry へ）
  ↓
API.getMenuItems() でメニュー取得
  ↓
API.getSoldOutItems() で売切品取得
  ↓
AppState.menuItems, AppState.soldOutItems に同期
  ↓
uiManager.renderMenu() でメニュー項目表示
```

### 3. カート操作フロー
```
メニュー項目 「追加」クリック
  ↓
renderMenuItem() で AppState.canOrder を確認
  ↓
AppState.addToCart(itemId, 1)
  ↓
AppState.saveCart() で localStorage に保存
  ↓
updateCartSummary/Details
  ↓
カート展開で詳細表示、「注文確定」ボタン有効化
```

### 4. お会計フロー
```
menu_list.html → 「お会計」クリック
  ↓
showCheckoutModal()
  ↓
checkoutModal 表示（会計処理中...）
  ↓
progress-bar 2.5 秒アニメーション
  ↓
startPaymentProcess() → AppState.canOrder = false
  ↓
window.location.href = 'checkout.html'
  ↓
checkout.html 読み込み
  ↓
AppState.completePayment()
  ↓
AppState.clearCart()
  ↓
完了画面表示（領収書）
  ↓
「TOPへ戻る」→ qr_entry.html へ リセット
```

### 5. スタッフ呼び出しフロー
```
top_menu.html → 「スタッフ呼び出し」ボタン
  ↓
確認モーダル表示
  ↓
「呼び出す」ボタン
  ↓
confirmCall() - 即座に成功結果
  ↓
callResultModal 表示「スタッフを呼び出しました」
  ↓
setTimeout 3秒後に自動クローズ
```

## AppState インターフェース

### プロパティ
- `seatId` - 現在の座席（C-05 など）
- `qrScanned` - QRスキャン済みフラグ
- `menuItems` - メニュー項目配列
- `cart` - カート内容 { itemId: quantity, ... }
- `soldOutItems` - 売切品目 [id1, id2, ...]
- `orders` - 注文履歴配列
- `paymentStatus` - 'idle' | 'processing' | 'completed'
- `canOrder` - 注文可能フラグ

### メソッド
- `setSeatId(seatId)` - 座席設定
- `addToCart(itemId, quantity)` - カート追加
- `removeFromCart(itemId)` - カート削除
- `getCartTotal()` - カート合計金額
- `getCartItemCount()` - カート商品数
- `submitOrder(items)` - 注文送信
- `startPaymentProcess()` - 支払い開始
- `completePayment()` - 支払い完了
- `resetPaymentStatus()` - リセット
- `markAsSoldOut(itemId)` - 売切標記
- `isSoldOut(itemId)` - 売切判定

## デモテスト手順

### 1. QRコード入力テスト
1. qr_entry.html にアクセス
2. QR入力に「SEAT:C-05」と入力
3. 「入店開始」をクリック
4. ✓ top_menu.html へ遷移確認
5. ✓ localStorage.seatId = "C-05" 確認

### 2. メニュー表示テスト
1. 「メニュー一覧」をクリック
2. ✓ 12個のメニュー項目表示
3. ✓ カテゴリタブ表示（「すべて」「冷菜」「串もの」等）
4. ✓ m02, m07 に「売切」バッジ表示
5. ✓ 売切品は「追加」ボタン無効化

### 3. カート操作テスト
1. メニューから商品選択「追加」クリック
2. ✓ カート件数増加
3. ✓ 「表示」で詳細確認
4. 「注文確定」クリック
5. ✓ 注文履歴に追加

### 4. お会計テスト
1. menu_list.html から「お会計」クリック
2. ✓ checkoutModal 表示（会計を開始します）
3. ✓ progress-bar 2.5秒アニメーション
4. ✓ checkout.html へ遷移
5. ✓ 完了画面に領収書表示
6. 「TOPへ戻る」クリック
7. ✓ localStorage リセット
8. ✓ qr_entry.html へ遷移

### 5. スタッフ呼び出しテスト
1. top_menu.html から「スタッフ呼び出し」
2. ✓ 確認モーダル表示
3. 「呼び出す」をクリック
4. ✓ 「スタッフを呼び出しました」モーダル表示
5. ✓ 3秒で自動クローズ

## トラブルシューティング

### メニューが表示されない
- ✓ Chrome DevTools → Console でエラー確認
- ✓ AppState.menuItems が正しく初期化されているか確認
- ✓ api.js が読み込まれているか確認

### QRコード遷移しない
- ✓ top_menu.html のインライン QR判定スクリプト確認
- ✓ localStorage.seatId が設定されているか確認

### スタッフ呼び出しモーダルが閉じない
- ✓ top_menu.js showCallResult() に setTimeout 確認
- ✓ モーダルの `hidden` 属性が正しく切り替わっているか確認

### お会計後リセットされない
- ✓ checkout.js returnToTop() が executeされているか確認
- ✓ localStorage リセット処理が実行されているか確認

## ファイル相互依存図

```
qr_entry.html
  ├─ shared-state.js (AppState)
  └─ api.js (validateQRCode)
  
top_menu.html
  ├─ shared-state.js ← QR判定スクリプト
  ├─ api.js
  └─ top_menu.js (confirmCall, showCallResult)
  
menu_list.html
  ├─ shared-state.js (AppState)
  ├─ api.js (getMenuItems, getSoldOutItems)
  ├─ top_menu.js (時刻等共通機能)
  └─ menu_list.js (renderMenu, showCheckoutModal)
  
checkout.html
  ├─ shared-state.js (AppState リセット)
  ├─ api.js (completePayment)
  └─ checkout.js (UI表示)
```

## 完成チェックリスト

- ✅ QR entry → top menu → menu list → checkout フロー
- ✅ AppState による中央集約管理
- ✅ localStorage による座席ベースデータ永続化
- ✅ API mock層（USE_MOCK=true で実装）
- ✅ メニュー 12 項目表示
- ✅ カテゴリタブフィルタリング
- ✅ 売切品への「売切」バッジ表示
- ✅ カート加減操作
- ✅ 注文確定・配膳状況追跡
- ✅ 会計処理中モーダル表示 (2.5秒)
- ✅ スタッフ呼び出し（モック、3秒自動クローズ）
- ✅ 支払い後のリセット & QR再入店フロー
