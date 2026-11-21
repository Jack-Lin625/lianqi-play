// @ts-check
/* =========================================================
 * equipment.js — 裝備生成、屬性 / 戰力計算、比較
 * ========================================================= */

// ---------- 小工具 ----------

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 從陣列隨機取出 n 個不重複元素 */
function pickUnique(arr, n) {
  const pool = arr.slice();
  const out = [];
  while (out.length < n && pool.length > 0) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

function makeId() {
  if (window.crypto && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      /* file:// 等非安全環境可能不支援，改用下面的方式 */
    }
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** 依屬性種類取整：固定值取整數（最低 1），百分比 / 攻速保留 4 位小數 */
function roundStat(key, value) {
  const def = CONFIG.statDefs[key];
  if (def && !def.pct && def.decimals === 0) return Math.max(1, Math.round(value));
  return Math.round(value * 10000) / 10000;
}

// ---------- 裝備生成 ----------

/** 目前開箱會得到的裝備等級 = ceil(歷史最高關卡 / 2)，最低 1（飛升後重爬也維持） */
function getEquipLevel() {
  const lv = Math.ceil(getBestStage() / CONFIG.equipment.levelDivisor);
  return Math.max(CONFIG.equipment.minLevel, lv);
}

/**
 * 產生主屬性
 * 主屬性 = 部位基礎值 × (1 + 等級 × levelScale) × levelGrowth^等級 × 品質倍率 × 隨機浮動
 */
function rollMainStats(slot, rarityIndex, level) {
  const base = CONFIG.slots[slot].main;
  const rarity = CONFIG.rarities[rarityIndex];
  const eq = CONFIG.equipment;
  const levelMult = (1 + level * eq.levelScale) * Math.pow(eq.levelGrowth, level);
  const stats = {};
  // 同一件裝備的主屬性共用同一個浮動值，避免「攻高血低」這種奇怪組合
  const roll = randRange(eq.randomMin, eq.randomMax);
  for (const key of Object.keys(base)) {
    stats[key] = roundStat(key, base[key] * levelMult * rarity.statMult * roll);
  }
  return stats;
}

/** 產生副屬性（同一件裝備不重複） */
function rollSubStats(rarityIndex) {
  const count = CONFIG.rarities[rarityIndex].subCount;
  const types = pickUnique(Object.keys(CONFIG.subStats), count);
  return types.map((type) => rollOneSubStat(type, rarityIndex));
}

/** 產生一條指定種類的副屬性（數值依品階加成；詞條洗練也用這個） */
function rollOneSubStat(type, rarityIndex) {
  const bonus = 1 + rarityIndex * CONFIG.equipment.subRarityBonus;
  const range = CONFIG.subStats[type];
  return { type, value: roundStat(type, randRange(range.min, range.max) * bonus) };
}

function rollItemName(slot, rarityIndex) {
  const prefix = pickRandom(CONFIG.names.prefixes);
  const noun = pickRandom(CONFIG.names.nouns[slot]);
  return `${CONFIG.rarities[rarityIndex].name}・${prefix}之${noun}`;
}

/**
 * 產生一件裝備
 * @param {Slot} slot
 * @param {number} rarityIndex 品質序號 0～5
 * @param {number} level 法寶等級
 * @returns {Item}
 */
function generateItem(slot, rarityIndex, level, realm = 0) {
  /** @type {Item} */
  const item = {
    id: makeId(),
    slot,
    rarity: /** @type {RarityKey} */ (CONFIG.rarities[rarityIndex].key),
    level,
    name: rollItemName(slot, rarityIndex),
    mainStats: rollMainStats(slot, rarityIndex, level),
    subStats: rollSubStats(rarityIndex),
    power: 0,
  };
  // 依境界、部位、品階挑外觀（名稱、套裝、仙品特效；資料在 data/equipment.json）
  applyGearTemplate(item, pickGearTemplate(slot, rarityIndex, level, Math.random(), realm));
  item.power = calcItemPower(item);
  return item;
}

/**
 * 隨機部位的裝備
 * @param {number} rarityIndex
 * @param {number} level
 * @returns {Item}
 */
function generateRandomItem(rarityIndex, level, realm = 0) {
  return generateItem(pickRandom(CONFIG.slotOrder), rarityIndex, level, realm);
}

/** @param {Item} item */
function getRarityIndex(item) {
  return CONFIG.rarities.findIndex((r) => r.key === item.rarity);
}

/** @param {Item} item */
function getRarity(item) {
  return CONFIG.rarities[getRarityIndex(item)];
}

// ---------- 屬性與戰力 ----------

/**
 * 把一件裝備的所有屬性（主 + 副）加總成 { key: value }
 * @param {Item|null} item
 * @param {number} enhanceLevel 該部位的強化等級（主屬性 +statPerLevel × 等級）
 * @returns {StatMap}
 */
function getItemStatTotals(item, enhanceLevel = 0) {
  /** @type {StatMap} */
  const totals = {};
  if (!item) return totals;
  const mult = 1 + CONFIG.gear.enhance.statPerLevel * enhanceLevel;
  for (const [k, v] of Object.entries(item.mainStats)) totals[k] = (totals[k] || 0) + v * mult;
  for (const s of item.subStats) totals[s.type] = (totals[s.type] || 0) + s.value;
  return totals;
}

/**
 * 計算角色最終屬性。
 * 最終屬性 = 基礎 + 所有裝備加成；攻擊% / 血量% 在固定值加總後再乘上；
 * 接著乘上道途的百分比加成、加上道途的其他加成；最後套用上限。
 * @param {Record<Slot, Item|null>} equipped 部位 → 裝備（可為 null）
 * @param {StatMap|StatMap[]} bonuses 額外加成（預設為目前的道途 + 上陣靈獸 + 套裝；計算單件裝備戰力時傳 {}）
 *                                  每一組百分比加成各自獨立相乘
 * @param {Partial<Record<Slot, number>>} enhance 部位強化等級
 * @returns {Stats}
 */
function calcStats(equipped, bonuses = getStatBonuses(equipped), enhance = state.enhance) {
  /** @type {Stats} */
  const s = { ...CONFIG.baseStats, atkPct: 0, hpPct: 0, defPct: 0, goldPct: 0, cdr: 0 };
  for (const slot of CONFIG.slotOrder) {
    const totals = getItemStatTotals(equipped[slot], (enhance && enhance[slot]) || 0);
    for (const [k, v] of Object.entries(totals)) s[k] = (s[k] || 0) + v;
  }
  s.atk = s.atk * (1 + s.atkPct);
  s.hp = s.hp * (1 + s.hpPct);
  // 道途 / 靈獸加成：百分比類獨立相乘（寫 +20% 就是最終數值 ×1.2），其他（例如暴擊率、靈石掉落）直接相加
  const multKeys = { atkPct: 'atk', hpPct: 'hp', defPct: 'def' };
  for (const bonus of Array.isArray(bonuses) ? bonuses : [bonuses]) {
    for (const [k, v] of Object.entries(bonus)) {
      if (multKeys[k]) s[multKeys[k]] *= 1 + v;
      else s[k] = (s[k] || 0) + v;
    }
  }
  for (const [k, cap] of Object.entries(CONFIG.statCaps)) s[k] = Math.min(s[k], cap);
  return s;
}

/**
 * 目前生效的額外加成：道途、上陣靈獸、套裝、強化里程碑、飛升天賦（劍心、玄體）
 * @param {Record<Slot, Item|null>} [equipped]
 * @param {number} [minSetRealm] 只計算這個境界以後的套裝（換裝比較用）
 */
function getStatBonuses(equipped = state.equipped, minSetRealm = 0) {
  return [getDaoBonus(), getBeastBonus(), getSetBonus(equipped, minSetRealm), getEnhanceMilestoneBonus(), getAscStatBonus(), getCodexSetBonus()];
}

/** 戰力要額外折算的戰鬥能力：道途技能、靈獸自動攻擊 */
function getPowerExtras(equipped = state.equipped) {
  return { skill: getDaoSkill(), pets: getDeployedBeastAttacks(), effects: getEquippedEffects(equipped) };
}

/** 套用技能冷卻縮減後的技能／靈獸攻擊（cdr 來自詞條與套裝） */
function withCdr(skill, cdr) {
  if (!skill) return skill;
  return { ...skill, cooldown: skill.cooldown * (1 - (cdr || 0)) };
}

/**
 * 戰力公式（只用於顯示與比較）
 * @param {Object} s      最終屬性
 * @param {Object} extras { skill: 道途技能, pets: 靈獸攻擊清單 }（可省略）
 */
function calcPower(s, extras = {}) {
  const p = CONFIG.power;
  const base = CONFIG.baseStats;
  const power =
    s.atk * p.atk +
    s.hp * p.hp +
    s.def * p.def +
    s.atk * s.spd * (s.critRate * (s.critDmg - 1)) * p.crit +
    s.atk * (s.spd - base.spd) * p.spdBonus +
    s.atk * s.spd * s.lifesteal * p.lifesteal +
    s.hp * s.dodge * p.dodge +
    calcSkillPower(s, withCdr(extras.skill, s.cdr)) +
    (extras.pets || []).reduce((sum, pet) => sum + s.atk * (pet.mult / withCdr(pet, s.cdr).cooldown) * p.skillDamage, 0) +
    calcEffectPower(s, extras.effects);
  return Math.round(power);
}

/** 道途技能折算的戰力 */
function calcSkillPower(s, skill) {
  if (!skill) return 0;
  const p = CONFIG.power;
  if (skill.type === 'damage') return s.atk * (skill.mult / skill.cooldown) * p.skillDamage;
  if (skill.type === 'shield') {
    // 平均減傷比例 → 有效血量增幅
    const avg = skill.reduction * Math.min(1, skill.duration / skill.cooldown);
    return s.hp * p.hp * (avg / (1 - avg)) * p.skillShield;
  }
  return 0;
}

/** 這件裝備單獨的戰力 = (裸裝 + 此裝備) 的戰力 - 裸裝戰力（不含道途，讓法寶之間比較基準一致） */
function calcItemPower(item) {
  /** @type {Record<Slot, Item|null>} */
  const empty = /** @type {any} */ ({});
  CONFIG.slotOrder.forEach((slot) => (empty[slot] = null));
  const withItem = { ...empty, [item.slot]: item };
  return calcPower(calcStats(withItem, {}, {})) - calcPower(calcStats(empty, {}, {}));
}

/** 目前角色的最終屬性 */
function getCurrentStats() {
  return calcStats(state.equipped);
}

/** 目前角色的總戰力 */
function getCurrentPower() {
  return calcPower(getCurrentStats(), getPowerExtras());
}

/** 若穿上這件裝備（取代同部位），角色總戰力會變成多少 */
function calcPowerWithItem(item) {
  const equipped = { ...state.equipped, [item.slot]: item };
  return calcPower(calcStats(equipped), getPowerExtras(equipped));
}

/** 穿上這件裝備後的戰力變化（正數 = 變強） */
function calcPowerDelta(item) {
  return calcPowerWithItem(item) - getCurrentPower();
}

/**
 * 判斷「值不值得換上」用的戰力差（自動開爐、是否放入比較佇列、模擬玩家都用這個）
 * CONFIG.equipment.ignoreOutdatedSets 開啟時，兩邊都不計入「比新法寶舊的境界」的套裝效果，
 * 避免舊套裝讓某個部位一直留著低品階法寶；換上同境界的新法寶後，新套裝效果會逐步湊齊。
 * @param {Item} item
 */
function getUpgradeDelta(item) {
  if (!CONFIG.equipment.ignoreOutdatedSets) return calcPowerDelta(item);
  const minRealm = getGearRealm(item.level);
  const after = { ...state.equipped, [item.slot]: item };
  const power = (eq) => calcPower(calcStats(eq, getStatBonuses(eq, minRealm)), getPowerExtras(eq));
  return power(after) - power(state.equipped);
}

/** 這件法寶值得換上嗎 */
function isBetterItem(item) {
  return getUpgradeDelta(item) > 0;
}

/** 分解可得的金幣 = base × 裝備等級 × 品質分解倍率 */
function getSalvageGold(item) {
  return Math.round(CONFIG.salvage.base * item.level * getRarity(item).salvageMult);
}

/** 分解得到的玄鐵（只有神品有；CONFIG.rarities[].salvageIron） */
function getSalvageIron(item) {
  return Math.round(getRarity(item).salvageIron || 0);
}
