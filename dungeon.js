// @ts-check
/* =========================================================
 * dungeon.js — 副本
 *
 * 四種副本：gold（金幣）、key（鑰匙）、tower（試煉之塔）、worldBoss（世界 Boss）
 * 進入副本時主線暫停，結束後自動回到主線。
 * 畫面相關的事情一律透過 onGameEvent(name, data)（ui.js）通知。
 * ========================================================= */

const DUNGEON_TYPES = ['gold', 'key', 'tower', 'worldBoss'];

// ---------- 解鎖、次數、每日重置 ----------

/** 各秘境對應的功能 id（開放條件在 CONFIG.features） */
const DUNGEON_FEATURES = { gold: 'dungeon', key: 'dungeonKey', tower: 'dungeonTower', worldBoss: 'dungeonWorldBoss' };

/** 秘境種類 → 每日任務的計數器（daily.js）；靈石秘境只算在「秘境歷練」 */
const DUNGEON_TASK_TRACKS = { key: 'dungeonKey', tower: 'tower', worldBoss: 'worldBoss' };

function isDungeonUnlocked(type) {
  return isFeatureOpen(DUNGEON_FEATURES[type]);
}

/** 已解鎖的最高難度（1 起算；沒有難度的副本回傳 1） */
function getUnlockedDifficulty(type) {
  const diffs = CONFIG.dungeons[type].difficulties;
  if (!diffs) return 1;
  return Math.max(1, diffs.filter((d) => getBestStage() >= d.unlockStage).length);
}

function getDifficultyConfig(type, difficulty) {
  const diffs = CONFIG.dungeons[type].difficulties;
  return diffs ? diffs[difficulty - 1] : null;
}

/** 目前選擇的難度（不超過已解鎖） */
function getSelectedDifficulty(type) {
  const d = state.dungeons[type];
  return Math.min(Math.max(1, d.selected || 1), getUnlockedDifficulty(type));
}

function setSelectedDifficulty(type, difficulty) {
  if (difficulty >= 1 && difficulty <= getUnlockedDifficulty(type)) state.dungeons[type].selected = difficulty;
}

/** 今日剩餘次數（試煉之塔不限次數，回傳 Infinity） */
function getDungeonRemaining(type) {
  if (type === 'tower') return Infinity;
  return state.dungeons[type].remaining;
}

/**
 * 每日重置（本地時間 00:00）：恢復免費次數
 * @returns {boolean} 是否發生重置
 */
function checkDailyReset() {
  state.dungeons.gold.unlockedDifficulty = getUnlockedDifficulty('gold');
  const today = todayString();
  if (state.dungeons.lastResetDate === today) return false;
  state.dungeons.lastResetDate = today;
  for (const type of DUNGEON_TYPES) {
    if (type !== 'tower') {
      state.dungeons[type].remaining = CONFIG.dungeons.dailyFree;
      state.dungeons[type].bought = 0;
    }
  }
  ensureDailyFresh(); // 每日任務一起重置
  onGameEvent('dailyReset', {});
  return true;
}

/** 是否可以進入副本；不行時回傳原因文字 */
function getDungeonBlockReason(type) {
  if (dungeonRun.active) return '正在秘境中';
  if (!isDungeonUnlocked(type)) return `${getCondText(getFeature(DUNGEON_FEATURES[type]).cond)}後開放`;
  if (getDungeonRemaining(type) <= 0) return '今日次數已用完';
  return null;
}

// ---------- 購買次數 ----------

/** 今天還能用仙玉多買幾次（試煉之塔不限次數，回傳 0） */
function getDungeonBuysLeft(type) {
  if (type === 'tower') return 0;
  return Math.max(0, CONFIG.dungeons.maxBuysPerDay - (state.dungeons[type].bought || 0));
}

/**
 * 花仙玉多買一次挑戰次數
 * @returns {{ok: boolean, error?: string}}
 */
function buyDungeonAttempt(type) {
  checkDailyReset();
  if (!isDungeonUnlocked(type)) return { ok: false, error: '尚未開放' };
  if (getDungeonBuysLeft(type) <= 0) return { ok: false, error: '今天已經買過了' };
  const cost = CONFIG.dungeons.buyCost;
  if (state.upgradeStones < cost) return { ok: false, error: `仙玉不足（需要 ${cost}）` };
  state.upgradeStones -= cost;
  state.dungeons[type].bought = (state.dungeons[type].bought || 0) + 1;
  state.dungeons[type].remaining++;
  return { ok: true };
}

// ---------- 副本執行狀態（不存檔） ----------

const dungeonRun = {
  active: false,
  type: null,
  difficulty: 1,
  hero: null,
  battle: null,
  wave: 0, // 鑰匙副本：目前波數（1 起算）
  monsterIndex: 0, // 鑰匙副本：本波第幾隻（0 起算）
  floor: 0, // 試煉之塔：目前層數
  earned: { gold: 0, keys: 0, stones: 0, eggs: 0, iron: 0, items: 0 }, // 本次已獲得（已入帳；法寶進入待決定佇列）
  waitTimer: 0,
  nextAction: null,
};

function dungeonWaitThen(sec, action) {
  dungeonRun.waitTimer = sec;
  dungeonRun.nextAction = action;
}

/** 開始一場戰鬥（副本共用） */
function startDungeonBattle(enemy, opts = {}) {
  dungeonRun.battle = createBattle(dungeonRun.hero, enemy, {
    ...opts,
    onEvent: (ev) => onGameEvent('battle', ev),
  });
  onGameEvent('monsterSpawn', { enemy });
}

/** 依倍率放大怪物數值（hp / atk / def） */
function scaleStats(stats, mult) {
  return { ...stats, hp: stats.hp * mult, atk: stats.atk * mult, def: stats.def * mult };
}

/** 副本以「歷史最高關卡」作為強度基準 */
function getDungeonBaseStage() {
  return Math.max(1, getBestStage());
}

// ---------- 進入 / 離開 ----------

/**
 * 進入副本（會消耗一次每日次數）
 * @returns {boolean} 是否成功
 */
function startDungeon(type, difficulty = 1) {
  checkDailyReset();
  if (getDungeonBlockReason(type)) return false;
  if (difficulty > getUnlockedDifficulty(type)) return false;

  if (type !== 'tower') state.dungeons[type].remaining--;
  trackDaily('dungeon');
  if (DUNGEON_TASK_TRACKS[type]) trackDaily(DUNGEON_TASK_TRACKS[type]);
  trackStat('dungeonRuns');

  Object.assign(dungeonRun, {
    active: true,
    type,
    difficulty,
    hero: createHero(),
    battle: null,
    wave: 1,
    monsterIndex: 0,
    floor: state.dungeons.tower.highestFloor + 1,
    earned: { gold: 0, keys: 0, stones: 0, eggs: 0, iron: 0, items: 0 },
    waitTimer: 0,
    nextAction: null,
  });
  stageRun.paused = true; // 主線暫停

  onGameEvent('dungeonStart', { type, difficulty });
  if (type === 'gold') spawnGoldDummy();
  else if (type === 'key') spawnKeyMonster();
  else if (type === 'tower') spawnTowerFloor();
  else if (type === 'worldBoss') spawnWorldBoss();
  return true;
}

/** 玩家主動退出（已獲得的獎勵保留，金幣副本 / 世界 Boss 依目前傷害結算） */
function quitDungeon() {
  if (dungeonRun.active) endDungeon('quit');
}

/**
 * 結束副本並結算
 * @param {string} reason 'done' 時間到 / 'defeat' 戰敗 / 'complete' 全部完成 / 'quit' 主動退出
 */
function endDungeon(reason) {
  const run = dungeonRun;
  const cfg = CONFIG.dungeons[run.type];
  const result = {
    type: run.type,
    difficulty: run.difficulty,
    reason,
    damage: run.battle ? run.battle.totalDamage : 0,
    wave: run.wave,
    floor: run.floor,
    newBest: false,
    tiersReached: 0,
  };

  const rec = state.dungeons.records;
  if (run.type === 'gold') {
    const mult = getDifficultyConfig('gold', run.difficulty).mult;
    const gold = Math.round(result.damage * cfg.goldPerDamage * mult);
    state.gold += gold;
    run.earned.gold += gold;
    rec.gold[run.difficulty] = Math.max(rec.gold[run.difficulty] || 0, gold);
  } else if (run.type === 'worldBoss') {
    const reached = cfg.tiers.filter((t) => result.damage >= getWorldBossTierDamage(t)).length;
    grantWorldBossTiers(reached, run.earned);
    result.tiersReached = reached;
    rec.worldBoss = Math.max(rec.worldBoss || 0, reached);
    if (result.damage > state.dungeons.worldBoss.bestDamage) {
      state.dungeons.worldBoss.bestDamage = result.damage;
      result.newBest = true;
    }
  } else if (run.type === 'key') {
    const cleared = reason === 'complete' ? cfg.maxWaves : run.wave - 1;
    rec.key[run.difficulty] = Math.max(rec.key[run.difficulty] || 0, cleared);
  }

  result.earned = { ...run.earned };
  run.active = false;
  run.battle = null;
  run.nextAction = null;
  stageRun.paused = false; // 回到主線

  saveGame();
  onGameEvent('dungeonEnd', result);
}

// ---------- 掃蕩 ----------

/**
 * 發放上古妖王前 n 個傷害區間的獎勵（靈石隨目前進度成長）
 * @param {number} n
 * @param {{gold: number, keys: number, stones: number, iron: number}} earned 累加到這裡（顯示用）
 */
function grantWorldBossTiers(n, earned) {
  for (const t of CONFIG.dungeons.worldBoss.tiers.slice(0, n)) {
    const gold = getWorldBossTierGold(t);
    state.gold += gold;
    state.keys += t.keys;
    state.upgradeStones += t.stones;
    const iron = Math.round((t.iron || 0) * getAscIncomeMult()); // 聚寶
    state.materials.iron += iron;
    earned.gold += gold;
    earned.keys += t.keys;
    earned.stones += t.stones;
    earned.iron += iron;
  }
}

/**
 * 某個秘境、難度的掃蕩紀錄（沒有紀錄回傳 0）
 *   靈石秘境：最佳一次的靈石；妖獸潮：最多擊退的波數；上古妖王：最多達到的區間數（不分難度）
 */
function getSweepRecord(type, difficulty) {
  const rec = state.dungeons.records;
  if (type === 'gold') return rec.gold[difficulty] || 0;
  if (type === 'key') return rec.key[difficulty] || 0;
  if (type === 'worldBoss') return rec.worldBoss || 0;
  return 0;
}

/** 不能掃蕩的原因（可以時回傳 null） */
function getSweepBlockReason(type, difficulty = 1) {
  if (!CONFIG.dungeons.sweepEnabled || type === 'tower') return '這個秘境不能掃蕩';
  const block = getDungeonBlockReason(type);
  if (block) return block;
  if (difficulty > getUnlockedDifficulty(type)) return '尚未解鎖這個難度';
  if (getSweepRecord(type, difficulty) <= 0) return '先親自挑戰一次才能掃蕩';
  return null;
}

/**
 * 掃蕩：消耗一次次數，直接領取該難度最佳紀錄的獎勵
 *   靈石秘境：最佳一次的靈石；妖獸潮：擊退到最佳波數的爐火符，第 5、10 波照常判定靈獸蛋（含保底）；
 *   上古妖王：最佳區間數的獎勵（靈石隨目前進度）
 * @returns {null | {type: string, difficulty: number, reason: 'sweep', record: number, earned: Object}}
 */
function sweepDungeon(type, difficulty = 1) {
  checkDailyReset();
  if (getSweepBlockReason(type, difficulty)) return null;
  const cfg = CONFIG.dungeons[type];
  state.dungeons[type].remaining--;
  trackDaily('dungeon');
  trackDaily('sweep');
  if (DUNGEON_TASK_TRACKS[type]) trackDaily(DUNGEON_TASK_TRACKS[type]);
  trackStat('dungeonRuns');
  const record = getSweepRecord(type, difficulty);
  const earned = { gold: 0, keys: 0, stones: 0, eggs: 0, iron: 0, items: 0 };
  if (type === 'gold') {
    state.gold += record;
    earned.gold = record;
  } else if (type === 'key') {
    const perWave = scaleKeyIncome(cfg.keysPerWave * getDifficultyConfig('key', difficulty).keyMult);
    for (let w = 1; w <= record; w++) {
      state.keys += perWave;
      earned.keys += perWave;
      earned.eggs += rollKeyEgg(w);
    }
  } else if (type === 'worldBoss') {
    grantWorldBossTiers(record, earned);
  }
  return { type, difficulty, reason: 'sweep', record, earned };
}

// ---------- 每步更新 ----------

function updateDungeon(dt) {
  const run = dungeonRun;
  if (!run.active) return;

  if (run.nextAction) {
    run.waitTimer -= dt;
    if (run.waitTimer <= 0) {
      const action = run.nextAction;
      run.nextAction = null;
      action();
    }
    return;
  }
  if (!run.battle) return;

  const result = stepBattle(run.battle, dt);
  if (!result) return;
  const endDelay = CONFIG.dungeons.endDelaySec;

  switch (run.type) {
    case 'gold':
    case 'worldBoss':
      // 木樁 / 世界 Boss 不會死：時間到或主角倒下就結算
      dungeonWaitThen(endDelay, () => endDungeon(result === 'lose' ? 'defeat' : 'done'));
      break;
    case 'key':
      if (result === 'win') onKeyMonsterKilled();
      else dungeonWaitThen(endDelay, () => endDungeon('defeat'));
      break;
    case 'tower':
      if (result === 'win') onTowerFloorCleared();
      else dungeonWaitThen(endDelay, () => endDungeon('defeat'));
      break;
  }
}

// ---------- 金幣副本 ----------

function spawnGoldDummy() {
  const d = CONFIG.dungeons.goldDummy;
  const dummy = createFighter({ hp: 1, atk: 0, def: 0, spd: 0 }, { ...d, immortal: true });
  startDungeonBattle(dummy, { timeLimit: CONFIG.dungeons.gold.durationSec, immortalEnemy: true });
}

// ---------- 鑰匙副本 ----------

function spawnKeyMonster() {
  const cfg = CONFIG.dungeons.key;
  const diff = getDifficultyConfig('key', dungeonRun.difficulty);
  const base = getDungeonBaseStage();
  const mult = (1 + dungeonRun.wave * cfg.waveScale) * diff.statMult * cfg.baseStatMult;
  const info = getChapterMonsterInfo(splitTotalStage(base).chapter);
  const enemy = createFighter(scaleStats(getMonsterStats(base, false), mult), {
    name: info.name,
    emoji: info.emoji,
    color: info.color,
  });
  startDungeonBattle(enemy);
}

function onKeyMonsterKilled() {
  const cfg = CONFIG.dungeons.key;
  const run = dungeonRun;
  run.monsterIndex++;
  onGameEvent('monsterKilled', { gold: 0 });

  if (run.monsterIndex < cfg.monstersPerWave) {
    dungeonWaitThen(CONFIG.dungeons.nextDelaySec, spawnKeyMonster);
    return;
  }

  // 清完一波
  const keys = scaleKeyIncome(cfg.keysPerWave * getDifficultyConfig('key', run.difficulty).keyMult);
  state.keys += keys;
  run.earned.keys += keys;
  run.hero.hp = Math.min(run.hero.maxHp, run.hero.hp + Math.round(run.hero.maxHp * cfg.healBetweenWavesPct));
  // 第 5、10 波有機率掉落靈獸蛋（保底：沒掉時累積機率，見 rollKeyEgg）
  const eggs = rollKeyEgg(run.wave);
  if (eggs) run.earned.eggs += eggs;
  onGameEvent('waveCleared', { wave: run.wave, keys, eggs });

  if (run.wave >= cfg.maxWaves) {
    dungeonWaitThen(CONFIG.dungeons.endDelaySec, () => endDungeon('complete'));
    return;
  }
  run.wave++;
  run.monsterIndex = 0;
  dungeonWaitThen(CONFIG.dungeons.nextDelaySec, spawnKeyMonster);
}

/**
 * 妖獸潮第 5、10 波的靈獸蛋：機率 = 基本機率 + 保底累積；沒掉就累積 eggPityStep，掉了歸零
 * @param {number} wave 剛清完的波數
 * @returns {number} 掉落的蛋數
 */
function rollKeyEgg(wave) {
  const cfg = CONFIG.dungeons.key;
  const base = cfg.eggDrops[wave];
  if (!base) return 0;
  const k = state.dungeons.key;
  if (Math.random() < base + (k.eggPity || 0)) {
    k.eggPity = 0;
    state.beasts.eggs++;
    return 1;
  }
  k.eggPity = (k.eggPity || 0) + cfg.eggPityStep;
  return 0;
}

// ---------- 試煉之塔 ----------

/** 通過某層的升級石獎勵 */
function getTowerFloorStones(floor) {
  const cfg = CONFIG.dungeons.tower;
  let stones = 0;
  if (floor % 5 === 0) stones += cfg.stonesEvery5;
  if (floor % 10 === 0) stones += cfg.extraStonesEvery10;
  return stones;
}

/**
 * 每 10 層首次通過的大獎：靈獸蛋，加上隨機「仙玉」或「高品階法寶」（法寶會跳出比較視窗讓玩家決定）
 * @returns {{eggs, stones, item}}
 */
function grantTowerBigReward(earned = dungeonRun.earned) {
  const cfg = CONFIG.dungeons.tower.bigReward;
  const reward = { eggs: cfg.eggs, stones: 0, item: null };
  state.beasts.eggs += cfg.eggs;
  earned.eggs += cfg.eggs;
  if (Math.random() < cfg.itemChance) {
    const item = generateRandomItem(pickRandom(cfg.itemRarities), getEquipLevel());
    state.pendingItems.push(item);
    recordCodex([item]);
    earned.items++;
    reward.item = item;
  } else {
    state.upgradeStones += cfg.stones;
    earned.stones += cfg.stones;
    reward.stones = cfg.stones;
  }
  return reward;
}

/** 鎮妖塔第 floor 層的妖王（主線第 floor 關的 Boss 數值 × statMult；不套用天劫與 Boss 機制） */
function createTowerEnemy(floor) {
  const cfg = CONFIG.dungeons.tower;
  const info = getChapterMonsterInfo(splitTotalStage(floor).chapter);
  return createFighter(scaleStats(getMonsterStats(floor, true), cfg.statMult), {
    name: `第 ${floor} 層・${info.bossName}`,
    emoji: info.bossEmoji,
    color: info.color,
    isBoss: true,
  });
}

function spawnTowerFloor() {
  dungeonRun.hero.hp = dungeonRun.hero.maxHp; // 每層血量回滿
  startDungeonBattle(createTowerEnemy(dungeonRun.floor), { timeLimit: CONFIG.dungeons.tower.timeLimitSec });
}

/**
 * 通過某層：只有第一次通過才給獎勵（逐層挑戰與快速登塔共用）
 * @returns {{stones: number, big: null | {eggs: number, stones: number, item: Item | null}}}
 */
function grantTowerFloorReward(floor, earned) {
  let stones = 0;
  let big = null;
  if (floor > state.dungeons.tower.highestFloor) {
    state.dungeons.tower.highestFloor = floor;
    stones = getTowerFloorStones(floor);
    if (floor % 10 === 0) big = grantTowerBigReward(earned);
    state.upgradeStones += stones;
    earned.stones += stones;
  }
  return { stones, big };
}

function onTowerFloorCleared() {
  const run = dungeonRun;
  const floor = run.floor;
  onGameEvent('monsterKilled', { gold: 0 });
  const { stones, big } = grantTowerFloorReward(floor, run.earned);
  onGameEvent('floorCleared', { floor, stones, big });

  run.floor++;
  dungeonWaitThen(CONFIG.dungeons.nextDelaySec, spawnTowerFloor);
}

// ---------- 快速登塔與每日塔俸（D2，PLAN.md 2.27 第 3 段） ----------

/** 不能快速登塔的原因（可以時回傳 null） */
function getTowerQuickBlockReason() {
  return getDungeonBlockReason('tower');
}

/**
 * 快速登塔：從下一層開始連續挑戰、直接結算（不播戰鬥），打到輸或最多 quickMaxFloors 層。
 * 獎勵和逐層挑戰一樣（只有第一次通過才有）；算一次鎮妖塔挑戰。
 * @returns {null | {type: 'tower', reason: 'quick', from: number, cleared: number, lostAt: number | null, enemyLeft: number, earned: Object}}
 */
function quickClimbTower() {
  checkDailyReset();
  if (getTowerQuickBlockReason()) return null;
  const cfg = CONFIG.dungeons.tower;
  trackDaily('dungeon');
  trackDaily('tower');
  trackStat('dungeonRuns');
  const earned = { gold: 0, keys: 0, stones: 0, eggs: 0, iron: 0, items: 0 };
  const hero = createHero();
  const from = state.dungeons.tower.highestFloor + 1;
  const step = CONFIG.battle.tickSec;
  const maxSteps = Math.ceil(cfg.timeLimitSec / step) + 10;
  let lostAt = null;
  let enemyLeft = 0;
  let floor = from;
  for (let i = 0; i < cfg.quickMaxFloors; i++, floor++) {
    hero.hp = hero.maxHp; // 每層血量回滿（同逐層挑戰）
    const battle = createBattle(hero, createTowerEnemy(floor), { timeLimit: cfg.timeLimitSec });
    for (let g = 0; !battle.result && g < maxSteps; g++) stepBattle(battle, step);
    if (battle.result !== 'win') {
      lostAt = floor;
      enemyLeft = Math.max(0, battle.enemy.hp) / battle.enemy.maxHp;
      break;
    }
    grantTowerFloorReward(floor, earned);
  }
  return { type: 'tower', reason: 'quick', from, cleared: floor - from, lostAt, enemyLeft, earned };
}

/** 今天的塔俸（依歷史最高層；基準單位已由 scale.js 放大） */
function getTowerSweepReward(floor = state.dungeons.tower.highestFloor) {
  const c = CONFIG.dungeons.tower.sweep;
  return { stones: Math.floor(floor / c.stonesPer) * c.stones, iron: Math.floor(floor / c.ironPer) * c.iron };
}

/** 不能領塔俸的原因（可以時回傳 null） */
function getTowerSweepBlockReason() {
  if (!isDungeonUnlocked('tower')) return `${getCondText(getFeature(DUNGEON_FEATURES.tower).cond)}後開放`;
  const c = CONFIG.dungeons.tower.sweep;
  if (state.dungeons.tower.highestFloor < c.minFloor) return `通過第 ${c.minFloor} 層後才能領塔俸`;
  if (state.dungeons.tower.sweepDate === todayString()) return '今天的塔俸已經領過';
  return null;
}

function canClaimTowerSweep() {
  checkDailyReset();
  return !getTowerSweepBlockReason();
}

/**
 * 領每日塔俸（掃蕩）：每天一次，算一次鎮妖塔挑戰與掃蕩
 * @returns {null | {type: 'tower', reason: 'towerSweep', record: number, earned: Object}}
 */
function claimTowerSweep() {
  checkDailyReset();
  if (getTowerSweepBlockReason()) return null;
  const t = state.dungeons.tower;
  t.sweepDate = todayString();
  trackDaily('dungeon');
  trackDaily('sweep');
  trackDaily('tower');
  trackStat('dungeonRuns');
  const got = grantRewards(getTowerSweepReward(), 'towerSweep'); // 玄鐵吃聚寶加成（ascension.ironIncomeSources）
  return { type: 'tower', reason: 'towerSweep', record: t.highestFloor, earned: { gold: 0, keys: 0, stones: got.stones, eggs: 0, iron: got.iron, items: 0 } };
}

// ---------- 世界 Boss ----------

function spawnWorldBoss() {
  const cfg = CONFIG.dungeons.worldBoss;
  const base = getMonsterStats(getDungeonBaseStage(), true);
  const boss = createFighter(
    { ...base, hp: 1, atk: base.atk * cfg.atkMult, def: base.def * cfg.defMult, spd: cfg.spd },
    { name: cfg.bossName, emoji: cfg.bossEmoji, color: cfg.bossColor, isBoss: true, immortal: true }
  );
  startDungeonBattle(boss, { timeLimit: cfg.durationSec, immortalEnemy: true });
}

/** 世界 Boss 區間門檻：hpMult × 最高通關關卡的小怪 HP */
function getWorldBossTierDamage(tier) {
  return Math.round(tier.hpMult * getMonsterStats(getDungeonBaseStage(), false).hp);
}

/** 世界 Boss 區間金幣：隨進度成長 */
function getWorldBossTierGold(tier) {
  return Math.round(tier.gold * (1 + getDungeonBaseStage() * CONFIG.stageRewards.killGoldScale));
}

/** 世界 Boss：下一個傷害區間的門檻（沒有則回傳 null） */
function getNextWorldBossTier(damage) {
  const tier = CONFIG.dungeons.worldBoss.tiers.find((t) => damage < getWorldBossTierDamage(t));
  return tier ? getWorldBossTierDamage(tier) : null;
}
