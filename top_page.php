<?php
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/includes/functions.php';

// トップページはtop_menu.phpにリダイレクト
header('Location: top_menu.php');
exit;
