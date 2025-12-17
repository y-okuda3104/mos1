<?php
/**
 * セッション管理ファイル
 * 
 * 機能:
 * - セッション初期化
 * - 座席ID管理
 * - カート・注文履歴の管理
 * 
 * @version 2.0.0
 */

// セッションが開始されていない場合のみ開始
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// セッション変数の初期化
if (!isset($_SESSION['seatId'])) {
    $_SESSION['seatId'] = 'C-01'; // デフォルト座席
}

if (!isset($_SESSION['cart'])) {
    $_SESSION['cart'] = [];
}

if (!isset($_SESSION['orders'])) {
    $_SESSION['orders'] = [];
}

/**
 * 座席IDを取得
 */
function getSeatId() {
    return $_SESSION['seatId'] ?? 'C-01';
}

/**
 * 座席IDを設定
 */
function setSeatId($seatId) {
    $normalized = normalizeSeatId($seatId);
    if ($normalized) {
        $_SESSION['seatId'] = $normalized;
        return true;
    }
    return false;
}

/**
 * 座席IDの正規化
 */
function normalizeSeatId($input) {
    if (!$input) return null;
    
    $normalized = strtoupper(trim($input));
    if (preg_match('/^([A-Z])[-\s]?(\d{1,2})$/', $normalized, $matches)) {
        return $matches[1] . '-' . str_pad($matches[2], 2, '0', STR_PAD_LEFT);
    }
    return null;
}

/**
 * カートを取得
 */
function getCart() {
    $seatId = getSeatId();
    $key = 'cart_' . $seatId;
    return $_SESSION[$key] ?? [];
}

/**
 * カートを保存
 */
function saveCart($cart) {
    $seatId = getSeatId();
    $key = 'cart_' . $seatId;
    $_SESSION[$key] = $cart;
}

/**
 * カートに商品を追加
 */
function addToCart($itemId) {
    $cart = getCart();
    if (!isset($cart[$itemId])) {
        $cart[$itemId] = 0;
    }
    $cart[$itemId]++;
    saveCart($cart);
    return $cart;
}

/**
 * カートから商品を削除
 */
function removeFromCart($itemId) {
    $cart = getCart();
    unset($cart[$itemId]);
    saveCart($cart);
    return $cart;
}

/**
 * カートの商品数量を変更
 */
function updateCartQuantity($itemId, $quantity) {
    $cart = getCart();
    if ($quantity <= 0) {
        unset($cart[$itemId]);
    } else {
        $cart[$itemId] = intval($quantity);
    }
    saveCart($cart);
    return $cart;
}

/**
 * カートをクリア
 */
function clearCart() {
    $seatId = getSeatId();
    $key = 'cart_' . $seatId;
    $_SESSION[$key] = [];
}

/**
 * 注文履歴を取得
 */
function getOrders() {
    $seatId = getSeatId();
    $key = 'orders_' . $seatId;
    return $_SESSION[$key] ?? [];
}

/**
 * 注文履歴を保存
 */
function saveOrders($orders) {
    $seatId = getSeatId();
    $key = 'orders_' . $seatId;
    $_SESSION[$key] = $orders;
}

/**
 * 注文を追加
 */
function addOrder($item) {
    $orders = getOrders();
    $orders[] = $item;
    saveOrders($orders);
    return $orders;
}

/**
 * 注文履歴をクリア
 */
function clearOrders() {
    $seatId = getSeatId();
    $key = 'orders_' . $seatId;
    $_SESSION[$key] = [];
}
