// @ts-check
/* =========================================================
 * gear.js — 裝備擴充：外觀資料、套裝、仙品特效、部位強化、圖鑑
 *
 * 外觀資料在 data/equipment.json（GEAR_DATA）：
 *   realms[境界].items[部位] = [{ id, name, set? }]  每境界每部位 3 種外觀
 *   sets[套裝 id] = { name, realm, desc, bonus: { '2': {...}, '4': {...}, '6': {...} } }
 *   mythics = [{ id, slot, name, desc, effect }]       仙品專屬
 *   divines = [{ id, slot, name, desc, set, effect }]  神品專屬（B2：每部位 1 件，6 件湊成太初套）
 * 法寶上記錄 tpl（外觀 id）、set（套裝 id，可無）、mythic（仙品／神品專屬 id，可無；特效從這裡查）。
 * ========================================================= */

/** 裝備外觀資料（載入後填入） */
/** @type {GearData|null} */
let GEAR_DATA = null;
/** id → 外觀 / 仙品，查詢用 */
/** @type {Record<string, GearTemplate>} */
const GEAR_INDEX = {};

/**
 * 載入裝備資料：發布版會先內嵌 window.EQUIPMENT_DATA；本機版從 data/equipment.json 讀取
 * 直接雙擊開啟 index.html（file://）時瀏覽器不允許讀取 JSON，需要用本機伺服器開啟
 */
async function loadGearData() {
  /** @type {GearData|null} 打包版內嵌的資料（tools/build.py） */
  let data = /** @type {any} */ (window).EQUIPMENT_DATA || null;
  if (!data) {
    const res = await fetch(CONFIG.gear.dataUrl);
    if (!res.ok) throw new Error(`讀取 ${CONFIG.gear.dataUrl} 失敗（${res.status}）`);
    data = await res.json();
  }
  setGearData(data);
}

function setGearData(data) {
  GEAR_DATA = data;
  for (const realm of data.realms) {
    for (const slot of Object.keys(realm.items)) {
      for (const t of realm.items[slot]) GEAR_INDEX[t.id] = { ...t, slot, realm: realm.realm };
    }
  }
  for (const m of data.mythics) GEAR_INDEX[m.id] = { ...m, mythic: true };
  for (const m of data.divines || []) GEAR_INDEX[m.id] = { ...m, mythic: true, divine: true };
  codexSetCache = null;
}

/** 全部外觀數（圖鑑總數） */
function getCodexTotal() {
  return Object.keys(GEAR_INDEX).length;
}

/** 裝備等級 → 第幾個境界的外觀（1 起算） */
function getGearRealm(level) {
  return Math.min(GEAR_DATA.realms.length, Math.max(1, Math.ceil(level / CONFIG.gear.levelsPerRealm)));
}

/**
 * 依部位、品階、等級挑一個外觀
 * 仙品：從該部位的仙品專屬中挑；神品：該部位的神品專屬；其他：從該境界該部位的 3 種外觀中挑
 * @param {Slot} slot
 * @param {number} rarityIndex
 * @param {number} level
 * @param {number} pick 0～1 的值（不給就隨機；遷移舊存檔時用 id 算出固定值）
 * @param {number} [realm] 指定境界（章節首殺獎勵用：從該境界有套裝的外觀中挑）
 * @returns {GearTemplate|null}
 */
function pickGearTemplate(slot, rarityIndex, level, pick = Math.random(), realm = 0) {
  if (!GEAR_DATA) return null;
  const special = rarityIndex === CONFIG.divineRarity ? GEAR_DATA.divines || [] : rarityIndex === CONFIG.mythicRarity ? GEAR_DATA.mythics : null;
  if (special) {
    const list = special.filter((m) => m.slot === slot);
    if (list.length) return GEAR_INDEX[list[Math.floor(pick * list.length)].id];
  }
  if (realm) {
    const all = GEAR_DATA.realms[Math.min(realm, GEAR_DATA.realms.length) - 1].items[slot];
    const sets = all.filter((t) => t.set);
    const list = sets.length ? sets : all;
    return GEAR_INDEX[list[Math.floor(pick * list.length)].id];
  }
  const list = GEAR_DATA.realms[getGearRealm(level) - 1].items[slot];
  return GEAR_INDEX[list[Math.floor(pick * list.length)].id];
}

/**
 * 把外觀套用到法寶（名稱、套裝、仙品）
 * @param {Item} item
 * @param {GearTemplate|null} tpl
 * @returns {Item}
 */
function applyGearTemplate(item, tpl) {
  if (!tpl) return item;
  item.tpl = tpl.id;
  item.name = `${CONFIG.rarities[getRarityIndex(item)].name}・${tpl.name}`;
  if (tpl.set) item.set = tpl.set;
  else delete item.set;
  if (tpl.mythic) item.mythic = tpl.id;
  else delete item.mythic;
  return item;
}

/** 由字串算出 0～1 的固定值（遷移舊存檔時讓同一件法寶每次都得到同一個外觀） */
function hash01(str) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

// ---------- 套裝 ----------

/** 身上各套裝的件數 { 套裝 id: 件數 } */
function getEquippedSetCounts(equipped = state.equipped) {
  const counts = {};
  for (const slot of CONFIG.slotOrder) {
    const it = equipped[slot];
    if (it && it.set) counts[it.set] = (counts[it.set] || 0) + 1;
  }
  return counts;
}

/** 套裝屬於第幾個境界（1 起算；找不到回傳 0） */
function getSetRealmIndex(setId) {
  const set = GEAR_DATA && GEAR_DATA.sets[setId];
  if (!set) return 0;
  // equipment.json 的套裝 realm 是境界序號（1 起算）；舊寫法拿它和境界名稱比對，永遠找不到（第五階段 6-1 修正）
  if (typeof set.realm === 'number') return set.realm;
  return GEAR_DATA.realms.findIndex((r) => r.realm === set.realm) + 1;
}

/**
 * 目前生效的套裝加成總和
 * @param {Record<Slot, Item|null>} [equipped]
 * @param {number} [minRealm] 只計算這個境界（含）以後的套裝；換裝比較時用來忽略舊境界套裝
 * @returns {StatMap}
 */
function getSetBonus(equipped = state.equipped, minRealm = 0) {
  const total = {};
  if (!GEAR_DATA) return total;
  for (const [setId, n] of Object.entries(getEquippedSetCounts(equipped))) {
    const set = GEAR_DATA.sets[setId];
    if (!set || getSetRealmIndex(setId) < minRealm) continue;
    for (const [need, bonus] of Object.entries(set.bonus)) {
      if (n >= Number(need)) for (const [k, v] of Object.entries(bonus)) total[k] = (total[k] || 0) + v;
    }
  }
  return total;
}

// ---------- 仙品特效 ----------

/**
 * 換上這件法寶時套裝的變化（比較視窗顯示用）
 * @param {Item} item
 * @returns {{lost: {name: string, from: number, to: number, tiers: number[]}[], gained: {name: string, from: number, to: number, tiers: number[]}[]}}
 */
function getSetChange(item) {
  const before = getEquippedSetCounts(state.equipped);
  const after = getEquippedSetCounts({ ...state.equipped, [item.slot]: item });
  const out = { lost: [], gained: [] };
  for (const setId of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const set = GEAR_DATA && GEAR_DATA.sets[setId];
    if (!set) continue;
    const from = before[setId] || 0;
    const to = after[setId] || 0;
    const needs = Object.keys(set.bonus).map(Number);
    if (to < from) out.lost.push({ name: set.name, from, to, tiers: needs.filter((n) => from >= n && to < n) });
    if (to > from) out.gained.push({ name: set.name, from, to, tiers: needs.filter((n) => to >= n && from < n) });
  }
  return out;
}

/**
 * 身上仙品法寶的特效清單
 * @param {Record<Slot, Item|null>} [equipped]
 * @returns {MythicEffect[]}
 */
function getEquippedEffects(equipped = state.equipped) {
  const out = [];
  for (const slot of CONFIG.slotOrder) {
    const it = equipped[slot];
    if (it && it.mythic && GEAR_INDEX[it.mythic]) out.push({ ...GEAR_INDEX[it.mythic].effect, source: GEAR_INDEX[it.mythic].name });
  }
  return out;
}

/** 仙品特效折算的戰力（粗估，只用於顯示與比較） */
function calcEffectPower(s, effects) {
  const p = CONFIG.power;
  let total = 0;
  for (const e of effects || []) {
    if (e.type === 'thunder') total += s.atk * s.spd * e.chance * e.mult * p.skillDamage;
    else if (e.type === 'echo') total += s.atk * s.spd * e.chance * p.atk;
    else if (e.type === 'execute') total += s.atk * p.atk * e.bonus * e.threshold;
    else if (e.type === 'heal') total += s.hp * p.hp * e.chance * e.pct * s.spd * p.healEffect;
    else if (e.type === 'guard') {
      const avg = e.chance * e.reduction;
      total += s.hp * p.hp * (avg / (1 - avg));
    }
  }
  return total;
}

// ---------- 部位強化 ----------

/** @param {Slot} slot */
function getEnhanceLevel(slot) {
  return state.enhance[slot] || 0;
}

/** 強化到下一級的花費與成功率；已滿級回傳 null */
function getEnhanceCost(slot) {
  const e = CONFIG.gear.enhance;
  const lv = getEnhanceLevel(slot);
  if (lv >= e.maxLevel) return null;
  const next = lv + 1;
  return {
    next,
    gold: Math.round(e.goldBase * Math.pow(e.goldGrowth, lv) * (1 + getBestStage() * e.stageScale)),
    iron: e.ironCost[next] || 0,
    rate: next > e.safeUntil ? e.successRates[next] : 1,
  };
}

/**
 * 強化部位一次；+10 以上有機率失敗，失敗會扣材料但不降級
 * @returns {{ok: boolean, success?: boolean, level?: number, error?: string}}
 */
function enhanceSlot(slot) {
  if (!isFeatureOpen('enhance')) return { ok: false, error: getFeatureLockText('enhance') };
  const cost = getEnhanceCost(slot);
  if (!cost) return { ok: false, error: '已強化到最高等級' };
  if (state.gold < cost.gold) return { ok: false, error: '靈石不足' };
  if (state.materials.iron < cost.iron) return { ok: false, error: `玄鐵不足（需要 ${cost.iron}）` };
  state.gold -= cost.gold;
  state.materials.iron -= cost.iron;
  const success = Math.random() < cost.rate;
  if (success) {
    state.enhance[slot] = cost.next;
    onEquipmentChanged();
  }
  trackStat('enhanceTries');
  trackDaily('enhance');
  return { ok: true, success, level: getEnhanceLevel(slot) };
}

// ---------- 強化里程碑（第五階段 6-3） ----------

/**
 * 某部位已解鎖的里程碑（依強化等級）
 * @param {Slot} slot
 * @returns {{level: number, bonus?: Object, effect?: Object, desc?: string}[]}
 */
function getEnhanceMilestones(slot, level = getEnhanceLevel(slot)) {
  const m = CONFIG.gear.enhance.milestones;
  const list = m.slots[slot] || [];
  return list.map((x, i) => ({ ...x, level: m.levels[i] })).filter((x) => level >= x.level);
}

/** 所有部位里程碑的屬性加成，合併成一組（加進 getStatBonuses） */
function getEnhanceMilestoneBonus() {
  const out = {};
  for (const slot of CONFIG.slotOrder) {
    for (const ms of getEnhanceMilestones(slot)) {
      for (const [k, v] of Object.entries(ms.bonus || {})) out[k] = (out[k] || 0) + v;
    }
  }
  return out;
}

/** 所有部位里程碑的小特效，合併成一個物件（掛在主角 hero.gearFx） */
function getEnhanceMilestoneEffects() {
  const out = {};
  for (const slot of CONFIG.slotOrder) {
    for (const ms of getEnhanceMilestones(slot)) Object.assign(out, ms.effect || {});
  }
  return out;
}

/**
 * 主角身上的小特效：強化里程碑 +12 ＋ 靈獸羈絆（6-4），合併成一個物件（hero.gearFx）
 * 減傷類（…TakenReduce）用乘法合併，其他數字相加，布林值取「有任一個」
 */
function getHeroFx() {
  const out = { ...getEnhanceMilestoneEffects() };
  for (const [k, v] of Object.entries(getBeastBondEffect())) {
    if (typeof v !== 'number') out[k] = out[k] || v;
    else if (k.endsWith('TakenReduce')) out[k] = 1 - (1 - (out[k] || 0)) * (1 - v);
    else out[k] = (out[k] || 0) + v;
  }
  return out;
}

// ---------- 詞條洗練（第五階段 6-3） ----------

/** 洗完、還沒選保留或還原的結果（不存檔；重新整理當作保留） */
let pendingReroll = null;

/** 洗練一次的玄鐵花費；不能洗時回傳 0 */
function getRerollCost(item) {
  if (!item || !item.subStats || !item.subStats.length) return 0;
  return CONFIG.gear.reroll.ironCost[getRarityIndex(item)] || 0;
}

/**
 * 洗練身上法寶的一條詞條：種類和數值都重新隨機（種類不和其他詞條重複），其他詞條不動
 * @param {Slot} slot
 * @param {number} index 第幾條詞條
 * @returns {{ok: boolean, error?: string, old?: Object, now?: Object}}
 */
function rerollAffix(slot, index) {
  if (!isFeatureOpen('enhance')) return { ok: false, error: getFeatureLockText('enhance') };
  const item = state.equipped[slot];
  if (!item || !item.subStats[index]) return { ok: false, error: '沒有這條詞條' };
  const cost = getRerollCost(item);
  if (!cost) return { ok: false, error: '這件法寶不能洗練' };
  if (state.materials.iron < cost) return { ok: false, error: `玄鐵不足（需要 ${cost}）` };
  state.materials.iron -= cost;
  const others = item.subStats.filter((_, i) => i !== index).map((x) => x.type);
  const type = /** @type {StatKey} */ (pickRandom(Object.keys(CONFIG.subStats).filter((t) => !others.includes(/** @type {StatKey} */ (t)))));
  const old = { ...item.subStats[index] };
  const now = rollOneSubStat(type, getRarityIndex(item));
  item.subStats[index] = now;
  item.power = calcItemPower(item);
  pendingReroll = { slot, index, itemId: item.id, old };
  trackStat('rerolls');
  trackDaily('reroll');
  onEquipmentChanged();
  return { ok: true, old, now };
}

/** 還原上一次洗練（只在洗完、還沒換裝時有效） */
function revertReroll() {
  const p = pendingReroll;
  pendingReroll = null;
  if (!p) return false;
  const item = state.equipped[p.slot];
  if (!item || item.id !== p.itemId) return false;
  item.subStats[p.index] = p.old;
  item.power = calcItemPower(item);
  onEquipmentChanged();
  return true;
}

/** 保留這次洗練的結果 */
function keepReroll() {
  pendingReroll = null;
}

// ---------- 圖鑑 ----------

/**
 * 記錄開出的法寶（每種外觀記最高品階）
 * @param {Item[]} items
 */
function recordCodex(items) {
  for (const it of items) {
    if (!it.tpl) continue;
    const r = getRarityIndex(it);
    if (state.codex.seen[it.tpl] === undefined) codexRev++;
    if (state.codex.seen[it.tpl] === undefined || r > state.codex.seen[it.tpl]) state.codex.seen[it.tpl] = r;
  }
}

/** 神品專屬收集了幾件（成就用） */
function getCodexDivineCount() {
  if (!GEAR_DATA || !GEAR_DATA.divines) return 0;
  return GEAR_DATA.divines.filter((m) => state.codex.seen[m.id] !== undefined).length;
}

function getCodexCount() {
  return Object.keys(state.codex.seen).filter((id) => GEAR_INDEX[id]).length;
}

// ---------- 圖鑑套組加成（B2，CONFIG.gear.codexSets） ----------

/** 圖鑑套組的清單：每個境界的 18 種外觀、仙品專屬、神品專屬 */
function getCodexSets() {
  if (!GEAR_DATA) return [];
  const c = CONFIG.gear.codexSets;
  const ids = (list) => list.map((t) => t.id);
  const out = GEAR_DATA.realms.map((r, i) => ({
    id: 'realm' + (i + 1),
    name: `${r.realm}全收集`,
    ids: ids(Object.values(r.items).flat()),
    bonus: c.realm,
    minAsc: c.realmMinAscensions || 0,
  }));
  out.push({ id: 'mythic', name: '仙品全收集', ids: ids(GEAR_DATA.mythics), bonus: c.mythic, minAsc: 0 });
  if (GEAR_DATA.divines && GEAR_DATA.divines.length) out.push({ id: 'divine', name: '神品全收集', ids: ids(GEAR_DATA.divines), bonus: c.divine, minAsc: 0 });
  return out;
}

/** 圖鑑套組：{ id, name, have, total, done, bonus, minAsc, active }（active：收集齊且飛升次數夠，加成生效） */
function getCodexSetStatus() {
  const seen = state.codex.seen;
  const count = (state.ascension && state.ascension.count) || 0;
  return getCodexSets().map((g) => {
    const have = g.ids.filter((id) => seen[id] !== undefined).length;
    const done = have >= g.ids.length;
    const minAsc = g.minAsc || 0;
    return { id: g.id, name: g.name, have, total: g.ids.length, done, bonus: g.bonus, minAsc, active: done && count >= minAsc };
  });
}

/** 加成快取：圖鑑有新收錄（codexRev）或換了存檔（seen 物件不同）時重算 */
let codexSetCache = null;
let codexRev = 0;

/** 圖鑑套組加成（圖鑑功能開放後生效；atkPct／hpPct 與其他加成相乘，計入戰力） */
function getCodexSetBonus() {
  const open = isFeatureOpen('codex');
  const key = state.codex.seen;
  const asc = (state.ascension && state.ascension.count) || 0;
  const c = codexSetCache;
  if (c && c.key === key && c.rev === codexRev && c.open === open && c.asc === asc) return c.total;
  const total = {};
  if (open) {
    for (const g of getCodexSetStatus()) {
      if (!g.active) continue;
      for (const [k, v] of Object.entries(g.bonus)) total[k] = (total[k] || 0) + v;
    }
  }
  codexSetCache = { key, rev: codexRev, open, asc, total };
  return total;
}

/**
 * 領取圖鑑收集獎勵
 * @returns {null | Object} 獎勵內容
 */
function claimCodexMilestone(index) {
  const m = CONFIG.gear.codexMilestones[index];
  if (!m || !isFeatureOpen('codex') || state.codex.claimed.includes(index) || getCodexCount() < m.count) return null;
  state.codex.claimed.push(index);
  grantRewards(m.reward, 'codex');
  return m.reward;
}

function countClaimableCodex() {
  return CONFIG.gear.codexMilestones.filter((m, i) => !state.codex.claimed.includes(i) && getCodexCount() >= m.count).length;
}
