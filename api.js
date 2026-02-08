/**
 * api.js - API接続層（モック実装）
 * 実装の柔軟性のため、APIエンドポイントをスタブとして提供
 */

const API = {
  /**
   * メニューアイテムを取得
   */
  async getMenuItems(storeId = 'default') {
    // API呼び出しをシミュレート
    return new Promise((resolve) => {
      setTimeout(() => {
        const menuItems = [
          { id: 'm01', name: '枝豆', category: '冷菜', price: 390, image: '🥬' },
          { id: 'm02', name: '唐揚げ', category: '揚げ物', price: 590, image: '🍗' },
          { id: 'm03', name: 'だし巻き卵', category: '卵料理', price: 450, image: '🥚', soldOut: true },
          { id: 'm04', name: 'もつ煮込み', category: '煮込み', price: 520, image: '🍲' },
          { id: 'm05', name: 'チーズ唐揚げ', category: '揚げ物', price: 650, image: '🧀' },
          { id: 'm06', name: 'ポテトサラダ', category: '冷菜', price: 420, image: '🥔' },
          { id: 'm07', name: '牛タン塩焼き', category: '焼き物', price: 880, image: '🥩', soldOut: true },
          { id: 'm08', name: 'イカ塩辛', category: '冷菜', price: 480, image: '🦑' },
          { id: 'm09', name: '豚足揚げ', category: '揚げ物', price: 520, image: '🍖' },
          { id: 'm10', name: '明太バター', category: '冷菜', price: 540, image: '🧈' },
          { id: 'm11', name: '焼鳥盛合わせ', category: '焼き物', price: 720, image: '🔥' },
          { id: 'm12', name: 'お絞り', category: '取り皿', price: 0, image: '🧻' }
        ];
        resolve(menuItems);
      }, 100);
    });
  },

  /**
   * 売切アイテムを取得
   */
  async getSoldOutItems(storeId = 'default') {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(['m03', 'm07']);
      }, 50);
    });
  },

  /**
   * QRコードを検証
   */
  async validateQRCode(qrData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // "SEAT:C-05" 形式をパース
        const match = qrData.match(/^SEAT:(.+)$/);
        if (match) {
          resolve({
            valid: true,
            seatId: match[1]
          });
        } else {
          resolve({
            valid: false,
            error: '無効なQRコード'
          });
        }
      }, 100);
    });
  },

  /**
   * スタッフを呼び出し
   */
  async callStaff(seatId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: `${seatId} へスタッフを呼び出しました`
        });
      }, 500);
    });
  },

  /**
   * 決済を初期化
   */
  async initializePayment(seatId, total) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          paymentId: 'PAY-' + Date.now(),
          total: total
        });
      }, 1000);
    });
  },

  /**
   * 決済を完了
   */
  async completePayment(paymentId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: '決済が完了しました'
        });
      }, 1500);
    });
  }
};
