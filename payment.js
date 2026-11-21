// @ts-check
/* =========================================================
 * payment.js — 付款（目前為測試模式，不接真實金流）
 *
 * 只負責「付款」，不負責發放獎勵。付款成功後由 shop.js 的 fulfillOrder 發放。
 * 之後接真實金流時，只要把 PaymentProvider.pay 換成：
 *   建立訂單 → 開啟付款頁 → 伺服器驗證付款成功 → 回傳 { ok: true, orderId }
 * （正式環境的發放應由伺服器確認付款後再進行，避免被竄改）
 * ========================================================= */

const PaymentProvider = {
  mode: 'test', // 'test' = 模擬購買，直接成功

  /**
   * @param {RechargeProduct} product
   * @returns {Promise<PaymentResult>}
   */
  async pay(product) {
    return { ok: true, orderId: `TEST-${Date.now().toString(36)}-${product.id}` };
  },
};
