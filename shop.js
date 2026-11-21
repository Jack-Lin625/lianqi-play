// @ts-check
/* =========================================================
 * shop.js — 坊市、仙玉商店、外觀、儲值（仙玉方案、首儲、月卡、新手禮包、戰令購買、累計儲值）
 *   戰令的等級與領取在 pass.js；每天自動發放的福利在 welfare.js
 *
 * 用遊戲幣（靈石、仙玉）買的：直接扣幣 → grantRewards
 * 用真錢買的：purchaseProduct → PaymentProvider.pay（payment.js）→ 成功後 fulfillOrder 發放
 * ========================================================= */

// ---------- 坊市（靈石） ----------

/** 日期換了就自動刷新 */
function ensureMarketFresh() {
  const m = state.shop.market;
  if (m.date === todayString() && m.items.length) return false;
  m.date = todayString();
  m.refreshes = 0;
  rollMarket();
  return true;
}

/** 依權重抽出不重複的商品 */
function rollMarket() {
  const cfg = CONFIG.shop.market;
  const pool = cfg.pool.slice();
  const items = [];
  while (items.length < cfg.slots && pool.length) {
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    let r = Math.random() * total;
    let i = 0;
    while (r >= pool[i].weight) r -= pool[i++].weight;
    items.push({ id: pool[i].id, bought: false });
    pool.splice(i, 1);
  }
  state.shop.market.items = items;
}

function getMarketEntry(id) {
  return CONFIG.shop.market.pool.find((e) => e.id === id);
}

function getMarketPrice(entry) {
  return Math.round(entry.price * (1 + getBestStage() * CONFIG.shop.market.priceScale));
}

function getMarketRefreshCost() {
  const c = CONFIG.shop.market.refreshCost;
  return c[Math.min(state.shop.market.refreshes, c.length - 1)];
}

/** 花仙玉手動刷新 */
function refreshMarketManual() {
  if (!isFeatureOpen('market')) return { ok: false, error: getFeatureLockText('market') };
  const cost = getMarketRefreshCost();
  if (state.upgradeStones < cost) return { ok: false, error: `仙玉不足（需要 ${cost}）` };
  state.upgradeStones -= cost;
  state.shop.market.refreshes++;
  rollMarket();
  return { ok: true };
}

function buyMarketItem(index) {
  if (!isFeatureOpen('market')) return { ok: false, error: getFeatureLockText('market') };
  ensureMarketFresh();
  const slot = state.shop.market.items[index];
  if (!slot || slot.bought) return { ok: false, error: '已售出' };
  const entry = getMarketEntry(slot.id);
  const price = getMarketPrice(entry);
  if (state.gold < price) return { ok: false, error: '靈石不足' };
  state.gold -= price;
  slot.bought = true;
  trackDaily('market');
  return { ok: true, got: grantRewards(entry.reward, 'market') };
}

// ---------- 仙玉商店、外觀 ----------

function buyGemItem(id) {
  if (!isFeatureOpen('shop')) return { ok: false, error: getFeatureLockText('shop') };
  const entry = CONFIG.shop.gem.find((e) => e.id === id);
  if (!entry) return { ok: false, error: '沒有這個商品' };
  if (state.upgradeStones < entry.price) return { ok: false, error: '仙玉不足' };
  state.upgradeStones -= entry.price;
  state.shop.purchases[id] = (state.shop.purchases[id] || 0) + 1;
  return { ok: true, got: grantRewards(entry.reward, 'gemshop') };
}

function buyCosmetic(id) {
  if (!isFeatureOpen('shop')) return { ok: false, error: getFeatureLockText('shop') };
  const c = CONFIG.shop.cosmetics[id];
  if (!c) return { ok: false, error: '沒有這個外觀' };
  if (state.shop.cosmetics.owned.includes(id)) return { ok: false, error: '已擁有' };
  if (c.price === null) return { ok: false, error: c.source || '無法購買' };
  if (state.upgradeStones < c.price) return { ok: false, error: '仙玉不足' };
  state.upgradeStones -= c.price;
  state.shop.cosmetics.owned.push(id);
  state.shop.cosmetics.equipped = id;
  return { ok: true };
}

function equipCosmetic(id) {
  if (!state.shop.cosmetics.owned.includes(id)) return false;
  state.shop.cosmetics.equipped = id;
  return true;
}

// ---------- 儲值商品 ----------

/**
 * 儲值商品（統一格式）
 * @param {string} id
 * @returns {RechargeProduct|null}
 */
function getRechargeProduct(id) {
  const r = CONFIG.shop.recharge;
  const gem = r.gems.find((g) => g.id === id);
  if (gem) {
    const first = r.firstDouble && !state.shop.firstDone.includes(id);
    const amount = (gem.gems + gem.bonus) * (first ? r.firstMult : 1);
    /** @type {Reward} */
    const reward = { stones: amount };
    // 第一次購買任何仙玉方案：加送首儲專屬獎勵
    const exclusive = !state.shop.firstExclusiveDone;
    if (exclusive) Object.assign(reward, r.firstExclusive.reward);
    return { id, name: `仙玉 ×${amount}`, price: gem.price, currency: r.currency, reward, firstDouble: first, firstExclusive: exclusive };
  }
  if (id === r.monthCard.id) {
    const m = r.monthCard;
    return { id, name: m.name, price: m.price, currency: r.currency, reward: { stones: m.instant } };
  }
  if (id === r.starter.id) return { id, name: r.starter.name, price: r.starter.price, currency: r.currency, reward: r.starter.reward, loot: r.starter.reward.loot };
  if (id === r.pass.id) return { id, name: `${r.pass.name}・第 ${state.shop.pass.season} 季`, price: r.pass.price, currency: r.currency, reward: {} };
  return null;
}

/**
 * 商品內容換算成仙玉的總價值（計算「價值 X 倍」用）
 * 月卡 = 立即 + 每日 × 天數；戰令 = 付費線全部獎勵
 * @param {string} id
 */
function getProductGemValue(id) {
  const r = CONFIG.shop.recharge;
  const product = getRechargeProduct(id);
  if (!product) return 0;
  if (id === r.monthCard.id) return r.monthCard.instant + r.monthCard.daily * r.monthCard.days;
  if (id === r.pass.id) return getPassPremiumGemValue();
  return getRewardGemValue(product.reward);
}

/** 商品的「價值 X 倍」（見 CONFIG.valuation） */
function getProductValueMultiple(id) {
  const product = getRechargeProduct(id);
  return product ? getValueMultiple(getProductGemValue(id), product.price) : 0;
}

/** 是否還能購買（限購、已擁有等）；不行時回傳原因 */
function getProductBlockReason(id) {
  const r = CONFIG.shop.recharge;
  if (id === r.starter.id && (state.shop.purchases[id] || 0) >= r.starter.limit) return '已購買';
  if (id === r.pass.id && state.shop.pass.paid) return '本季已解鎖';
  return null;
}

/**
 * 購買真錢商品：付款（payment.js）成功後才發放
 * @param {string} id
 * @returns {Promise<PurchaseResult>}
 */
async function purchaseProduct(id) {
  const product = getRechargeProduct(id);
  if (!product) return { ok: false, error: '沒有這個商品' };
  const feature = id === CONFIG.shop.recharge.pass.id ? 'pass' : 'shop';
  if (!isFeatureOpen(feature)) return { ok: false, error: getFeatureLockText(feature) };
  const block = getProductBlockReason(id);
  if (block) return { ok: false, error: block };
  const pay = await PaymentProvider.pay(product);
  if (!pay.ok) return { ok: false, error: pay.error || '付款未完成' };
  return fulfillOrder(id, pay.orderId);
}

/**
 * 付款成功後發放（之後接真實金流時，由伺服器確認付款後呼叫）
 * @param {string} id
 * @param {string} orderId
 * @returns {PurchaseResult}
 */
function fulfillOrder(id, orderId) {
  const r = CONFIG.shop.recharge;
  const product = getRechargeProduct(id);
  const gots = [grantRewards(product.reward, 'recharge')];
  if (product.firstDouble) state.shop.firstDone.push(id);
  if (product.firstExclusive) state.shop.firstExclusiveDone = true;
  if (id === r.monthCard.id) {
    const from = Math.max(Date.now(), state.shop.monthCard.until);
    state.shop.monthCard.until = from + r.monthCard.days * 86400000;
    gots.push(claimMonthCard()); // 今天的份立即發放
  }
  if (id === r.pass.id) {
    state.shop.pass.paid = true;
    gots.push(claimAllPass('premium')); // 補發已達成等級的付費線獎勵
  }
  state.shop.purchases[id] = (state.shop.purchases[id] || 0) + 1;
  state.shop.totalSpent += product.price;
  state.shop.orders.unshift({ orderId, id, price: product.price, time: Date.now(), mode: PaymentProvider.mode });
  state.shop.orders = state.shop.orders.slice(0, CONFIG.shop.orderLogMax);
  return { ok: true, got: mergeRewardGot(gots), orderId, product };
}

// ---------- 月卡（每天第一次上線自動發放，見 welfare.js） ----------

function isMonthCardActive(now = Date.now()) {
  return state.shop.monthCard.until > now;
}

function getMonthCardDaysLeft(now = Date.now()) {
  return Math.max(0, Math.ceil((state.shop.monthCard.until - now) / 86400000));
}

function canClaimMonthCard(today = todayString()) {
  return isMonthCardActive() && state.shop.monthCard.lastClaim !== today;
}

/** 發放今天的月卡仙玉（今天已發過或月卡未生效時回傳 null） */
function claimMonthCard(today = todayString()) {
  if (!canClaimMonthCard(today)) return null;
  state.shop.monthCard.lastClaim = today;
  return grantRewards({ stones: CONFIG.shop.recharge.monthCard.daily }, 'monthcard');
}

// ---------- 累計儲值獎勵 ----------

/** 可以領取第 index 個累計儲值獎勵嗎 */
function canClaimSpendReward(index) {
  const t = CONFIG.shop.recharge.spendRewards[index];
  return !!t && state.shop.totalSpent >= t.amount && !state.shop.spendClaimed.includes(index);
}

/** @returns {RewardGot|null} */
function claimSpendReward(index) {
  if (!canClaimSpendReward(index)) return null;
  state.shop.spendClaimed.push(index);
  return grantRewards(CONFIG.shop.recharge.spendRewards[index].reward, 'spend');
}

function countClaimableSpendRewards() {
  return CONFIG.shop.recharge.spendRewards.filter((t, i) => canClaimSpendReward(i)).length;
}
