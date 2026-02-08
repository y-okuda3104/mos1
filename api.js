/**
 * API 抽象化レイヤー
 * 本番環境では実サーバーと通信、デモモードではダミーデータを返す
 */

const API = {
  USE_MOCK: true, // デモモード有効化
  
  // メニュー取得
  async getMenuItems() {
    if (this.USE_MOCK) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            items: [
              { id: 'm01', name: '冷奴', price: 380, category: '冷菜', imageUrl: '' },
              { id: 'm02', name: 'だし巻き卵', price: 450, category: '卵料理', imageUrl: '' },
              { id: 'm03', name: '唐揚げ', price: 580, category: '揚げ物', imageUrl: '' },
              { id: 'm04', name: '串焼き盛合せ', price: 780, category: '串もの', imageUrl: '' },
              { id: 'm05', name: '牛タン塩焼き', price: 950, category: '焼き物', imageUrl: '' },
              { id: 'm06', name: '豚バラ焼き', price: 720, category: '焼き物', imageUrl: '' },
              { id: 'm07', name: '串カツ', price: 550, category: '揚げ物', imageUrl: '' },
              { id: 'm08', name: 'もつ煮込み', price: 620, category: '煮込み', imageUrl: '' },
              { id: 'm09', name: '野菜炒め', price: 480, category: '炒め物', imageUrl: '' },
              { id: 'm10', name: '枝豆', price: 0, category: '0円メニュー', imageUrl: '' },
              { id: 'm11', name: 'キムチ', price: 0, category: '0円メニュー', imageUrl: '' },
              { id: 'm12', name: 'さっぽろラーメン', price: 680, category: '麺類', imageUrl: '' }
            ]
          });
        }, 500);
      });
    }
    
    // 本番環境: 実際のAPIを呼び出し
    try {
      const response = await fetch('/api/menu');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Menu API error:', error);
      throw error;
    }
  },
  
  // 売切アイテム取得
  async getSoldOutItems() {
    if (this.USE_MOCK) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(['m02', 'm07']); // だし巻き卵、串カツが売切
        }, 300);
      });
    }
    
    try {
      const response = await fetch('/api/sold-out');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('SoldOut API error:', error);
      throw error;
    }
  },
  
  // QRコード検証
  async validateQRCode(qrCode) {
    if (this.USE_MOCK) {
      return new Promise(resolve => {
        setTimeout(() => {
          // SEAT:C-05 形式をチェック
          const match = String(qrCode).match(/^SEAT:([A-Z]-\d{2})$/);
          resolve({
            valid: !!match,
            seatId: match ? match[1] : null
          });
        }, 400);
      });
    }
    
    try {
      const response = await fetch('/api/qr-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('QR validation error:', error);
      throw error;
    }
  },
  
  // 注文送信
  async submitOrder(seatId, items, total) {
    if (this.USE_MOCK) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            success: true,
            orderId: `order_${Date.now()}`,
            message: '注文が受け付けられました'
          });
        }, 600);
      });
    }
    
    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatId, items, total })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Order submission error:', error);
      throw error;
    }
  },
  
  // 支払い完了
  async completePayment(seatId, total) {
    if (this.USE_MOCK) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            success: true,
            message: '会計完了しました'
          });
        }, 1500);
      });
    }
    
    try {
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatId, total })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Payment error:', error);
      throw error;
    }
  },
  
  // スタッフ呼び出し
  async callStaff(seatId) {
    if (this.USE_MOCK) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            success: true,
            message: 'スタッフを呼び出しました'
          });
        }, 400);
      });
    }
    
    try {
      const response = await fetch('/api/call-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatId })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Staff call error:', error);
      throw error;
    }
  }
};
