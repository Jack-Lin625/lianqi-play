// @ts-check
/* =========================================================
 * pass.js — 修仙戰令（賽季制）
 *
 * state.shop.pass = { season, exp, paid, free: [已領等級索引], premium: [已領等級索引] }
 * - 每 CONFIG.pass.seasonDays 天一季（從 seasonEpoch 起算，本地日期）
 * - 戰令經驗：開爐、修煉擊殺、每日任務、每日上線（CONFIG.pass.exp）
 * - 每 expPerTier 經驗升一級；免費線人人可領，付費線需購買當季戰令（購買後自動補發已達成的等級）
 * - 季末：已達成但未領取的獎勵寄到信箱，進度歸零、付費狀態重置
 * ========================================================= */

/** 'YYYY-MM-DD' → 本地時間當天 00:00 */
function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 兩個日期字串相差幾天 */
function daysBetween(from, to) {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86400000);
}

/**
 * 某天屬於第幾季（第一季 = 1）
 * @param {string} [date]
 */
function getSeasonNumber(date = todayString()) {
  const days = daysBetween(CONFIG.pass.seasonEpoch, date);
  return Math.max(1, Math.floor(days / CONFIG.pass.seasonDays) + 1);
}

/** 本季還剩幾天（含今天） */
function getSeasonDaysLeft(date = todayString()) {
  const season = getSeasonNumber(date);
  const endDay = season * CONFIG.pass.seasonDays; // 從 epoch 起算，下一季開始的那一天
  return Math.max(1, endDay - daysBetween(CONFIG.pass.seasonEpoch, date));
}

/**
 * 換季檢查：季末把未領的獎勵寄到信箱，然後重置進度
 * @returns {boolean} 是否換季
 */
function ensurePassSeason(date = todayString()) {
  const p = state.shop.pass;
  const cur = getSeasonNumber(date);
  if (p.season === cur) return false;
  if (p.season > 0) {
    const unclaimed = [];
    CONFIG.pass.tiers.forEach((t, i) => {
      if (canClaimPass(i, 'free')) unclaimed.push(t.free);
      if (canClaimPass(i, 'premium')) unclaimed.push(t.premium);
    });
    if (unclaimed.length) addMail(`第 ${p.season} 季修仙戰令`, '賽季結束，已達成但未領取的戰令獎勵', mergeRewards(unclaimed));
  }
  state.shop.pass = { season: cur, exp: 0, paid: false, free: [], premium: [] };
  return true;
}

/** 增加戰令經驗 */
function addPassExp(n) {
  if (n > 0) state.shop.pass.exp += n;
}

/** 目前戰令等級（已達成幾級，0～tiers.length） */
function getPassLevel() {
  return Math.min(CONFIG.pass.tiers.length, Math.floor(state.shop.pass.exp / CONFIG.pass.expPerTier));
}

/**
 * 是否可以領取某一級的某條線
 * @param {number} index 等級索引（0 起算；第 index+1 級）
 * @param {'free'|'premium'|string} line
 */
function canClaimPass(index, line) {
  const p = state.shop.pass;
  if (!CONFIG.pass.tiers[index] || index >= getPassLevel()) return false;
  if (line === 'premium' && !p.paid) return false;
  return !p[line === 'free' ? 'free' : 'premium'].includes(index);
}

/**
 * 領取某一級
 * @returns {RewardGot|null}
 */
function claimPass(index, line) {
  if (!isFeatureOpen('pass') || !canClaimPass(index, line)) return null;
  const t = CONFIG.pass.tiers[index];
  const isFree = line === 'free';
  state.shop.pass[isFree ? 'free' : 'premium'].push(index);
  return grantRewards(isFree ? t.free : t.premium, 'pass');
}

/**
 * 領取所有已達成的獎勵（line 不給 = 兩條線都領）
 * @param {'free'|'premium'} [line]
 * @returns {RewardGot|null}
 */
function claimAllPass(line) {
  const list = [];
  CONFIG.pass.tiers.forEach((t, i) => {
    for (const l of line ? [line] : ['free', 'premium']) if (canClaimPass(i, l)) list.push(claimPass(i, l));
  });
  return list.length ? mergeRewardGot(list) : null;
}

function countClaimablePass() {
  let n = 0;
  CONFIG.pass.tiers.forEach((t, i) => {
    if (canClaimPass(i, 'free')) n++;
    if (canClaimPass(i, 'premium')) n++;
  });
  return n;
}

/** 付費線所有獎勵的總價值（仙玉），計算「價值 X 倍」用 */
function getPassPremiumGemValue() {
  return CONFIG.pass.tiers.reduce((sum, t) => sum + getRewardGemValue(t.premium), 0);
}
