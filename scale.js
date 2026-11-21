// @ts-check
/* =========================================================
 * scale.js — 數值放大（載入時套用 CONFIG.scale 的倍率）
 *
 * config.js 裡的貨幣與屬性都是「基準單位」，這裡在遊戲開始前把它們放大成遊戲中的數字。
 * 獎勵與花費用同一個倍率，所以兌換比例與進度速度都不變。
 * 新增任何「貨幣數量」或「攻擊／氣血／護體」欄位時，記得在 SCALE_FIELDS 或 REWARD_PATHS 加上它。
 * 必須在 config.js 之後、其他檔案之前載入。
 * ========================================================= */

/** 獎勵物件裡的欄位 → 倍率種類（靈獸蛋 eggs 不放大） */
const REWARD_SCALE_KEYS = { gold: 'gold', keys: 'keys', stones: 'stones', iron: 'iron', essence: 'essence' };

/**
 * 「獎勵物件」所在的位置（* = 陣列的每一項或物件的每個值）
 * 物件裡的 gold／keys／stones／iron／essence 依倍率放大
 */
const REWARD_PATHS = [
  'dailyTaskRules.reward',
  'activity.daily.*.reward',
  'activity.weekly.*.reward',
  'weeklyTaskRules.reward',
  'save.legacyDailyTasks.*.reward',
  'gear.codexMilestones.*.reward',
  'lootTables.*.entries.*.reward',
  'achievements.*.reward',
  'signin.days.*',
  'signin.ownedCosmeticBonus',
  'shop.market.pool.*.reward',
  'shop.gem.*.reward',
  'shop.recharge.starter.reward',
  'shop.recharge.firstExclusive.reward',
  'shop.recharge.spendRewards.*.reward',
  'pass.tiers.*.free',
  'pass.tiers.*.premium',
  'welfare.newbieGifts.*',
  'dungeons.worldBoss.tiers.*', // 每個區間的 gold／keys／stones／iron
  'dungeons.tower.bigReward', // stones
  'chapterRewards.*', // 章節首殺獎勵的玄鐵
  'ascension.tierMilestones.*.reward', // 天劫里程碑（B2）
  'ascension.divineGift.reward', // 第 2 次飛升送的神品
  'features.*.gift', // 功能開放贈禮（B3：靈獸覺醒的精魄）
];

/**
 * 單一數值欄位 → 倍率種類（* = 陣列的每一項或物件的每個值）
 * 'gold/stats' 代表「靈石倍率 ÷ 屬性倍率」（例如靈石秘境的每點傷害換多少靈石）
 */
const SCALE_FIELDS = [
  // 初始資源
  ['newPlayer.gold', 'gold'],
  ['newPlayer.keys', 'keys'],
  ['newPlayer.upgradeStones', 'stones'],
  // 屬性：角色基礎、法寶部位基礎、怪物
  ['baseStats.atk', 'stats'],
  ['baseStats.hp', 'stats'],
  ['baseStats.def', 'stats'],
  ['slots.*.main.atk', 'stats'],
  ['slots.*.main.hp', 'stats'],
  ['slots.*.main.def', 'stats'],
  ['monster.hpBase', 'stats'],
  ['monster.atkBase', 'stats'],
  ['monster.defBase', 'stats'],
  // 分解、煉器爐
  ['salvage.base', 'gold'],
  ['chest.keysPerItem', 'keys'],
  ['chest.upgradeBaseCost', 'gold'],
  ['chest.upgradeStoneReq.*', 'stones'],
  ['chest.upgradeIronBeyond.*', 'iron'], // B2：21 階以上每格的玄鐵
  ['rarities.*.salvageIron', 'iron'], // B2：神品分解的玄鐵
  // 主線獎勵
  ['stageRewards.killGoldBase', 'gold'],
  ['stageRewards.clearKeysMin', 'keys'],
  ['stageRewards.clearKeysMax', 'keys'],
  ['stageRewards.bossFirstKeys', 'keys'],
  ['stageRewards.bossFirstStones', 'stones'],
  ['stageRewards.bossFirstGoldPerChapter', 'gold'],
  ['stageRewards.bossRepeatKeys', 'keys'],
  // 秘境
  ['dungeons.buyCost', 'stones'],
  ['dungeons.gold.goldPerDamage', 'gold/stats'],
  ['dungeons.key.keysPerWave', 'keys'],
  ['dungeons.tower.stonesEvery5', 'stones'],
  ['dungeons.tower.extraStonesEvery10', 'stones'],
  ['dungeons.tower.sweep.stones', 'stones'], // 每日塔俸：每 stonesPer 層的仙玉
  ['dungeons.tower.sweep.iron', 'iron'], // 每日塔俸：每 ironPer 層的玄鐵
  // 閉關
  ['offline.doubleCost', 'stones'],
  ['offline.keysPerInterval', 'keys'],
  // 道途、靈獸、強化
  ['dao.rerollCost', 'stones'],
  ['beasts.starCost.*', 'essence'],
  ['beasts.essenceByRarity.*', 'essence'],
  ['beasts.awaken.cost', 'essence'], // B3：覺醒消耗
  ['gear.enhance.goldBase', 'gold'],
  ['gear.enhance.ironCost.*', 'iron'],
  ['gear.reroll.ironCost.*', 'iron'],
  // 商店與儲值
  ['shop.market.refreshCost.*', 'stones'],
  ['shop.market.pool.*.price', 'gold'],
  ['shop.gem.*.price', 'stones'],
  ['shop.cosmetics.*.price', 'stones'],
  ['shop.recharge.gems.*.gems', 'stones'],
  ['shop.recharge.gems.*.bonus', 'stones'],
  ['shop.recharge.monthCard.instant', 'stones'],
  ['shop.recharge.monthCard.daily', 'stones'],
  ['welfare.dailyLoginGems', 'stones'],
  // 開發者按鈕
  ['dev.addKeys', 'keys'],
  ['dev.addGold', 'gold'],
  ['dev.addStones', 'stones'],
];

/** 依路徑找出所有符合的位置，回傳 [父物件, 欄位名] 清單 */
function findScalePaths(root, path) {
  const parts = path.split('.');
  /** @type {[any, string][]} */
  let found = [[{ root }, 'root']];
  for (const part of parts) {
    /** @type {[any, string][]} */
    const next = [];
    for (const [parent, key] of found) {
      const v = parent[key];
      if (v === null || typeof v !== 'object') continue;
      if (part === '*') for (const k of Object.keys(v)) next.push([v, k]);
      else if (part in v) next.push([v, part]);
    }
    found = next;
  }
  return found;
}

/** 倍率種類 → 實際倍率 */
function getScaleFactor(kind, scale) {
  if (kind.includes('/')) {
    const [a, b] = kind.split('/');
    return scale[a] / scale[b];
  }
  return scale[kind];
}

/** 把名稱裡的 {keys}、{iron} 等換成獎勵數量 */
function fillAmountTemplate(text, reward) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (reward && typeof reward[k] === 'number' ? String(reward[k]) : m));
}

/**
 * 套用放大倍率（只能執行一次；CONFIG.scaleApplied 記錄是否已套用）
 * @param {any} cfg CONFIG
 */
function applyScale(cfg) {
  if (cfg.scaleApplied) return;
  const scale = cfg.scale;
  for (const path of REWARD_PATHS) {
    for (const [parent, key] of findScalePaths(cfg, path)) {
      const r = parent[key];
      if (!r || typeof r !== 'object') continue;
      for (const [field, kind] of Object.entries(REWARD_SCALE_KEYS)) if (typeof r[field] === 'number') r[field] *= scale[kind];
    }
  }
  for (const [path, kind] of SCALE_FIELDS) {
    const f = getScaleFactor(kind, scale);
    for (const [parent, key] of findScalePaths(cfg, path)) if (typeof parent[key] === 'number') parent[key] *= f;
  }
  // 付費商品價值換算：每仙玉基準價變小；各資源「值多少仙玉」依兩邊倍率換算
  const v = cfg.valuation;
  v.ntdPerGem /= scale.stones;
  const gv = v.gemValue;
  for (const res of ['keys', 'iron', 'essence', 'gold']) gv[res] *= scale.stones / scale[res];
  for (const res of ['eggs', 'doubleHours', 'cosmetic']) gv[res] *= scale.stones;
  gv.items = gv.items.map((x) => x * scale.stones);
  gv.beast = gv.beast.map((x) => x * scale.stones);
  // 商品名稱與隨機結果名稱裡的數量
  for (const e of cfg.shop.market.pool) e.name = fillAmountTemplate(e.name, e.reward);
  for (const e of cfg.shop.gem) e.name = fillAmountTemplate(e.name, e.reward);
  for (const t of Object.values(cfg.lootTables)) for (const e of t.entries) e.label = fillAmountTemplate(e.label, e.reward);
  cfg.scaleApplied = true;
}

applyScale(CONFIG);
