// @ts-check
/* =========================================================
 * chest.js — 寶箱開箱、倍數、篩選、裝備 / 分解
 * （寶箱升級與自動開箱於第三階段加入）
 * ========================================================= */

// ---------- 機率表 ----------

/**
 * 取得某寶箱等級的品質機率（%，陣列順序對應 CONFIG.rarities）。
 * 中間等級以相鄰的兩個關鍵等級線性插值，最後正規化為總和 100。
 */
function getChestRates(level) {
  const points = CONFIG.chest.rateKeyPoints;
  const keys = Object.keys(points).map(Number).sort((a, b) => a - b);
  const lv = Math.min(Math.max(level, keys[0]), keys[keys.length - 1]);

  let lo = keys[0];
  let hi = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (lv >= keys[i] && lv <= keys[i + 1]) {
      lo = keys[i];
      hi = keys[i + 1];
      break;
    }
  }

  const t = hi === lo ? 0 : (lv - lo) / (hi - lo);
  const rates = points[lo].map((v, i) => v + (points[hi][i] - v) * t);

  const sum = rates.reduce((a, b) => a + b, 0);
  return rates.map((r) => (r / sum) * 100);
}

/** 用累積機率表抽出品質序號 */
function rollRarityIndex(rates) {
  const r = Math.random() * 100;
  let acc = 0;
  for (let i = 0; i < rates.length; i++) {
    acc += rates[i];
    if (r < acc) return i;
  }
  // 浮點誤差保護：回傳最後一個機率大於 0 的品質
  for (let i = rates.length - 1; i >= 0; i--) if (rates[i] > 0) return i;
  return 0;
}

// ---------- 保底 ----------

/** 目前爐階開得出某品階以上嗎（開不出的保底不累計） */
function canRollAtLeast(rates, rarity) {
  return rates.slice(rarity).some((r) => r > 0);
}

/**
 * 套用保底：抽到的品階不足、且某個保底已到 count 件時，提升到該品階；之後更新所有保底計數
 * 高品階的保底優先判定
 * @param {number} rolled 抽到的品質序號
 * @param {number[]} rates 目前爐階的機率
 * @returns {number} 最終品質序號
 */
function applyPity(rolled, rates) {
  let rarity = rolled;
  const list = CONFIG.chest.pity.slice().sort((a, b) => b.rarity - a.rarity);
  for (const p of list) {
    if (rarity >= p.rarity || !canRollAtLeast(rates, p.rarity)) continue;
    if ((state.pity[p.rarity] || 0) + 1 >= p.count) {
      rarity = p.rarity;
      break;
    }
  }
  for (const p of list) {
    if (rarity >= p.rarity) state.pity[p.rarity] = 0;
    else if (canRollAtLeast(rates, p.rarity)) state.pity[p.rarity] = (state.pity[p.rarity] || 0) + 1;
  }
  return rarity;
}

/**
 * 保底進度（開爐介面顯示用）
 * @returns {{rarity: number, count: number, progress: number, active: boolean}[]}
 */
function getPityStatus() {
  const rates = getChestRates(state.chestLevel);
  return CONFIG.chest.pity.map((p) => ({
    rarity: p.rarity,
    count: p.count,
    progress: state.pity[p.rarity] || 0,
    active: canRollAtLeast(rates, p.rarity),
  }));
}

// ---------- 倍數（開爐件數；檔位與解鎖條件在 features.js / CONFIG.chestTiers） ----------

/** 選擇倍數 */
function setMultiplier(count) {
  if (getUnlockedMultipliers().includes(count)) state.multiplier = count;
}

/** 開 count 件需要的爐火符 */
function getOpenKeyCost(count) {
  return count * CONFIG.chest.keysPerItem;
}

/**
 * 實際開箱要用的倍數：
 * 若目前倍數鑰匙不足，自動降到可負擔的最大已解鎖倍數；完全不足則回傳 0。
 */
function getEffectiveMultiplier(want = state.multiplier) {
  const unlocked = getUnlockedMultipliers().sort((a, b) => b - a);
  const canPay = (m) => state.keys >= getOpenKeyCost(m);
  if (unlocked.includes(want) && canPay(want)) return want;
  for (const m of unlocked) {
    if (m <= want && canPay(m)) return m;
  }
  return 0;
}

/** 自動開爐的件數（設定的檔位；鑰匙不足時降到付得起的最大檔） */
function getAutoBatch() {
  return getEffectiveMultiplier(state.autoOpenSettings.batch);
}

// ---------- 開箱 ----------

/** 是否有等待玩家決定的裝備（有的話不能繼續開箱） */
function hasPendingItems() {
  return state.pendingItems.length > 0;
}

/**
 * 開一次寶箱。
 * @param {boolean} auto 是否為自動開箱（會套用自動開箱設定）
 * @returns {null | {items: Item[], multiplier?: number, auto?: boolean, [k: string]: any}} 開箱結果（見 processOpenedItems）；null 表示無法開箱
 */
function openChest(auto = false) {
  // 手動：有待決定的法寶時要先處理；自動：不會被待決定佇列卡住
  if (!auto && hasPendingItems()) return null;
  const count = auto ? getAutoBatch() : getEffectiveMultiplier();
  if (count <= 0) return null;

  state.keys -= getOpenKeyCost(count);
  trackDaily('open', count);
  const rates = getChestRates(state.chestLevel);
  const level = getEquipLevel();

  const items = [];
  const pityHits = [];
  for (let i = 0; i < count; i++) {
    const rolled = rollRarityIndex(rates);
    const rarity = applyPity(rolled, rates);
    if (rarity !== rolled) pityHits.push(rarity);
    items.push(generateRandomItem(rarity, level));
  }

  const result = processOpenedItems(items, auto);
  result.pityHits = pityHits;
  result.multiplier = count;
  result.auto = auto;
  return result;
}

/**
 * 自動開爐：這件法寶符合設定的全部條件嗎
 * 目標品階以上、帶有指定詞條（1、2）、（勾選時）戰力高於目前裝備
 * @param {Item} it
 */
function matchesAutoTarget(it) {
  const s = state.autoOpenSettings;
  if (getRarityIndex(it) < s.targetRarity) return false;
  const has = (type) => !type || it.subStats.some((x) => x.type === type);
  if (!has(s.affix1) || !has(s.affix2)) return false;
  if (s.requireBetter && !isBetterItem(it)) return false;
  return true;
}

/**
 * 處理開出的裝備：
 * 手動開爐：
 *   1. 每個部位只保留戰力最高的一件，其餘分解
 *   2. 與身上裝備比較（isBetterItem：不計舊境界的套裝效果）：值得換的放入待決定佇列（跳比較視窗）
 *   3. 其餘全部分解為靈石
 * 自動開爐：
 *   符合全部條件（matchesAutoTarget）的法寶，每部位保留最好的一件放入待決定佇列並停止自動開爐；
 *   其他一律分解，不會卡在待決定佇列
 * @param {Item[]} items
 * @param {boolean} auto
 */
function processOpenedItems(items, auto = false) {
  const counts = CONFIG.rarities.map(() => 0);
  items.forEach((it) => counts[getRarityIndex(it)]++);
  recordCodex(items); // 圖鑑
  trackStat('opened', items.length);
  trackStat('mythics', counts[CONFIG.mythicRarity]);
  trackStat('divines', counts[CONFIG.divineRarity] || 0);
  // 挑戰型成就「雙神同爐」：一次開爐開出 open.divines 件以上神品
  for (const a of CONFIG.achievements) if (a.open && a.type.startsWith('stat:') && (counts[CONFIG.divineRarity] || 0) >= a.open.divines) trackStat(a.type.slice(5));

  // 每部位挑出戰力最高的一件
  const bestBySlot = {};
  for (const it of items) {
    const cur = bestBySlot[it.slot];
    if (!cur || it.power > cur.power) bestBySlot[it.slot] = it;
  }

  let salvageGold = 0; // 這次分解入帳的靈石
  let salvagedCount = 0;
  let stopTriggered = false;
  const pending = [];

  let salvageIron = 0; // 神品分解的玄鐵
  const salvage = (it) => {
    salvageGold += getSalvageGold(it);
    salvageIron += getSalvageIron(it);
    salvagedCount++;
  };

  if (auto) {
    // 符合條件的法寶裡，每部位挑戰力最高的一件
    const keepBySlot = {};
    for (const it of items) {
      if (!matchesAutoTarget(it)) continue;
      const cur = keepBySlot[it.slot];
      if (!cur || it.power > cur.power) keepBySlot[it.slot] = it;
    }
    for (const it of items) {
      if (keepBySlot[it.slot] === it) pending.push(it);
      else salvage(it);
    }
    stopTriggered = pending.length > 0;
  } else {
    for (const it of items) {
      if (bestBySlot[it.slot] !== it || !isBetterItem(it)) salvage(it);
      else pending.push(it);
    }
  }

  // 依部位順序排列待決定的裝備
  pending.sort((a, b) => CONFIG.slotOrder.indexOf(a.slot) - CONFIG.slotOrder.indexOf(b.slot));

  state.gold += salvageGold;
  state.materials.iron += salvageIron;
  state.pendingItems.push(...pending);

  return {
    items,
    counts,
    salvageGold, // 這次分解得到的靈石
    salvageIron, // 這次分解得到的玄鐵（神品）
    salvagedCount,
    pendingCount: pending.length,
    kept: pending, // 保留下來（待決定）的法寶
    stopTriggered,
  };
}

// ---------- 裝備 / 分解 ----------

/** 從待決定佇列中移除指定裝備 */
function removePending(item) {
  state.pendingItems = state.pendingItems.filter((p) => p.id !== item.id);
}

/**
 * 穿上裝備；舊裝備自動分解。
 * @param {Item} item
 * @returns {number} 舊裝備分解得到的金幣
 */
function equipItem(item) {
  const old = state.equipped[item.slot];
  let gold = 0;
  if (old) {
    gold = getSalvageGold(old);
    state.gold += gold;
    state.materials.iron += getSalvageIron(old);
  }
  state.equipped[item.slot] = item;
  removePending(item);
  onEquipmentChanged(); // 戰鬥中的主角數值立即更新
  return gold;
}

/**
 * 分解待決定的裝備。
 * @param {Item} item
 * @returns {number} 獲得的金幣
 */
function salvageItem(item) {
  const gold = getSalvageGold(item);
  state.gold += gold;
  state.materials.iron += getSalvageIron(item);
  removePending(item);
  return gold;
}

// ---------- 寶箱升級 ----------

/** 目前的爐階上限：20；第 2 次飛升後 25、第 5 次飛升後 30（CONFIG.chest.levelCaps，B2） */
function getChestMaxLevel() {
  let max = CONFIG.chest.maxLevel;
  for (const c of CONFIG.chest.levelCaps) if (isFeatureOpen(c.feature)) max = Math.max(max, c.max);
  return max;
}

/** 所有爐階的最高（30；不管有沒有開放） */
function getChestAbsoluteMaxLevel() {
  return Math.max(CONFIG.chest.maxLevel, ...CONFIG.chest.levelCaps.map((c) => c.max));
}

/**
 * 從目前等級升到下一級的費用
 * 21 階以上：靈石改用 upgradeCostGrowthBeyond 成長，每格另外要玄鐵（ironPerSegment）
 * @returns {null | {gold: number, stones: number, ironPerSegment: number}} 已達目前上限時回傳 null
 */
function getChestUpgradeCost(level = state.chestLevel) {
  const c = CONFIG.chest;
  if (level >= getChestMaxLevel()) return null;
  const to = level + 1;
  const gold =
    to <= c.maxLevel
      ? c.upgradeBaseCost * Math.pow(c.upgradeCostGrowth, level - 1)
      : c.upgradeBaseCost * Math.pow(c.upgradeCostGrowth, c.maxLevel - 2) * Math.pow(c.upgradeCostGrowthBeyond, to - c.maxLevel);
  return {
    gold: Math.round(gold),
    stones: c.upgradeStoneReq[to] || 0,
    ironPerSegment: (c.upgradeIronBeyond && c.upgradeIronBeyond[to]) || 0,
  };
}

// ---------- 分段強化（每階 6 格，填滿才能升階） ----------

/** 每一階要強化的格數 */
function getChestSegmentCount() {
  return CONFIG.chest.upgradeSegments.length;
}

/** 某一格的靈石費用（已滿級回傳 null） */
function getChestSegmentCost(seg = state.chestProgress, level = state.chestLevel) {
  const cost = getChestUpgradeCost(level);
  if (!cost || seg >= getChestSegmentCount()) return null;
  return Math.round(cost.gold * CONFIG.chest.upgradeSegments[seg]);
}

/** 某一格另外要的玄鐵（21 階以上；20 階以下或已滿級回傳 0） */
function getChestSegmentIron(seg = state.chestProgress, level = state.chestLevel) {
  const cost = getChestUpgradeCost(level);
  if (!cost || seg >= getChestSegmentCount()) return 0;
  return cost.ironPerSegment;
}

/** 這一階還要花多少靈石才能填滿強化條 */
function getChestRemainingGold() {
  let sum = 0;
  for (let i = state.chestProgress; i < getChestSegmentCount(); i++) sum += getChestSegmentCost(i) || 0;
  return sum;
}

/** 這一階還要花多少玄鐵才能填滿強化條 */
function getChestRemainingIron() {
  let sum = 0;
  for (let i = state.chestProgress; i < getChestSegmentCount(); i++) sum += getChestSegmentIron(i);
  return sum;
}

/** 強化條是否已填滿 */
function isChestProgressFull() {
  return state.chestProgress >= getChestSegmentCount();
}

function canFillChestSegment() {
  if (!isFeatureOpen('chestUpgrade') || isChestProgressFull()) return false;
  const gold = getChestSegmentCost();
  return gold !== null && state.gold >= gold && state.materials.iron >= getChestSegmentIron();
}

/** 強化一格；成功回傳 true */
function fillChestSegment() {
  if (!canFillChestSegment()) return false;
  state.gold -= getChestSegmentCost();
  state.materials.iron -= getChestSegmentIron();
  state.chestProgress++;
  trackDaily('chestUp');
  return true;
}

/** 可以升階嗎（強化條填滿＋仙玉足夠） */
function canUpgradeChest() {
  if (!isFeatureOpen('chestUpgrade') || !isChestProgressFull()) return false;
  const cost = getChestUpgradeCost();
  return !!cost && state.upgradeStones >= cost.stones;
}

/** 升階（扣仙玉、強化條歸零）；成功回傳 true */
function upgradeChest() {
  if (!canUpgradeChest()) return false;
  state.upgradeStones -= getChestUpgradeCost().stones;
  state.chestLevel++;
  state.chestProgress = 0;
  return true;
}

// ---------- 自動開箱 ----------

/** 自動開箱執行狀態（不存檔；設定存在 state.autoOpenSettings） */
const autoRun = {
  active: false,
  timer: 0, // 距離下一次開箱的秒數
};

function getAutoOpenInterval() {
  const a = CONFIG.autoOpen;
  return ((state.autoOpenSettings.speed === 2 ? a.fastIntervalMs : a.intervalMs) / 1000) * getAscChestSpeedMult(); // 爐火純青
}

function startAutoOpen() {
  if (getAutoBatch() <= 0) return false;
  autoRun.active = true;
  autoRun.timer = 0; // 立刻開第一次
  onGameEvent('autoChanged', { active: true });
  return true;
}

/** @param {string} reason 'user' | 'noKeys' | 'rarity' */
function stopAutoOpen(reason = 'user') {
  if (!autoRun.active) return;
  autoRun.active = false;
  onGameEvent('autoChanged', { active: false, reason });
}

/** 每個邏輯步長呼叫一次 */
function updateAutoOpen(dt) {
  if (!autoRun.active) return;
  autoRun.timer -= dt;
  if (autoRun.timer > 0) return;
  autoRun.timer = getAutoOpenInterval();

  if (getAutoBatch() <= 0) {
    stopAutoOpen('noKeys');
    return;
  }
  const result = openChest(true);
  if (!result) return;
  onGameEvent('chestOpened', result);
  if (result.stopTriggered) stopAutoOpen('rarity');
}
