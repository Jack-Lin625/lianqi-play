// @ts-check
/* =========================================================
 * beast.js — 靈獸
 *
 * state.beasts = { eggs, essence, owned, deployed }
 *   eggs：靈獸蛋；essence：靈獸精魄（升星用）
 *   owned：{ 種類: { rarity, star, awakened } }，每種只保留一隻（取最高品階）；awakened：已覺醒（B3，存檔 v15）
 *   deployed：上陣中的種類（最多 1 隻，斬殺築基期十層妖王後 2 隻）
 * 數值都在 CONFIG.beasts；被動加成在 calcStats 套用，自動攻擊在 battle.js 執行。
 * ========================================================= */

/** 上陣欄位數（功能開放表的 beastSlot2 開放後 2 個） */
function getBeastSlots() {
  return isFeatureOpen('beastSlot2') ? 2 : 1;
}

/** 品階、星數與覺醒加成帶來的倍率 */
function getBeastScale(owned, forSkill = false) {
  const b = CONFIG.beasts;
  const rarityMult = (forSkill ? b.skillRarityMult : b.rarityMult)[owned.rarity];
  return rarityMult * (1 + b.starBonus * (owned.star - 1)) * (owned.awakened ? b.awaken.scaleMult : 1);
}

/**
 * 某隻靈獸的被動加成（實際數值）
 * @param {string} key 種類
 * @param {OwnedBeast} [owned]
 * @returns {StatMap}
 */
function getBeastPassive(key, owned = state.beasts.owned[key]) {
  if (!owned) return {};
  const scale = getBeastScale(owned);
  const out = {};
  for (const [k, v] of Object.entries(CONFIG.beasts.species[key].passive)) out[k] = v * scale;
  return out;
}

/**
 * 某隻靈獸的自動攻擊（實際倍率）
 * 升星技能（6-4）：starSkills.levels[0] 星起倍率 ×(1 + multPct)；levels[1] 星起帶專屬效果（star4）
 * 覺醒（B3）：技能改名為覺醒技、專屬效果換成覺醒技的數值、先手（opener）
 */
function getBeastAttack(key, owned = state.beasts.owned[key]) {
  if (!owned) return null;
  const sp = CONFIG.beasts.species[key];
  const ss = CONFIG.beasts.starSkills;
  let mult = sp.skill.mult * getBeastScale(owned, true);
  if (owned.star >= ss.levels[0]) mult *= 1 + ss.multPct;
  const aw = owned.awakened ? CONFIG.beasts.awaken : null;
  const awSkill = aw ? aw.skills[key] || null : null;
  let star4 = owned.star >= ss.levels[1] ? ss.effects[key] || null : null;
  if (awSkill) star4 = { ...(star4 || {}), ...awSkill };
  return {
    key,
    name: awSkill ? awSkill.name : sp.skill.name,
    beastName: sp.name,
    icon: sp.icon,
    cooldown: sp.skill.cooldown,
    mult,
    star4,
    opener: !!(aw && aw.opener),
  };
}

// ---------- 羈絆（第五階段 6-4） ----------

/**
 * 目前上陣湊成的羈絆（沒有則為 null）
 * @param {string[]} [deployed]
 */
function getActiveBond(deployed = state.beasts.deployed) {
  if (deployed.length < 2) return null;
  for (const b of CONFIG.beasts.bonds) {
    if (b.core ? deployed.includes(b.core) : b.pair.every((k) => deployed.includes(k))) return b;
  }
  return null;
}

/** 羈絆的小特效（不計入戰力；併入主角的 gearFx） */
function getBeastBondEffect(deployed = state.beasts.deployed) {
  const b = getActiveBond(deployed);
  return b && b.effect ? b.effect : {};
}

/** 上陣靈獸的被動加成總和（含羈絆的屬性加成、麒麟護主的被動倍率） */
function getBeastBonus(deployed = state.beasts.deployed) {
  const total = {};
  const bond = getActiveBond(deployed);
  for (const key of deployed) {
    const mult = bond && bond.core && key !== bond.core ? bond.partnerPassiveMult : 1;
    for (const [k, v] of Object.entries(getBeastPassive(key))) total[k] = (total[k] || 0) + v * mult;
  }
  if (bond && bond.bonus) for (const [k, v] of Object.entries(bond.bonus)) total[k] = (total[k] || 0) + v;
  for (const [k, v] of Object.entries(getAwakenResonance())) total[k] = (total[k] || 0) + v; // 覺醒共鳴（不必上陣）
  return total;
}

// ---------- 覺醒（B3，PLAN.md 2.25） ----------

/** 已覺醒的靈獸種類數 */
function getAwakenedCount() {
  return Object.values(state.beasts.owned).filter((o) => o && o.awakened).length;
}

/** 覺醒共鳴：每覺醒一隻，主角加成 resonance × 隻數（不必上陣） */
function getAwakenResonance(n = getAwakenedCount()) {
  /** @type {StatMap} */
  const out = {};
  if (!n) return out;
  for (const [k, v] of Object.entries(CONFIG.beasts.awaken.resonance)) out[k] = v * n;
  return out;
}

/** 這隻靈獸不能覺醒的原因（可以覺醒時回傳 null） */
function getAwakenBlockReason(key) {
  const o = state.beasts.owned[key];
  if (!isFeatureOpen('beastAwaken')) return getFeatureLockText('beastAwaken');
  if (!o) return '尚未擁有這隻靈獸';
  if (o.awakened) return '已經覺醒';
  if (o.star < CONFIG.beasts.starMax) return `${CONFIG.beasts.starMax} 星才能覺醒`;
  if (state.beasts.essence < CONFIG.beasts.awaken.cost) return `靈獸精魄不足（需要 ${CONFIG.beasts.awaken.cost}）`;
  return null;
}

/**
 * 覺醒一隻靈獸
 * @returns {{ok: boolean, error?: string}}
 */
function awakenBeast(key) {
  const reason = getAwakenBlockReason(key);
  if (reason) return { ok: false, error: reason };
  state.beasts.essence -= CONFIG.beasts.awaken.cost;
  state.beasts.owned[key].awakened = true;
  trackStat('awakened');
  onEquipmentChanged();
  return { ok: true };
}

/** 上陣靈獸的自動攻擊清單 */
function getDeployedBeastAttacks() {
  return state.beasts.deployed.map((key) => getBeastAttack(key)).filter(Boolean);
}

// ---------- 孵化 ----------

/**
 * 孵化一顆靈獸蛋
 * 麒麟只會在仙品出現；已擁有的種類：品階較高就升品階（舊的轉精魄），否則整隻轉精魄
 * @returns {null | {key: string, rarity: number, isNew: boolean, upgraded: boolean, essence: number, oldRarity?: number}}
 */
function hatchEgg() {
  const b = CONFIG.beasts;
  if (state.beasts.eggs <= 0 || !isFeatureOpen('beast')) return null;
  state.beasts.eggs--;
  trackStat('hatched');
  trackDaily('hatch');

  const rarity = rollRarityIndex(b.hatchRates);
  const pool = b.order.filter((k) => b.species[k].onlyRarity === undefined || b.species[k].onlyRarity === rarity);
  return addBeast(pickRandom(pool), rarity);
}

/**
 * 獲得一隻指定種類與品階的靈獸（孵化、首儲獎勵等共用）
 * 已擁有的種類：品階較高就升品階（舊的轉精魄），否則整隻轉精魄
 * @param {string} key 種類
 * @param {number} rarity 品質序號
 * @returns {{key: string, rarity: number, isNew: boolean, upgraded: boolean, essence: number, oldRarity?: number}}
 */
function addBeast(key, rarity) {
  const b = CONFIG.beasts;
  const owned = state.beasts.owned[key];
  const result = { key, rarity, isNew: false, upgraded: false, essence: 0 };

  if (!owned) {
    state.beasts.owned[key] = { rarity, star: 1, awakened: false };
    result.isNew = true;
  } else if (rarity > owned.rarity) {
    result.essence = b.essenceByRarity[owned.rarity];
    result.oldRarity = owned.rarity;
    owned.rarity = rarity;
    result.upgraded = true;
  } else {
    result.essence = b.essenceByRarity[rarity];
  }
  state.beasts.essence += result.essence;
  if (result.upgraded) onEquipmentChanged(); // 上陣中的靈獸變強
  return result;
}

// ---------- 升星、上陣 ----------

/** 升到下一星需要的精魄（已滿星回傳 null） */
function getStarUpCost(key) {
  const owned = state.beasts.owned[key];
  if (!owned || owned.star >= CONFIG.beasts.starMax) return null;
  return CONFIG.beasts.starCost[owned.star - 1];
}

/** @returns {{ok: boolean, error?: string}} */
function starUpBeast(key) {
  const cost = getStarUpCost(key);
  if (cost === null) return { ok: false, error: '已達最高星數' };
  if (state.beasts.essence < cost) return { ok: false, error: `靈獸精魄不足（需要 ${cost}）` };
  state.beasts.essence -= cost;
  state.beasts.owned[key].star++;
  trackDaily('starUp');
  onEquipmentChanged();
  return { ok: true };
}

/**
 * 上陣／下陣
 * @returns {{ok: boolean, error?: string}}
 */
function toggleDeployBeast(key) {
  const list = state.beasts.deployed;
  const i = list.indexOf(key);
  if (i >= 0) {
    list.splice(i, 1);
  } else {
    if (!state.beasts.owned[key]) return { ok: false, error: '尚未擁有這隻靈獸' };
    if (list.length >= getBeastSlots()) return { ok: false, error: '上陣欄位已滿，請先讓一隻下陣' };
    list.push(key);
  }
  onEquipmentChanged();
  return { ok: true };
}
