// @ts-check
/* =========================================================
 * ascension.js — 飛升（路線圖 B1，PLAN.md 2.22；存檔 v12）
 *
 * state.ascension = {
 *   count 飛升次數、points 仙元（未花）、totalPoints 累計得到的仙元、talents { 天賦 id: 等級 }、
 *   bestStage 歷史最高關卡（飛升前各輪的最高；目前這一輪看 state.stage.highest，兩者取大 = getBestStage()）、
 *   tier 這一輪的天劫層數、minTierThisRun 本輪用過的最低層數（仙元依這個計算）、
 *   maxClearedTier 曾在第幾層天劫「本輪通過第 gate 關」（-1 = 還沒有；可選上限 = 這個 + aboveCleared）、
 *   lastAt 上次飛升的時間（毫秒；0 = 從未飛升）、history 飛升紀錄 [{ at, highest, tier, got, nextTier }]、
 *   v13（B2）：bestFinalTier 打倒最終 Boss 的最高天劫層數（-1 = 還沒有）、tierRewards 已發放的天劫里程碑、
 *   divinePicks 還沒選的神品自選、loweredThisRun 本輪降過層數（挑戰型成就）
 * }
 * - state.stage.highest 從 v12 起代表「本輪最高關卡」；功能開放、法寶等級、秘境、強化、坊市、成就等用 getBestStage()。
 * - 主線前線、首殺判定（旗標保留，不重複領）、主線靈石與爐火符收入用本輪關卡。
 * - 時間一律經過 ascensionNow()（模擬工具會換成模擬時鐘）。
 * ========================================================= */

/** 現在時間（毫秒）；模擬工具會覆蓋這個函式 */
function ascensionNow() {
  return Date.now();
}

// ---------- 歷史最高關卡 ----------

/** 歷史最高關卡（每一輪的最高取大） */
function getBestStage(s = state) {
  const a = s.ascension;
  return Math.max((s.stage && s.stage.highest) || 0, (a && a.bestStage) || 0);
}

// ---------- 天賦 ----------

/** @returns {any} */
function getAscTalentDef(id) {
  return CONFIG.ascension.talents.find((t) => t.id === id) || null;
}

function getAscTalentLevel(id) {
  return (state.ascension.talents && state.ascension.talents[id]) || 0;
}

/** 某天賦目前的總效果（per × 等級） */
function getAscTalentValue(id) {
  const t = getAscTalentDef(id);
  return t ? t.per * getAscTalentLevel(id) : 0;
}

/** 下一級的花費（已滿級回傳 0） */
function getAscTalentCost(id) {
  const t = getAscTalentDef(id);
  if (!t) return 0;
  const lv = getAscTalentLevel(id);
  if (t.max !== undefined && lv >= t.max) return 0;
  return Math.round(t.cost * Math.pow(t.costGrowth, lv));
}

/** 天賦已經開放了嗎（第 unlocks.talents 次飛升後） */
function isAscTalentOpen() {
  return state.ascension.count >= CONFIG.ascension.unlocks.talents;
}

/**
 * 天賦效果文字（等級 lv 時）
 * @param {any} t 天賦定義
 */
function getAscTalentText(t, lv) {
  const v = t.per * lv;
  const shown = t.id === 'offline' ? v : Math.round(v * 100);
  return String(t.desc)
    .replace('{v}', String(shown))
    .replace('{g}', String(Math.round((t.goldPer || 0) * lv * 100)))
    .replace('{r}', String(Math.round(Math.min(t.surviveMax || 1, (t.survivePer || 0) * lv) * 100)))
    .replace('{s}', String(getAscStartStage(lv)));
}

/**
 * 提升一級飛升天賦
 * @returns {{ok: boolean, error?: string}}
 */
function buyAscTalent(id) {
  const t = getAscTalentDef(id);
  if (!t) return { ok: false, error: '沒有這個天賦' };
  if (!isAscTalentOpen()) return { ok: false, error: `第 ${CONFIG.ascension.unlocks.talents} 次飛升後開放` };
  const cost = getAscTalentCost(id);
  if (!cost) return { ok: false, error: '已達上限' };
  const a = state.ascension;
  if (a.points < cost) return { ok: false, error: `仙元不足（需要 ${cost}）` };
  a.points -= cost;
  a.talents[id] = getAscTalentLevel(id) + 1;
  if (id === 'atk' || id === 'hp') onEquipmentChanged();
  return { ok: true };
}

// ---------- 天賦效果查詢 ----------

/** 給 getStatBonuses 的屬性加成（攻擊、氣血） */
function getAscStatBonus() {
  return { atkPct: getAscTalentValue('atk'), hpPct: getAscTalentValue('hp') };
}

/** 主線 Boss 受到的傷害倍率（誅魔） */
function getAscBossDamageMult() {
  return 1 + getAscTalentValue('boss');
}

/** 爐火符與玄鐵收入倍率（聚寶） */
function getAscIncomeMult() {
  return 1 + getAscTalentValue('income');
}

/** 護命（玄體）：受到致命傷害時保留 1 點氣血的機率（每場一次） */
function getAscSurviveChance(lv = getAscTalentLevel('hp')) {
  const t = getAscTalentDef('hp');
  if (!t || !t.survivePer) return 0;
  return Math.min(t.surviveMax || 1, t.survivePer * lv);
}

/** 修煉靈石收入倍率（聚寶的 goldPer：主線擊殺；閉關依上線收益計算，所以也跟著變多） */
function getAscGoldMult() {
  const t = getAscTalentDef('income');
  return 1 + ((t && t.goldPer) || 0) * getAscTalentLevel('income');
}

/** 聚寶套用在這個獎勵來源的玄鐵上嗎 */
function isAscIronSource(source) {
  return CONFIG.ascension.ironIncomeSources.includes(source);
}

/** 閉關上限（小時；洞府） */
function getOfflineMaxHours() {
  return CONFIG.offline.maxHours + getAscTalentValue('offline');
}

/** 縮地等級 lv 時，飛升後從第幾關開始 */
function getAscStartStage(lv = getAscTalentLevel('start')) {
  const t = getAscTalentDef('start');
  return Math.min(CONFIG.ascension.startMax, 1 + (t ? t.per * lv : 0));
}

/** 自動開爐間隔倍率（爐火純青） */
function getAscChestSpeedMult() {
  return Math.max(0.1, 1 - getAscTalentValue('chestSpeed'));
}

/**
 * 天劫：這一輪主線妖獸的氣血與攻擊倍率（D1 方案 Z2：兩個倍率分開）
 * @returns {{hp: number, atk: number}}
 */
function getTribulationMult(tier = state.ascension.tier) {
  const c = CONFIG.ascension.tribulation;
  return { hp: Math.pow(c.hpMult, tier), atk: Math.pow(c.atkMult, tier) };
}

/** 天劫倍率的說明文字，例如「氣血 ×2.20、攻擊 ×1.86」 */
function tribulationMultText(tier) {
  const m = getTribulationMult(tier);
  return `氣血 ×${m.hp.toFixed(2)}、攻擊 ×${m.atk.toFixed(2)}`;
}

// ---------- 天劫層數 ----------

/** 飛升時可以選的最高層數（本輪已經通過第 gate 關時，至少算本輪用過的最低層數） */
function getTierCap() {
  const a = state.ascension;
  const cleared = state.stage.highest >= CONFIG.ascension.gate ? Math.max(a.maxClearedTier, a.minTierThisRun) : a.maxClearedTier;
  return Math.max(0, cleared + CONFIG.ascension.tribulation.aboveCleared);
}

/**
 * 本輪中途降低天劫（立即生效；仙元改用本輪用過的最低層數）
 * @returns {{ok: boolean, error?: string}}
 */
function lowerTier(t) {
  const a = state.ascension;
  t = Math.floor(t);
  if (!(t >= 0 && t < a.tier)) return { ok: false, error: '只能降低天劫層數' };
  a.tier = t;
  a.minTierThisRun = Math.min(a.minTierThisRun, t);
  a.loweredThisRun = true;
  if (stageRun.battle) startStage(); // 目前這場戰鬥換成新的妖獸數值
  return { ok: true };
}

/**
 * 通關時記錄「在這一層天劫通過第 gate 關」；打倒最終 Boss 時更新最高天劫紀錄、發放天劫里程碑（stage.js 的 onStageCleared 呼叫）
 * @returns {{tier: number, got: RewardGot}[]} 這次發放的天劫里程碑
 */
function onAscStageCleared(total) {
  const a = state.ascension;
  if (total >= CONFIG.ascension.gate && a.tier > a.maxClearedTier) a.maxClearedTier = a.tier;
  if (total < getMaxStage()) return [];
  if (a.tier > a.bestFinalTier) a.bestFinalTier = a.tier;
  if (a.tier >= 1 && !a.loweredThisRun) trackStat('noLowerFinal'); // 挑戰型成就「一往無前」
  return grantTierMilestones();
}

// ---------- 天劫里程碑（B2） ----------

/** 發放已達成、還沒發過的天劫里程碑 */
function grantTierMilestones() {
  const a = state.ascension;
  const out = [];
  for (const m of CONFIG.ascension.tierMilestones) {
    if (a.bestFinalTier < m.tier || a.tierRewards.includes(m.tier)) continue;
    a.tierRewards.push(m.tier);
    out.push({ tier: m.tier, got: grantRewards(m.reward, 'tierMilestone') });
  }
  return out;
}

/**
 * 神品自選：選一個部位，得到該部位的神品專屬（放進待決定佇列）
 * @param {Slot} slot
 * @returns {{ok: boolean, error?: string, item?: Item}}
 */
function pickDivine(slot) {
  const a = state.ascension;
  if (!(a.divinePicks > 0)) return { ok: false, error: '沒有可以自選的神品' };
  if (!CONFIG.slotOrder.includes(slot)) return { ok: false, error: '沒有這個部位' };
  a.divinePicks--;
  const item = generateItem(slot, CONFIG.divineRarity, getEquipLevel());
  state.pendingItems.push(item);
  recordCodex([item]);
  trackStat('divines');
  return { ok: true, item };
}

// ---------- 仙元 ----------

/**
 * 某個本輪最高關卡、天劫層數可得的仙元
 * @param {number} highest 本輪最高關卡
 * @param {number} tier 天劫層數
 */
function getAscendPoints(highest, tier) {
  const c = CONFIG.ascension;
  const base = Math.pow(Math.max(0, highest - c.pointsFrom), c.pointsExp) * c.pointsBase + (highest >= getMaxStage() ? c.finalBonus : 0);
  return Math.floor(base * (1 + c.tribulation.pointsPerTier * tier));
}

/**
 * 飛升預覽：現在飛升可得、再推到第 Y 關可得
 * @returns {{tier: number, now: number, next: {stage: number, points: number, final: boolean}|null}}
 */
function getAscendPreview() {
  const a = state.ascension;
  const h = state.stage.highest;
  const tier = a.minTierThisRun;
  const y = CONFIG.ascension.previewSteps.find((x) => x > h);
  return {
    tier,
    now: h >= CONFIG.ascension.gate ? getAscendPoints(h, tier) : 0,
    next: y ? { stage: y, points: getAscendPoints(y, tier), final: y >= getMaxStage() } : null,
  };
}

// ---------- 能不能飛升 ----------

/** 冷卻剩餘毫秒（0 = 可以） */
function getAscendCooldownLeft(now = ascensionNow()) {
  const a = state.ascension;
  if (!a.lastAt) return 0;
  return Math.max(0, a.lastAt + CONFIG.ascension.cooldownHours * 3600000 - now);
}

/** 不能飛升的原因（可以飛升回傳 null） */
function getAscendBlockReason() {
  if (!isFeatureOpen('ascension')) return getFeatureLockText('ascension');
  if (state.stage.highest < CONFIG.ascension.gate) return `本輪通過 ${formatStage(CONFIG.ascension.gate)}後才能飛升`;
  if (getAscendCooldownLeft() > 0) return `飛升冷卻中：${formatDuration(getAscendCooldownLeft())}後可以再飛升`;
  if (typeof dungeonRun !== 'undefined' && dungeonRun.active) return '秘境中不能飛升';
  return null;
}

function canAscend() {
  return getAscendBlockReason() === null;
}

/** 毫秒 → 「47:59:12」 */
function formatDuration(ms) {
  const s = Math.ceil(ms / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/**
 * 飛升會重置的資源（確認視窗列出實際數字）
 * @returns {{startStage: number, gold: number, goldAfter: number, keys: number, keysAfter: number}}
 */
function getAscendResetInfo() {
  const k = CONFIG.ascension.keepRatio;
  return {
    startStage: getAscStartStage(),
    gold: state.gold,
    goldAfter: Math.floor(state.gold * k),
    keys: state.keys,
    keysAfter: Math.floor(state.keys * k),
  };
}

/** 飛升前自動備份目前的存檔（設定頁可以還原） */
function backupBeforeAscend() {
  try {
    localStorage.setItem(CONFIG.ascension.backupKey, JSON.stringify({ at: ascensionNow(), count: state.ascension.count, data: JSON.stringify(state) }));
    return true;
  } catch (e) {
    return false;
  }
}

/** 飛升前的備份（沒有回傳 null） */
function getAscendBackup() {
  try {
    const raw = localStorage.getItem(CONFIG.ascension.backupKey);
    if (!raw) return null;
    const b = JSON.parse(raw);
    return b && typeof b.data === 'string' ? b : null;
  } catch (e) {
    return null;
  }
}

/**
 * 飛升
 * @param {number} nextTier 下一輪的天劫層數（0 ～ getTierCap()）
 * @returns {{ok: boolean, error?: string, got?: number, count?: number, startStage?: number, giftItems?: Item[], codexActivated?: boolean}}
 */
function ascend(nextTier = 0) {
  const reason = getAscendBlockReason();
  if (reason) return { ok: false, error: reason };
  const t = Math.floor(nextTier);
  if (!(t >= 0 && t <= getTierCap())) return { ok: false, error: `天劫層數只能選 0～${getTierCap()}` };
  if (typeof saveGame === 'function') saveGame();
  backupBeforeAscend();
  const a = state.ascension;
  const h = state.stage.highest;
  const got = getAscendPoints(h, a.minTierThisRun);
  a.maxClearedTier = Math.max(a.maxClearedTier, a.minTierThisRun); // 本輪已通過第 gate 關（飛升條件）
  a.bestStage = getBestStage();
  a.points += got;
  a.totalPoints += got;
  a.count++;
  a.lastAt = ascensionNow();
  a.history.unshift({ at: a.lastAt, highest: h, tier: a.minTierThisRun, got, nextTier: t });
  a.history.length = Math.min(a.history.length, CONFIG.ascension.historyMax);
  a.tier = t;
  a.minTierThisRun = t;
  a.loweredThisRun = false;
  // 重置：主線關卡、Boss 戰意與退回狀態；靈石與爐火符保留 keepRatio
  const start = getAscStartStage();
  const k = CONFIG.ascension.keepRatio;
  state.gold = Math.floor(state.gold * k);
  state.keys = Math.floor(state.keys * k);
  state.stage.highest = start - 1;
  setCurrentStage(start);
  state.stage.autoAdvance = true;
  state.stage.fury = { boss: 0, stacks: 0 };
  stageRun.failCount = 0;
  if (typeof autoRun !== 'undefined' && autoRun.active) stopAutoOpen('user');
  startStage();
  trackStat('ascensions');
  // 第 divineGift.at 次飛升送一件神品（部位隨機）
  const gift = CONFIG.ascension.divineGift;
  const giftItems = gift && a.count === gift.at ? grantRewards(gift.reward, 'ascend').items : [];
  // 境界圖鑑套組在第 realmMinAscensions 次飛升時開始生效
  const codexActivated = a.count === (CONFIG.gear.codexSets.realmMinAscensions || 0);
  return { ok: true, got, count: a.count, startStage: start, giftItems, codexActivated };
}

/** 飛升頁的提示點：可以飛升、或仙元夠升級某個天賦 */
function hasAscendNotice() {
  if (!isFeatureOpen('ascension')) return false;
  if (canAscend()) return true;
  return isAscTalentOpen() && CONFIG.ascension.talents.some((t) => {
    const c = getAscTalentCost(t.id);
    return c > 0 && c <= state.ascension.points;
  });
}
