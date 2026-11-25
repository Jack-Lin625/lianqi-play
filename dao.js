// @ts-check
/* =========================================================
 * dao.js — 道途（劍修 / 法修 / 體修）
 *
 * state.dao = { path, tier, talents }
 *   path：'sword' | 'spell' | 'body' | null（尚未選擇）
 *   tier：第幾轉（1 = 一轉，2 = 突破後的二轉）
 *   talents：[一轉天賦 id, 二轉天賦 id]（null = 未選；第五階段 6-2）
 * 數值都在 CONFIG.dao；屬性加成在 calcStats 套用，技能在 battle.js 執行。
 * ========================================================= */

/** 是否已解鎖道途（斬殺練氣期十層妖王） */
function isDaoUnlocked() {
  return isFeatureOpen('dao');
}

/** 某道途某一轉的設定；沒選道途時回傳 null */
function getDaoTierConfig(path = state.dao.path, tier = state.dao.tier) {
  if (!path || !CONFIG.dao.paths[path]) return null;
  const tiers = CONFIG.dao.paths[path].tiers;
  return tiers[Math.min(Math.max(1, tier), tiers.length) - 1];
}

/** 目前道途的屬性加成（沒選時為空物件；「雷體」天賦氣血 +10%：hpPctAdd，v1.2） */
function getDaoBonus() {
  const t = getDaoTierConfig();
  if (!t) return {};
  const fx = getDaoTalentEffect();
  if (fx.hpPctAdd) return { ...t.bonus, hpPct: (t.bonus.hpPct || 0) + fx.hpPctAdd };
  return t.bonus;
}

/** 目前道途的技能（沒選時為 null）；已套用天賦對技能的修改 */
function getDaoSkill() {
  const t = getDaoTierConfig();
  if (!t) return null;
  return applyTalentToSkill(t.skill, getDaoTalentEffect());
}

/** 天賦對技能的修改：冷卻、倍率、持續時間加減，以及技能本身的特效旗標 */
function applyTalentToSkill(skill, fx) {
  if (!skill) return skill;
  const sk = { ...skill };
  if (fx.cooldownAdd) sk.cooldown = Math.max(0.5, sk.cooldown + fx.cooldownAdd);
  if (fx.multAdd && sk.type === 'damage') sk.mult = Math.max(0.5, sk.mult + fx.multAdd);
  if (fx.durationAdd && sk.type === 'shield') sk.duration = sk.duration + fx.durationAdd;
  for (const k of ['castAtStart', 'firstCooldownMult', 'skillCrit', 'executeBelow', 'executeMult', 'recastChance', 'pierceShield', 'pierceDef']) {
    if (fx[k]) sk[k] = fx[k];
  }
  return sk;
}

// ---------- 天賦（每一轉二選一，第五階段 6-2） ----------

/**
 * 某道途某一轉可選的兩個天賦
 * @param {number} tier 1 或 2
 */
function getDaoTalentChoices(path = state.dao.path, tier = 1) {
  if (!path || !CONFIG.dao.paths[path]) return [];
  const list = CONFIG.dao.paths[path].talents || [];
  return list[tier - 1] || [];
}

/** 目前在某一轉選的天賦（沒選或 id 對不上時回傳 null） */
function getDaoTalent(tier) {
  const ids = state.dao.talents || [];
  const id = ids[tier - 1];
  return getDaoTalentChoices(state.dao.path, tier).find((t) => t.id === id) || null;
}

/** 目前生效的天賦效果（只算已達到的轉數），合併成一個物件 */
function getDaoTalentEffect() {
  const out = {};
  if (!state.dao.path) return out;
  for (let tier = 1; tier <= state.dao.tier; tier++) {
    const t = getDaoTalent(tier);
    if (t) Object.assign(out, t.effect);
  }
  return out;
}

/** 已經可以選、但還沒選天賦的第一個轉數（0 = 都選了） */
function getPendingTalentTier() {
  if (!state.dao.path) return 0;
  for (let tier = 1; tier <= state.dao.tier; tier++) {
    if (getDaoTalentChoices(state.dao.path, tier).length && !getDaoTalent(tier)) return tier;
  }
  return 0;
}

/** 選或改選某一轉天賦的花費（還沒選時免費） */
function getDaoTalentCost(tier) {
  return getDaoTalent(tier) ? CONFIG.dao.rerollCost : 0;
}

/**
 * 選擇或改選天賦
 * @returns {{ok: boolean, error?: string}}
 */
function chooseDaoTalent(tier, id) {
  if (!state.dao.path) return { ok: false, error: '尚未選擇道途' };
  if (tier > state.dao.tier) return { ok: false, error: `突破${tier === 2 ? '二' : tier}轉後才能選擇` };
  if (!getDaoTalentChoices(state.dao.path, tier).some((t) => t.id === id)) return { ok: false, error: '沒有這個天賦' };
  const cur = getDaoTalent(tier);
  if (cur && cur.id === id) return { ok: false, error: '已經選了這個天賦' };
  const cost = getDaoTalentCost(tier);
  if (state.upgradeStones < cost) return { ok: false, error: `仙玉不足（需要 ${cost}）` };
  state.upgradeStones -= cost;
  if (!Array.isArray(state.dao.talents)) state.dao.talents = [null, null];
  state.dao.talents[tier - 1] = id;
  onEquipmentChanged();
  return { ok: true };
}

/** 目前道途的名稱（例如「劍修」「劍仙」） */
function getDaoName() {
  const t = getDaoTierConfig();
  return t ? t.name : '';
}

function getDaoMaxTier(path = state.dao.path) {
  return path ? CONFIG.dao.paths[path].tiers.length : 1;
}

/** 選擇／改修道途的花費（第一次免費） */
function getDaoChooseCost() {
  return state.dao.path ? CONFIG.dao.rerollCost : 0;
}

/**
 * 選擇或改修道途（已突破的轉數會保留）
 * @returns {{ok: boolean, error?: string}}
 */
function chooseDao(path) {
  if (!isDaoUnlocked()) return { ok: false, error: '尚未開啟道途' };
  if (!CONFIG.dao.paths[path]) return { ok: false, error: '沒有這條道途' };
  if (state.dao.path === path) return { ok: false, error: '已在修行此道' };
  const cost = getDaoChooseCost();
  if (state.upgradeStones < cost) return { ok: false, error: `仙玉不足（需要 ${cost}）` };
  state.upgradeStones -= cost;
  state.dao.path = path;
  state.dao.talents = [null, null]; // 改修其他道途：天賦清空，重選免費
  state.dao.tier = Math.min(state.dao.tier, getDaoMaxTier(path));
  onEquipmentChanged(); // 戰鬥中的主角立即套用新加成與技能
  return { ok: true };
}

/** 是否可以突破到下一轉 */
function canAscendDao() {
  return !!state.dao.path && state.dao.tier < getDaoMaxTier() && isFeatureOpen('daoAscend');
}

/**
 * 突破二轉
 * @returns {{ok: boolean, error?: string}}
 */
function ascendDao() {
  if (!canAscendDao()) return { ok: false, error: '尚未達成突破條件' };
  state.dao.tier++;
  onEquipmentChanged();
  return { ok: true };
}
