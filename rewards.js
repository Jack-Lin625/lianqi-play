// @ts-check
/* =========================================================
 * rewards.js — 發放獎勵（商店、儲值、成就、簽到、圖鑑共用）
 *
 * 獎勵格式：{ gold, keys, stones, eggs, essence, iron, items: [{ rarity, realm? }], beast: { key, rarity }, loot: '隨機表 id', cosmetic, doubleHours }
 * 「發放」與「付款」完全分開：這裡只負責把獎勵加到存檔，不知道錢從哪裡來。
 * ========================================================= */

/** 隨機表的每種結果與機率（%），購買前顯示用 */
function getLootOdds(tableId) {
  const t = CONFIG.lootTables[tableId];
  const total = t.entries.reduce((sum, e) => sum + e.weight, 0);
  return t.entries.map((e) => ({ label: e.label, pct: (e.weight / total) * 100, reward: e.reward }));
}

/** 依權重抽一個結果 */
function rollLoot(tableId) {
  const t = CONFIG.lootTables[tableId];
  const total = t.entries.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * total;
  for (const e of t.entries) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return t.entries[t.entries.length - 1];
}

/**
 * 發放獎勵
 * @param {Reward} reward 獎勵內容
 * @param {string} source 來源（記錄用，例如 'shop'、'achievement'）
 * @returns {RewardGot} 實際得到的內容（隨機表已展開；items 為產生的法寶，已放入待決定佇列）
 */
function grantRewards(reward, source = '') {
  /** @type {RewardGot} */
  const got = { gold: 0, keys: 0, stones: 0, eggs: 0, essence: 0, iron: 0, items: [], beasts: [], rolled: [], source };
  /** @param {Reward} r */
  const add = (r) => {
    if (r.gold) (state.gold += r.gold), (got.gold += r.gold);
    if (r.keys) (state.keys += r.keys), (got.keys += r.keys);
    if (r.stones) (state.upgradeStones += r.stones), (got.stones += r.stones);
    if (r.eggs) (state.beasts.eggs += r.eggs), (got.eggs += r.eggs);
    if (r.essence) (state.beasts.essence += r.essence), (got.essence += r.essence);
    if (r.iron) {
      const iron = isAscIronSource(source) ? Math.round(r.iron * getAscIncomeMult()) : r.iron; // 聚寶（飛升天賦）
      state.materials.iron += iron;
      got.iron += iron;
    }
    for (const spec of r.items || []) {
      const item = generateRandomItem(spec.rarity, getEquipLevel(), spec.realm || 0); // realm：指定境界的套裝外觀
      state.pendingItems.push(item);
      recordCodex([item]);
      if (spec.rarity === CONFIG.divineRarity) trackStat('divines');
      got.items.push(item);
    }
    if (r.beast) got.beasts.push(addBeast(r.beast.key, r.beast.rarity));
    if (r.cosmetic && !state.shop.cosmetics.owned.includes(r.cosmetic)) {
      state.shop.cosmetics.owned.push(r.cosmetic);
      got.cosmetic = r.cosmetic;
    }
    if (r.divinePick) {
      state.ascension.divinePicks = (state.ascension.divinePicks || 0) + r.divinePick; // 神品自選（飛升頁選部位）
      got.divinePick = (got.divinePick || 0) + r.divinePick;
    }
    if (r.doubleHours) {
      const from = Math.max(Date.now(), state.shop.doubleUntil);
      state.shop.doubleUntil = from + r.doubleHours * 3600000;
      got.doubleHours = (got.doubleHours || 0) + r.doubleHours;
    }
    for (const lootId of [r.loot, ...(r.loots || [])]) {
      if (!lootId) continue;
      const e = rollLoot(lootId);
      got.rolled.push(e.label);
      add(e.reward);
    }
  };
  add(reward);
  return got;
}

/**
 * 把多份獎勵內容合併成一份（例如季末把未領的戰令獎勵合成一封信）
 * 注意：指定靈獸（beast）不會被合併，需要的話請分開寄送
 * @param {Reward[]} list
 * @returns {Reward}
 */
function mergeRewards(list) {
  /** @type {Reward} */
  const out = {};
  for (const r of list) {
    for (const k of ['gold', 'keys', 'stones', 'eggs', 'essence', 'iron', 'doubleHours', 'divinePick']) if (r[k]) out[k] = (out[k] || 0) + r[k];
    if (r.items) out.items = [...(out.items || []), ...r.items];
    if (r.loot) out.loots = [...(out.loots || []), r.loot];
    if (r.loots) out.loots = [...(out.loots || []), ...r.loots];
    if (r.cosmetic) out.cosmetic = r.cosmetic;
  }
  return out;
}

/**
 * 把多次發放的結果合併成一份（顯示用）
 * @param {RewardGot[]} list
 * @returns {RewardGot}
 */
function mergeRewardGot(list) {
  /** @type {RewardGot} */
  const out = { gold: 0, keys: 0, stones: 0, eggs: 0, essence: 0, iron: 0, items: [], beasts: [], rolled: [], source: '' };
  for (const g of list) {
    if (!g) continue;
    for (const k of ['gold', 'keys', 'stones', 'eggs', 'essence', 'iron']) out[k] += g[k] || 0;
    out.items.push(...g.items);
    out.beasts.push(...(g.beasts || []));
    out.rolled.push(...g.rolled);
    if (g.cosmetic) out.cosmetic = g.cosmetic;
    if (g.doubleHours) out.doubleHours = (out.doubleHours || 0) + g.doubleHours;
  }
  return out;
}

/**
 * 獎勵換算成仙玉的價值（隨機內容以期望值計算；換算表在 CONFIG.valuation.gemValue）
 * @param {Reward} r
 * @returns {number}
 */
function getRewardGemValue(r) {
  const v = CONFIG.valuation.gemValue;
  let total = 0;
  for (const k of ['stones', 'keys', 'iron', 'eggs', 'essence', 'gold', 'doubleHours']) total += (r[k] || 0) * v[k];
  for (const spec of r.items || []) total += v.items[spec.rarity] || 0;
  if (r.beast) total += v.beast[r.beast.rarity] || 0;
  if (r.cosmetic) total += v.cosmetic;
  for (const lootId of [r.loot, ...(r.loots || [])]) {
    if (lootId) for (const o of getLootOdds(lootId)) total += (o.pct / 100) * getRewardGemValue(o.reward);
  }
  return total;
}

/**
 * 付費商品的「價值 X 倍」= 內容價值（仙玉）× 每仙玉基準價 ÷ 售價
 * @param {number} gemValue 內容價值（仙玉）
 * @param {number} price 售價
 */
function getValueMultiple(gemValue, price) {
  return price > 0 ? (gemValue * CONFIG.valuation.ntdPerGem) / price : 0;
}

/** 雙倍收益卡是否生效中 */
function isDoubleActive(now = Date.now()) {
  return state.shop.doubleUntil > now;
}
