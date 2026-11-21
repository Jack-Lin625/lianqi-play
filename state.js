// @ts-check
/* =========================================================
 * state.js — 遊戲狀態、存檔 / 讀檔
 *
 * 【內部名稱對照】遊戲換成修仙主題前取的變數名，為了不破壞玩家存檔沒有改名：
 *   state.gold                → 靈石（主要貨幣：擊殺、分解、秘境）
 *   state.keys                → 爐火符（開煉器爐的消耗品）
 *   state.upgradeStones       → 仙玉（高級貨幣：升爐、商店、儲值）
 *   state.chestLevel          → 煉器爐階數
 *   state.multiplier          → 一次開爐的件數（×1 / ×2 / ×5 / ×10）
 *   state.materials.iron      → 玄鐵（強化材料）
 *   state.beasts.essence      → 靈獸精魄（升星材料）
 *   state.stage.chapter/level → 境界 / 層數（第 1 章 = 練氣期）
 *   state.dao                 → 道途（劍修 sword、法修 spell、體修 body）
 *   state.dungeons.gold/key/tower/worldBoss → 靈石秘境 / 妖獸潮 / 鎮妖塔 / 上古妖王
 *   rarity common～mythic     → 凡品、靈品、玄品、地品、天品、仙品
 *   slot weapon/helmet/armor/gloves/boots/accessory → 飛劍、道冠、道袍、護腕、雲履、玉佩
 *   「鑰匙」「寶箱」「金幣」「升級石」等舊註解，分別指爐火符、煉器爐、靈石、仙玉。
 * ========================================================= */

/** 全域遊戲狀態，所有模組直接讀寫這個物件 */
/** @type {GameState} */
let state = null;

/** 今天的本地日期字串（YYYY-MM-DD），用於每日重置 */
function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 建立一份全新的預設存檔
 * @returns {GameState}
 */
function createDefaultState() {
  /** @type {Record<Slot, Item|null>} */
  const equipped = /** @type {any} */ ({});
  CONFIG.slotOrder.forEach((slot) => (equipped[slot] = null));

  return {
    version: CONFIG.save.version,
    gold: CONFIG.newPlayer.gold,
    keys: CONFIG.newPlayer.keys,
    upgradeStones: CONFIG.newPlayer.upgradeStones,
    chestLevel: CONFIG.chest.minLevel,
    chestProgress: 0, // 這一階已強化的格數（分段強化）
    multiplier: 1,
    autoOpenSettings: { ...CONFIG.autoOpen.defaults },
    equipped,
    pendingItems: [], // 等待玩家在比較視窗中決定的裝備（關閉頁面也不會遺失）
    // fury：Boss 戰意（boss = 總關卡數）；chapterRewards：已發放章節首殺獎勵的章節（首殺旗標，避免重複領取）
    stage: { chapter: 1, level: 1, highest: 0, autoAdvance: true, fury: { boss: 0, stacks: 0 }, chapterRewards: [] },
    bossFirstClears: [],
    dungeons: {
      lastResetDate: todayString(),
      gold: { remaining: CONFIG.dungeons.dailyFree, unlockedDifficulty: 1, selected: 1, bought: 0 },
      key: { remaining: CONFIG.dungeons.dailyFree, selected: 1, bought: 0, eggPity: 0 }, // eggPity：靈獸蛋保底累積的額外機率
      tower: { highestFloor: 0, sweepDate: '' },
      worldBoss: { remaining: CONFIG.dungeons.dailyFree, bestDamage: 0, bought: 0 },
      // 掃蕩用的最佳紀錄：gold { 難度: 靈石 }、key { 難度: 波數 }、worldBoss 達到的區間數
      records: { gold: {}, key: {}, worldBoss: 0 },
    },
    lastOnline: Date.now(),
    offlineReward: null, // 尚未領取的離線收益 { minutes, gold, keys, basis }
    onlineRate: { gold: 0, keys: 0, samples: 0 }, // 最近在線時主線每分鐘收益（移動平均）
    tutorial: { seen: [] }, // 已看過的新手引導
    dao: { path: null, tier: 1, talents: [null, null] }, // 道途：path = 'sword' | 'spell' | 'body' | null（未選），tier = 第幾轉，talents = 一轉／二轉選的天賦 id（null = 未選）
    // 靈獸：eggs 靈獸蛋、essence 靈獸精魄、owned 已擁有 { 種類: { rarity, star } }、deployed 上陣中的種類
    beasts: { eggs: 0, essence: 0, owned: {}, deployed: [] },
    // 每日任務（daily.js）：date 對應的日期、tasks 抽到的題目（null = 還沒抽）、progress 計數器、claimed 已領的任務、chests 已開的活躍度寶箱
    daily: { date: todayString(), tasks: null, progress: {}, claimed: [], chests: [] },
    // ---- v4 ----
    enhance: defaultEnhance(), // 部位強化等級（換裝不會遺失）
    materials: { iron: 0 }, // 玄鐵：強化 +6 以上的材料（每級需要的數量見 CONFIG.gear.enhance.ironCost）
    codex: { seen: {}, claimed: [] }, // 圖鑑：seen = { 外觀 id: 最高品階 }，claimed = 已領的收集獎勵
    stats: { opened: 0, kills: 0, hatched: 0, awakened: 0, mythics: 0, bossKills: 0, enhanceTries: 0, dungeonRuns: 0, loginDays: 0, lastLoginDate: '' },
    achievements: { done: [], claimed: [] },
    signin: { count: 0, lastDate: '' }, // 月曆簽到：count = 累計簽到次數（中斷不歸零）
    shop: {
      market: { date: '', items: [], refreshes: 0 }, // 坊市：每日 6 個商品
      purchases: {}, // 各商品購買次數
      firstDone: [], // 已用過首儲雙倍的方案
      monthCard: { until: 0, lastClaim: '' }, // 月卡到期時間、上次領取日期
      pass: { season: 0, exp: 0, paid: false, free: [], premium: [] }, // 修仙戰令（賽季制，見 pass.js）
      totalSpent: 0, // 累計儲值金額（NT$）
      spendClaimed: [], // 已領的累計儲值獎勵
      firstExclusiveDone: false, // 已領過首儲專屬獎勵
      cosmetics: { owned: ['default'], equipped: 'default' }, // 外觀
      doubleUntil: 0, // 雙倍收益卡到期時間
      orders: [], // 模擬付款紀錄（最近 30 筆）
    },
    settings: { sound: true, music: true, musicVolume: CONFIG.sound.defaultMusicVolume, sfxVolume: CONFIG.sound.defaultSfxVolume },
    // ---- v5 ----
    welfare: { lastLoginDate: '', loginDays: 0, newbieClaimed: 0 }, // 每日福利、新手七日禮
    mail: [], // 信箱
    mailSeq: 0,
    // ---- v6 ----
    pity: { 3: 0, 4: 0, 5: 0, 6: 0 }, // 開爐保底：連續幾件沒開出該品階以上（key = 品質序號）
    // ---- v8 ----
    // 功能開放：open = { 功能 id: 開放時的累計在線分鐘 }、tiersSeen = 已提示過的開爐件數、playSeconds = 累計在線秒數
    features: { open: {}, tiersSeen: [], playSeconds: 0 },
    // ---- v11 ----
    // 每週任務與每週活躍度（daily.js）；week = 這週第一天
    weekly: { week: '', drawn: false, alt: [], progress: {}, claimed: [], chests: [], activity: 0 },
    // 重置時自動發放：pending 還沒發放（存檔遷移留下的）、notices 已發放等著跳提示
    autoClaim: { pending: [], notices: [] },
    // ---- v12 ----
    // 飛升（ascension.js）：從 v12 起 stage.highest 是「本輪最高關卡」，歷史最高記在 ascension.bestStage
    ascension: defaultAscension(),
    // ---- v16 ----
    // 存檔保護（backup.js）：lastExportAt 上次匯出（ms，0 = 沒匯出過）、lastRemindDate 上次提醒匯出的日期、
    //   autoPlaySec 上次自動備份時的累計在線秒數、autoDate 上次「每天第一次上線」備份的日期
    backup: defaultBackupState(),
  };
}

/** 存檔保護的預設值（v16）
 * @returns {BackupState} */
function defaultBackupState() {
  return { lastExportAt: 0, lastRemindDate: '', autoPlaySec: 0, autoDate: '' };
}

/** 飛升的預設值（ascension.js；v12）
 * @returns {AscensionState} */
function defaultAscension() {
  return {
    count: 0, points: 0, totalPoints: 0, talents: {}, bestStage: 0, tier: 0, minTierThisRun: 0, maxClearedTier: -1, lastAt: 0, history: [],
    // v13（B2）
    bestFinalTier: -1, tierRewards: [], divinePicks: 0, loweredThisRun: false,
  };
}

/** @returns {Record<Slot, number>} */
function defaultEnhance() {
  const e = /** @type {Record<Slot, number>} */ ({});
  CONFIG.slotOrder.forEach((slot) => (e[slot] = 0));
  return e;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 用預設值補上舊存檔缺少的欄位（遞迴）。
 * 只補「缺少」的欄位，不覆蓋已存在的值。
 */
function fillDefaults(target, defaults) {
  for (const key of Object.keys(defaults)) {
    const def = defaults[key];
    if (target[key] === undefined) {
      target[key] = isPlainObject(def) || Array.isArray(def) ? JSON.parse(JSON.stringify(def)) : def;
    } else if (isPlainObject(def) && isPlainObject(target[key])) {
      fillDefaults(target[key], def);
    }
  }
  return target;
}

/**
 * 存檔遷移規則：key = 目標版本，函式負責把「上一版」的資料轉成這一版
 * 之後改版只要在這裡加一條，並把 CONFIG.save.version 加 1
 */
const SAVE_MIGRATIONS = {
  // v1 → v2：新增道途（未選擇；已過練氣期十層的玩家進遊戲後會看到選擇提示）
  2: (data) => {
    if (!isPlainObject(data.dao)) data.dao = { path: null, tier: 1 };
  },
  // v2 → v3：新增靈獸、每日任務、秘境購買次數；最後上線時間若不是有效數字就校正為現在
  3: (data) => {
    if (!isPlainObject(data.beasts)) data.beasts = { eggs: 0, essence: 0, owned: {}, deployed: [] };
    if (!isPlainObject(data.daily)) data.daily = { date: todayString(), progress: {}, claimed: [] }; // v11 遷移再換成新結構
    if (isPlainObject(data.dungeons)) {
      for (const type of ['gold', 'key', 'worldBoss']) {
        if (isPlainObject(data.dungeons[type]) && typeof data.dungeons[type].bought !== 'number') data.dungeons[type].bought = 0;
      }
    }
    if (typeof data.lastOnline !== 'number' || !isFinite(data.lastOnline) || data.lastOnline <= 0) data.lastOnline = Date.now();
  },
  // v3 → v4：舊法寶依 id 固定分配境界外觀（名稱、套裝；仙品分配專屬特效），圖鑑記下身上的法寶
  //          其他新欄位（強化、材料、成就、簽到、商店、音量）由預設值補上
  4: (data) => {
    const items = [...Object.values(isPlainObject(data.equipped) ? data.equipped : {}), ...(Array.isArray(data.pendingItems) ? data.pendingItems : [])];
    if (!isPlainObject(data.codex)) data.codex = { seen: {}, claimed: [] };
    for (const it of items) {
      if (!it || it.tpl) continue;
      const r = CONFIG.rarities.findIndex((x) => x.key === it.rarity);
      applyGearTemplate(it, pickGearTemplate(it.slot, r, it.level || 1, hash01(it.id)));
      if (it.tpl && (data.codex.seen[it.tpl] === undefined || r > data.codex.seen[it.tpl])) data.codex.seen[it.tpl] = r;
    }
    if (isPlainObject(data.settings) && data.settings.sound === false) data.settings.music = false;
  },
  // v4 → v5：福利、信箱、賽季戰令、累計儲值
  //   舊玩家的新手七日禮從遷移這天起算；累計儲值優先用訂單紀錄的實際金額，紀錄不完整時用購買次數 × 目前售價估算；
  //   戰令改成賽季制（獎勵內容不同），舊的領取紀錄不沿用，已購買付費線的玩家當季維持已解鎖
  5: (data) => {
    if (!isPlainObject(data.shop)) return; // 沒有商店資料的存檔由預設值補上
    const shop = data.shop;
    const oldPass = isPlainObject(shop.pass) ? shop.pass : {};
    shop.pass = { season: getSeasonNumber(), exp: 0, paid: !!oldPass.paid, free: [], premium: [] };
    const r = CONFIG.shop.recharge;
    const prices = { [r.monthCard.id]: r.monthCard.price, [r.starter.id]: r.starter.price, [r.pass.id]: r.pass.price };
    for (const g of r.gems) prices[g.id] = g.price;
    const purchases = isPlainObject(shop.purchases) ? shop.purchases : {};
    const orders = Array.isArray(shop.orders) ? shop.orders : [];
    const bought = Object.entries(purchases).filter(([id]) => prices[id]).reduce((n, [, c]) => n + (Number(c) || 0), 0);
    let spent = 0;
    if (orders.length === bought) {
      // 訂單紀錄完整：用實際付款金額
      for (const o of orders) spent += Number(o.price) || 0;
    } else {
      // 紀錄不完整（只保留最近幾筆）：用購買次數 × 目前售價估算
      for (const [id, n] of Object.entries(purchases)) if (prices[id]) spent += prices[id] * (Number(n) || 0);
    }
    shop.totalSpent = spent;
    shop.spendClaimed = [];
    shop.firstExclusiveDone = Array.isArray(shop.firstDone) && shop.firstDone.length > 0; // 已經首儲過的不再補送
  },
  // v5 → v6：開爐保底、靈獸蛋保底、Boss 戰意從 0 開始（由預設值補上）；
  //   上古妖王的掃蕩紀錄用目前的最高傷害換算成達到的區間數；靈石秘境與妖獸潮要再打一次才有紀錄
  6: (data) => {
    const d = isPlainObject(data.dungeons) ? data.dungeons : null;
    if (!d) return;
    const best = isPlainObject(d.worldBoss) ? Number(d.worldBoss.bestDamage) || 0 : 0;
    const base = Math.max(1, (isPlainObject(data.stage) && data.stage.highest) || 1);
    const hp = getMonsterStats(base, false).hp / CONFIG.scale.stats; // v6 以前的存檔是放大前的單位（v7 才放大）
    const tiers = CONFIG.dungeons.worldBoss.tiers.filter((t) => best >= Math.round(t.hpMult * hp)).length;
    d.records = { gold: {}, key: {}, worldBoss: tiers };
  },
  // v6 → v7：數值放大。持有的貨幣、材料、待領的閉關收益、在線收益紀錄、掃蕩紀錄、上古妖王最高傷害、
  //   法寶的攻擊／氣血／護體、信件附的獎勵，全部乘上 CONFIG.scale 的倍率（與遊戲中的獎勵、花費同倍率）
  7: (data) => {
    const sc = CONFIG.scale;
    const mul = (obj, key, f) => {
      if (isPlainObject(obj) && typeof obj[key] === 'number') obj[key] *= f;
    };
    mul(data, 'gold', sc.gold);
    mul(data, 'keys', sc.keys);
    mul(data, 'upgradeStones', sc.stones);
    mul(data.materials, 'iron', sc.iron);
    mul(data.beasts, 'essence', sc.essence);
    mul(data.offlineReward, 'gold', sc.gold);
    mul(data.offlineReward, 'keys', sc.keys);
    mul(data.onlineRate, 'gold', sc.gold);
    mul(data.onlineRate, 'keys', sc.keys);
    if (isPlainObject(data.dungeons)) {
      mul(data.dungeons.worldBoss, 'bestDamage', sc.stats);
      const rec = data.dungeons.records;
      if (isPlainObject(rec) && isPlainObject(rec.gold)) for (const k of Object.keys(rec.gold)) mul(rec.gold, k, sc.gold);
    }
    const items = [...Object.values(isPlainObject(data.equipped) ? data.equipped : {}), ...(Array.isArray(data.pendingItems) ? data.pendingItems : [])];
    for (const it of items) {
      if (!it || !isPlainObject(it.mainStats)) continue;
      for (const k of ['atk', 'hp', 'def']) mul(it.mainStats, k, sc.stats);
      it.power = calcItemPower(it);
    }
    for (const m of Array.isArray(data.mail) ? data.mail : []) {
      for (const [field, kind] of Object.entries(REWARD_SCALE_KEYS)) mul(m.reward, field, sc[kind]);
    }
  },
  // v7 → v8：功能開放表、開爐件數 13 檔
  //   舊玩家的累計在線時間不明：有進度（最高通關 > 0）的視為已在線 60 分鐘
  //   已達成條件的功能直接開放、不重播演出（也不再發開放附贈）；沒達成的照新條件鎖住
  //   開爐件數換成新檔位中「不超過原本件數」的最大一檔
  8: (data) => {
    const highest = (isPlainObject(data.stage) && data.stage.highest) || 0;
    data.features = { open: {}, tiersSeen: [], playSeconds: highest > 0 ? 3600 : 0 };
    const minutes = Math.floor(data.features.playSeconds / 60);
    for (const f of CONFIG.features) {
      if (f.kind !== 'future' && f.cond && isCondMet(f.cond, data)) data.features.open[f.id] = minutes;
    }
    const tiers = CONFIG.chestTiers.filter((t) => isCondMet(t.cond, data)).map((t) => t.count);
    data.features.tiersSeen = tiers;
    const old = typeof data.multiplier === 'number' ? data.multiplier : 1;
    data.multiplier = Math.max(1, ...tiers.filter((c) => c <= old));
    data.chestProgress = 0; // 分段強化：從 0 格開始，靈石與爐階不變
    // 自動開爐設定改版：停止品階 → 目標品階（「不停止」改成最高品階），預設勾選「戰力高於目前裝備」
    const a = isPlainObject(data.autoOpenSettings) ? data.autoOpenSettings : {};
    const maxRarity = CONFIG.rarities.length - 1;
    const stop = typeof a.stopAtRarity === 'number' ? a.stopAtRarity : CONFIG.autoOpen.defaults.targetRarity;
    data.autoOpenSettings = {
      targetRarity: Math.min(maxRarity, stop),
      affix1: '',
      affix2: '',
      requireBetter: true,
      batch: data.multiplier,
      speed: a.speed === 2 ? 2 : 1,
    };
  },
  9: (data) => {
    // 章節首殺獎勵：已經通過的章節寄到信箱補發（不設期限），並記錄旗標避免重複
    if (!isPlainObject(data.stage)) data.stage = {};
    const highest = data.stage.highest || 0;
    const done = Array.isArray(data.stage.chapterRewards) ? data.stage.chapterRewards : [];
    if (!Array.isArray(data.mail)) data.mail = [];
    if (typeof data.mailSeq !== 'number') data.mailSeq = 0;
    const per = CONFIG.stage.levelsPerChapter;
    for (let ch = 1; ch <= CONFIG.chapterRewards.length; ch++) {
      if (highest < ch * per || done.includes(ch)) continue;
      done.push(ch);
      data.mailSeq++;
      data.mail.push({
        id: data.mailSeq,
        title: `章節首殺補發・${CONFIG.realms[ch - 1]}`,
        desc: '新增的章節首殺獎勵，補發給已經通過這一章的道友',
        reward: CONFIG.chapterRewards[ch - 1],
        time: Date.now(),
      });
    }
    data.stage.chapterRewards = done;
  },
  // v9 → v10：道途天賦（每一轉二選一）。已選道途的玩家天賦未選，打開道途分頁時跳出選擇
  10: (data) => {
    if (!isPlainObject(data.dao)) data.dao = { path: null, tier: 1 };
    if (!Array.isArray(data.dao.talents)) data.dao.talents = [null, null];
  },
  // v10 → v11：每日任務池、每週任務、活躍度寶箱、月曆簽到
  //   七日簽到這一輪已簽 d 天 → 月曆從第 (d mod 7) + 1 格接著簽（下一個大獎第 7 格和原本的第 7 天同一天到）
  //   舊的三個固定任務「已完成但沒領」的照原本的獎勵自動發放（載入後跳提示）；當天重新抽題
  11: (data) => {
    const old = isPlainObject(data.signin) ? data.signin : {};
    data.signin = { count: (Number(old.day) || 0) % 7, lastDate: typeof old.lastDate === 'string' ? old.lastDate : '' };
    const d = isPlainObject(data.daily) ? data.daily : {};
    const progress = isPlainObject(d.progress) ? d.progress : {};
    const claimed = Array.isArray(d.claimed) ? d.claimed : [];
    const rewards = CONFIG.save.legacyDailyTasks.filter((t) => (progress[t.id] || 0) >= t.target && !claimed.includes(t.id)).map((t) => t.reward);
    data.autoClaim = { pending: rewards.length ? [{ title: '舊版每日任務（已完成未領取）', reward: mergeRewards(rewards) }] : [], notices: [] };
    // 今天的計數器（開爐、擊殺、秘境）沿用到新任務；舊的題目與已領紀錄不沿用
    const today = d.date === todayString();
    data.daily = { date: today ? d.date : '', tasks: null, progress: today ? { ...progress } : {}, claimed: [], chests: [] };
    data.weekly = { week: '', drawn: false, alt: [], progress: {}, claimed: [], chests: [], activity: 0 };
  },
  // v11 → v12：飛升。歷史最高關卡 = 目前的最高通關；已經通過第 90 關的玩家算「在天劫 0 層通過」（可選上限 1）。
  //   功能開放表照原本的做法：條件已達成的直接開放、不重播演出（main.js 的 checkUnlocks 會在載入後補上，這裡先開放避免跳演出）
  12: (data) => {
    const highest = (isPlainObject(data.stage) && data.stage.highest) || 0;
    const a = defaultAscension();
    a.bestStage = highest;
    if (highest >= CONFIG.ascension.gate) a.maxClearedTier = 0;
    data.ascension = a;
    if (isPlainObject(data.features) && isPlainObject(data.features.open) && highest >= CONFIG.ascension.gate && data.features.open.ascension === undefined) {
      data.features.open.ascension = Math.floor((data.features.playSeconds || 0) / 60);
    }
  },
  // v12 → v13（B2）：爐階 21～30、神品、天劫里程碑
  //   打倒最終 Boss 的最高天劫層數從飛升紀錄推算（本輪已經打倒的也算）；已達成的里程碑寄到信箱補發
  //   飛升 2／5 次以上：爐階 21～25／26～30 直接開放（不播演出）
  13: (data) => {
    const a = isPlainObject(data.ascension) ? data.ascension : (data.ascension = defaultAscension());
    const max = CONFIG.stage.chapters * CONFIG.stage.levelsPerChapter;
    let best = -1;
    for (const h of Array.isArray(a.history) ? a.history : []) if (h && h.highest >= max) best = Math.max(best, h.tier || 0);
    if (isPlainObject(data.stage) && (data.stage.highest || 0) >= max) best = Math.max(best, a.minTierThisRun || 0);
    a.bestFinalTier = best;
    a.tierRewards = [];
    a.divinePicks = 0;
    a.loweredThisRun = false;
    if (!Array.isArray(data.mail)) data.mail = [];
    if (typeof data.mailSeq !== 'number') data.mailSeq = 0;
    for (const m of CONFIG.ascension.tierMilestones) {
      if (best < m.tier) continue;
      a.tierRewards.push(m.tier);
      data.mailSeq++;
      data.mail.push({ id: data.mailSeq, title: `天劫里程碑補發・${m.tier} 重`, desc: '新增的天劫里程碑獎勵，補發給已經在這一層打倒最終 Boss 的道友', reward: m.reward, time: Date.now() });
    }
    if (isPlainObject(data.pity) && data.pity[6] === undefined) data.pity[6] = 0;
    if (isPlainObject(data.features) && isPlainObject(data.features.open)) {
      const minutes = Math.floor((data.features.playSeconds || 0) / 60);
      for (const f of CONFIG.features) {
        if (f.cond && f.cond.ascensions !== undefined && (a.count || 0) >= f.cond.ascensions && data.features.open[f.id] === undefined) data.features.open[f.id] = minutes;
      }
    }
  },
  // v13 → v14：第 2 次飛升送神品（CONFIG.ascension.divineGift）。已經飛升 2 次以上的存檔寄到信箱補發一次；
  //   境界圖鑑套組改成飛升後生效（只影響計算，存檔不用改）
  14: (data) => {
    const a = isPlainObject(data.ascension) ? data.ascension : null;
    const gift = CONFIG.ascension.divineGift;
    if (!a || !gift || (a.count || 0) < gift.at) return;
    if (!Array.isArray(data.mail)) data.mail = [];
    if (typeof data.mailSeq !== 'number') data.mailSeq = 0;
    data.mailSeq++;
    data.mail.push({ id: data.mailSeq, title: '飛升賀禮補發・神品法寶', desc: `第 ${gift.at} 次飛升新增的神品賀禮（部位隨機），補發給已經飛升 ${gift.at} 次以上的道友`, reward: gift.reward, time: Date.now() });
  },
  // v14 → v15（B3）：靈獸覺醒。每隻已擁有的靈獸補 awakened: false、覺醒次數統計 0。
  //   已飛升 3 次以上的存檔不在這裡開放功能：載入後由功能開放表照常開放（播放演出、發精魄贈禮）
  15: (data) => {
    if (isPlainObject(data.beasts) && isPlainObject(data.beasts.owned)) {
      for (const o of Object.values(data.beasts.owned)) if (isPlainObject(o) && o.awakened === undefined) o.awakened = false;
    }
    if (isPlainObject(data.stats) && data.stats.awakened === undefined) data.stats.awakened = 0;
  },
  // v15 → v16（C1）：存檔保護。新增 backup（沒匯出過、還沒有自動備份）
  16: (data) => {
    if (!isPlainObject(data.backup)) data.backup = defaultBackupState();
    if (isPlainObject(data.features)) data.backup.autoPlaySec = data.features.playSeconds || 0;
  },
  // v16 → v17（D2）：鎮妖塔每日塔俸。新增 sweepDate（還沒領過）
  17: (data) => {
    if (isPlainObject(data.dungeons) && isPlainObject(data.dungeons.tower) && typeof data.dungeons.tower.sweepDate !== 'string') data.dungeons.tower.sweepDate = '';
  },
};

/** 依版本號逐版升級舊存檔 */
function migrateSave(data) {
  if (typeof data.version !== 'number') data.version = 1;
  for (let v = data.version + 1; v <= CONFIG.save.version; v++) {
    if (SAVE_MIGRATIONS[v]) SAVE_MIGRATIONS[v](data);
    data.version = v;
  }
  return data;
}

/** 讀到舊版存檔時，先把原始內容另存一份（key 後面加上 _v版本號_backup），遷移出問題還能救回 */
function backupOldSave(raw, version) {
  try {
    localStorage.setItem(`${CONFIG.save.key}_v${version}_backup`, raw);
  } catch (e) {
    /* 空間不足等情況：不影響遊戲 */
  }
}

/**
 * 讀檔結果（不存檔；畫面在載入後依這個跳說明）
 * @type {{status: 'ok'|'new'|'recovered'|'lost', backupAt?: number, error?: string}}
 */
let loadResult = { status: 'ok' };

/**
 * 解析並升級一份存檔文字（讀檔、匯入、還原備份共用）
 * @returns {GameState} 讀不出來或不是本遊戲的存檔時丟出錯誤
 */
function parseSaveText(raw, backupOld = false) {
  const data = JSON.parse(raw);
  if (!isPlainObject(data) || typeof data.gold !== 'number' || !isPlainObject(data.equipped)) throw new Error('這不是本遊戲的存檔');
  if (backupOld && (typeof data.version !== 'number' || data.version < CONFIG.save.version)) backupOldSave(raw, data.version || 1);
  return fillDefaults(migrateSave(data), createDefaultState());
}

/**
 * 讀檔；沒有存檔時建立新存檔
 * 存檔讀不出來（內容壞掉、遷移出錯）時不會覆蓋：原始內容另存到 CONFIG.backup.corruptKey，
 * 從最新的自動備份還原（backup.js）；沒有可用的備份才建立新存檔
 */
function loadGame() {
  let raw = null;
  try {
    raw = localStorage.getItem(CONFIG.save.key);
  } catch (e) {
    raw = null;
  }
  loadResult = { status: raw ? 'ok' : 'new' };
  if (raw) {
    try {
      state = parseSaveText(raw, true);
      return state;
    } catch (e) {
      console.warn('讀檔失敗，改從自動備份還原', e);
      loadResult = { status: 'lost', error: String((e && e.message) || e) };
      try {
        localStorage.setItem(CONFIG.backup.corruptKey, raw);
      } catch (e2) {
        /* 空間不足：原始內容仍留在主存檔的 key，直到下一次存檔 */
      }
      const restored = typeof restoreLatestAutoBackup === 'function' ? restoreLatestAutoBackup() : null;
      if (restored) {
        state = restored.state;
        loadResult = { status: 'recovered', backupAt: restored.at, error: loadResult.error };
        return state;
      }
    }
  }
  state = createDefaultState();
  return state;
}

/** 存檔失敗時呼叫（畫面跳一次提示；ui 載入後設定） */
let onSaveFailed = null;

/**
 * 存檔
 * 寫不進去（空間不足）時主存檔優先：依序刪掉舊版遷移備份、從最舊的開始減少自動備份，每清一次就重試（backup.js 的 freeSpaceForMainSave）；
 * 全部清完還寫不進去才提示
 * @returns {boolean} 成功與否（失敗：空間不足、私密瀏覽等）
 */
function saveGame() {
  if (!state) return false;
  state.lastOnline = Date.now();
  const text = JSON.stringify(state);
  const write = () => localStorage.setItem(CONFIG.save.key, text);
  try {
    write();
    return true;
  } catch (e) {
    if (typeof freeSpaceForMainSave === 'function' && freeSpaceForMainSave(write)) return true;
    console.warn('存檔失敗', e);
    if (typeof onSaveFailed === 'function') onSaveFailed(e);
    return false;
  }
}

/** 重置存檔（呼叫前請先二次確認） */
function resetGame() {
  try {
    localStorage.removeItem(CONFIG.save.key);
  } catch (e) {
    /* 忽略 */
  }
  state = createDefaultState();
  saveGame();
  return state;
}

/** 匯出存檔（JSON 文字） */
function exportSave() {
  saveGame();
  return JSON.stringify(state);
}

/**
 * 匯入存檔
 * @returns {{ok: boolean, error?: string}}
 */
function importSave(text) {
  let data;
  try {
    data = JSON.parse(String(text).trim());
  } catch (e) {
    return { ok: false, error: '格式錯誤：不是有效的 JSON' };
  }
  if (!isPlainObject(data) || typeof data.gold !== 'number' || typeof data.keys !== 'number' || !isPlainObject(data.equipped)) {
    return { ok: false, error: '這不是本遊戲的存檔' };
  }
  try {
    state = fillDefaults(migrateSave(data), createDefaultState());
  } catch (e) {
    return { ok: false, error: '存檔內容有誤，無法升級到目前的版本' };
  }
  state.lastOnline = Date.now(); // 避免匯入後立刻領到一大筆離線收益
  saveGame();
  return { ok: true };
}
