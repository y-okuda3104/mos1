<?php
/**
 * 共通関数ファイル
 * 
 * 機能:
 * - メニュー管理
 * - 時刻・ラストオーダー計算
 * - ユーティリティ関数
 * 
 * @version 2.0.0
 */

/**
 * 設定定数
 */
define('STORE_NAME', 'みどり亭 本店');
define('STORE_CLOSE_HOUR', 24);
define('STORE_CLOSE_MINUTE', 0);
define('LO_MINUS_MINUTES', 30);

/**
 * ダミーメニューを生成
 */
function generateDummyMenu($count = 12) {
    $categories = ['酒肴', '串焼き', '揚げ物'];
    $menu = [];
    
    for ($i = 1; $i <= $count; $i++) {
        $menu[] = [
            'id' => 'm' . str_pad($i, 2, '0', STR_PAD_LEFT),
            'name' => '居酒屋メニュー ' . $i,
            'price' => ($i % 5 === 0) ? 0 : 500 + ($i * 50),
            'imageUrl' => '',
            'category' => $categories[$i % 3],
            'recommend' => rand(0, 99),
            'quickOrder' => rand(0, 9),
            'soldOut' => false
        ];
    }
    
    return $menu;
}

/**
 * メニューを取得（API未実装時はダミーデータ）
 */
function getMenuItems() {
    // TODO: 実際のAPIからメニューを取得する処理を実装
    // 現在はダミーデータを返す
    return generateDummyMenu();
}

/**
 * メニューをフィルタリング
 */
function filterMenuItems($items, $keyword = '', $category = '') {
    return array_filter($items, function($item) use ($keyword, $category) {
        $matchesCategory = empty($category) || $item['category'] === $category;
        $matchesKeyword = empty($keyword) || 
            stripos($item['name'], $keyword) !== false;
        return $matchesCategory && $matchesKeyword;
    });
}

/**
 * カテゴリ一覧を取得
 */
function getCategories($items) {
    $categories = array_unique(array_column($items, 'category'));
    return array_values(array_filter($categories));
}

/**
 * ラストオーダーまでの残り時間を計算（分単位）
 */
function calculateRemainingMinutes() {
    $now = new DateTime();
    $closeTime = new DateTime();
    $closeTime->setTime(STORE_CLOSE_HOUR % 24, STORE_CLOSE_MINUTE, 0);
    
    if (STORE_CLOSE_HOUR === 24) {
        $closeTime->modify('+1 day');
    }
    
    $loTime = clone $closeTime;
    $loTime->modify('-' . LO_MINUS_MINUTES . ' minutes');
    
    $interval = $now->diff($loTime);
    $remainingMinutes = ($interval->days * 24 * 60) + ($interval->h * 60) + $interval->i;
    
    if ($loTime < $now) {
        return 0;
    }
    
    return max(0, $remainingMinutes);
}

/**
 * ラストオーダー表示用テキストを取得
 */
function getLODisplayText() {
    $minutes = calculateRemainingMinutes();
    
    if ($minutes <= 0) {
        return 'ラストオーダーまで：0分（LO到達）';
    }
    
    $hours = floor($minutes / 60);
    $mins = str_pad($minutes % 60, 2, '0', STR_PAD_LEFT);
    return "ラストオーダー（ローカル基準）まで：{$hours}時間{$mins}分";
}

/**
 * 現在時刻を取得（HH:MM:SS形式）
 */
function getCurrentTime() {
    return date('H:i:s');
}

/**
 * HTMLエスケープ
 */
function h($str) {
    return htmlspecialchars($str, ENT_QUOTES, 'UTF-8');
}

/**
 * JSONレスポンスを返す
 */
function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * カートの合計金額を計算
 */
function calculateCartTotal($cart, $menuItems) {
    $total = 0;
    foreach ($cart as $itemId => $quantity) {
        $item = array_filter($menuItems, function($i) use ($itemId) {
            return $i['id'] === $itemId;
        });
        $item = reset($item);
        if ($item) {
            $total += ($item['price'] ?? 0) * $quantity;
        }
    }
    return $total;
}

/**
 * カートの商品数を計算
 */
function calculateCartCount($cart) {
    return array_sum($cart);
}

/**
 * 配膳状況を集計
 */
function calculateDeliveryStatus($orders) {
    $delivered = 0;
    $pending = 0;
    
    foreach ($orders as $order) {
        if ($order['delivered'] ?? false) {
            $delivered += $order['qty'] ?? 0;
        } else {
            $pending += $order['qty'] ?? 0;
        }
    }
    
    return [
        'delivered' => $delivered,
        'pending' => $pending
    ];
}

/**
 * タイムスタンプをフォーマット
 */
function formatTimestamp($timestamp) {
    return date('H:i:s', $timestamp / 1000);
}

/**
 * 座席オプションを生成
 */
function generateSeatOptions() {
    $seatTypes = [
        ['prefix' => 'C', 'count' => 10, 'label' => 'カウンター席'],
        ['prefix' => 'A', 'count' => 5, 'label' => '1階テーブル'],
        ['prefix' => 'B', 'count' => 15, 'label' => '2階テーブル']
    ];
    
    $options = [];
    foreach ($seatTypes as $type) {
        for ($i = 1; $i <= $type['count']; $i++) {
            $value = $type['prefix'] . '-' . str_pad($i, 2, '0', STR_PAD_LEFT);
            $options[] = [
                'value' => $value,
                'label' => $type['label'] . '：' . $value,
                'group' => $type['label']
            ];
        }
    }
    
    return $options;
}
