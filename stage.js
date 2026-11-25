// @ts-check
/* =========================================================
 * stage.js — 主線關卡、掛機（離線）收益
 *
 * state.stage = { chapter, level, highest, autoAdvance }
 *   chapter / level：目前所在關卡
 *   highest：最高通關總關卡數
 *   autoAdvance：true = 通關後自動前進；false = 重複刷目前關卡
 *
 * 畫面相關的事情一律透過 onGameEvent(name, data)（ui.js）通知。
 * ========================================================= */

// ---------- 關卡編號工具 ----------

/** 總關卡數 = (章 - 1) × 10 + 關 */
function getTotalStage(chapter, level) {
  return (chapter - 1) * CONFIG.stage.levelsPerChapter + level;
}

/** 總關卡數 → { chapter, level } */
function splitTotalStage(total) {
  const per = CONFIG.stage.levelsPerChapter;
  const t = Math.max(1, total);
  return { chapter: Math.floor((t - 1) / per) + 1, level: ((t - 1) % per) + 1 };
}

/** 數字 → 中文數字（1～99），例如 7 → 七、12 → 十二、20 → 二十 */
function toCN(n) {
  const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n <= 0) return d[0];
  if (n < 10) return d[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return (tens > 1 ? d[tens] : '') + '十' + (ones ? d[ones] : '');
}

/** 境界名稱（第幾章） */
function getRealmName(chapter) {
  const list = CONFIG.realms;
  return list[Math.min(chapter, list.length) - 1];
}

/** 總關卡數 → 境界文字，例如 23 → 結丹期三層 */
function formatStage(total) {
  const { chapter, level } = splitTotalStage(total);
  return `${getRealmName(chapter)}${toCN(level)}層`;
}

function getMaxStage() {
  return CONFIG.stage.chapters * CONFIG.stage.levelsPerChapter;
}

function getCurrentTotal() {
  return getTotalStage(state.stage.chapter, state.stage.level);
}

/** 目前可挑戰的最前線關卡（最高通關 + 1，不超過最終關） */
function getFrontierStage() {
  return Math.min(state.stage.highest + 1, getMaxStage());
}

function isBossStage(total) {
  return splitTotalStage(total).level === CONFIG.stage.levelsPerChapter;
}

// ---------- 怪物 ----------

function getChapterMonsterInfo(chapter) {
  const list = CONFIG.chapterMonsters;
  return list[Math.min(chapter, list.length) - 1];
}

/** 某關卡的怪物數值 */
function getMonsterStats(total, isBoss) {
  const m = CONFIG.monster;
  const g = Math.pow(m.growth, total);
  const stats = {
    hp: m.hpBase * g,
    atk: m.atkBase * g,
    def: m.defBase * g,
    spd: m.spd,
    critRate: m.critRate,
    critDmg: m.critDmg,
    lifesteal: m.lifesteal,
    dodge: m.dodge,
  };
  if (isBoss) {
    const b = CONFIG.boss;
    stats.hp *= b.hpMult;
    stats.atk *= b.atkMult;
    stats.def *= b.defMult;
    stats.spd = b.spd;
  }
  return stats;
}

/** 主線某章 Boss 的機制（沒有機制回傳 null；見 CONFIG.bossMechanics） */
function getBossMechanic(chapter) {
  return CONFIG.bossMechanics[chapter - 1] || null;
}

/** 主線的怪物；Boss 掛上該章的機制（鎮妖塔、上古妖王不經過這裡，不套用機制） */
function createMonster(total, isBoss) {
  const chapter = splitTotalStage(total).chapter;
  const info = getChapterMonsterInfo(chapter);
  const mechanic = isBoss ? getBossMechanic(chapter) : null;
  const stats = getMonsterStats(total, isBoss);
  if (mechanic && mechanic.dodgeBonus) stats.dodge += mechanic.dodgeBonus; // 幻影（只對一般攻擊有效）
  if (mechanic && mechanic.defMult) stats.def *= mechanic.defMult; // 石膚
  if (isBoss && chapter >= CONFIG.boss.mainHpCompFromChapter) stats.hp *= CONFIG.boss.mainHpComp; // 主線 Boss 氣血補償（第 mainHpCompFromChapter 章起）
  // 飛升：天劫（這一輪主線妖獸氣血 × hpMult^層數、攻擊 × atkMult^層數）
  const trib = getTribulationMult();
  stats.hp *= trib.hp;
  stats.atk *= trib.atk;
  const fighter = createFighter(stats, {
    name: isBoss ? info.bossName : info.name,
    emoji: isBoss ? info.bossEmoji : info.emoji,
    color: info.color,
    isBoss,
    mechanic,
    dmgTakenMult: isBoss ? getAscBossDamageMult() : 1, // 誅魔（飛升天賦）：主角對主線 Boss 的傷害倍率（battle.js 的 getDmgTakenMult）
  });
  fighter.shieldPierce = getTribulationShieldPierce(); // v1.2：天劫穿透護體（battle.js 的護盾減傷）
  return fighter;
}

/** 每擊敗一隻小怪的金幣（含靈獸的靈石掉落加成） */
function getKillGold(total) {
  const r = CONFIG.stageRewards;
  const double = isDoubleActive() ? CONFIG.shop.doubleCardMult : 1; // 雙倍收益卡
  return Math.round(r.killGoldBase * (1 + total * r.killGoldScale) * (1 + getCurrentStats().goldPct) * double * getAscGoldMult()); // getAscGoldMult：聚寶
}

// ---------- 主線執行狀態（不存檔） ----------

const stageRun = {
  hero: null, // 主角戰鬥單位（同一關內血量延續）
  battle: null, // 目前這隻怪的戰鬥
  monsterIndex: 0, // 目前第幾隻（0 起算）
  monsterCount: 0, // 本關總共幾隻
  failCount: 0, // 連續失敗次數
  waitTimer: 0, // 等待下一個動作的倒數
  nextAction: null, // 倒數結束要執行的函式
  paused: false, // 副本進行中時暫停（第四階段使用）
};

function createHero() {
  const s = getCurrentStats();
  const hero = createFighter(s, { name: '修士', emoji: 'hero' });
  setFighterSkill(hero, withCdr(getDaoSkill(), s.cdr), false);
  setFighterPets(hero, getDeployedBeastAttacks().map((a) => withCdr(a, s.cdr)));
  hero.effects = getEquippedEffects();
  hero.talent = getDaoTalentEffect(); // 道途天賦（反彈、護體攻擊、會心回血、低血攻擊）
  hero.gearFx = getHeroFx(); // 強化里程碑 +12、靈獸羈絆的小特效
  hero.surviveChance = getAscSurviveChance(); // 護命（飛升天賦玄體）
  return hero;
}

/** 把目前裝備的數值套用到某個主角戰鬥單位（維持目前血量比例） */
function applyStatsToHero(hero) {
  if (!hero) return;
  const s = getCurrentStats();
  const ratio = hero.hp / hero.maxHp;
  Object.assign(hero, {
    atk: s.atk,
    def: s.def,
    spd: s.spd,
    critRate: s.critRate,
    critDmg: s.critDmg,
    lifesteal: s.lifesteal,
    dodge: s.dodge,
  });
  hero.maxHp = Math.max(1, Math.round(s.hp));
  if (hero.hp > 0) hero.hp = Math.max(1, Math.round(hero.maxHp * ratio));
  setFighterSkill(hero, withCdr(getDaoSkill(), s.cdr)); // 道途改變時換技能；同一技能保留冷卻進度
  setFighterPets(hero, getDeployedBeastAttacks().map((a) => withCdr(a, s.cdr))); // 上陣靈獸改變時更新
  hero.effects = getEquippedEffects(); // 仙品特效
  hero.talent = getDaoTalentEffect(); // 道途天賦
  hero.gearFx = getHeroFx(); // 強化里程碑 +12、靈獸羈絆的小特效
}

// ---------- Boss 戰意 ----------

/** 某個 Boss 關卡目前的戰意層數（不是那個 Boss 就是 0） */
function getBossFury(total = getCurrentTotal()) {
  const f = state.stage.fury;
  return isBossStage(total) && f.boss === total ? f.stacks : 0;
}

/** 戰意帶來的攻擊與氣血倍率 */
function getFuryMult(total = getCurrentTotal()) {
  return 1 + getBossFury(total) * CONFIG.boss.fury.perStack;
}

/** 主線主角套用戰意（只在挑戰該 Boss 時；維持目前血量比例） */
function applyBossFury(hero) {
  const mult = getFuryMult();
  if (!hero || mult === 1) return;
  const ratio = hero.hp / hero.maxHp;
  hero.atk *= mult;
  hero.maxHp = Math.max(1, Math.round(hero.maxHp * mult));
  if (hero.hp > 0) hero.hp = Math.max(1, Math.round(hero.maxHp * ratio));
}

/** 挑戰 Boss 失敗：該 Boss 的戰意 +1 層（換了別的 Boss 就重新計算） */
function addBossFury(total) {
  const f = state.stage.fury;
  if (f.boss !== total) {
    f.boss = total;
    f.stacks = 0;
  }
  f.stacks = Math.min(CONFIG.boss.fury.maxStacks, f.stacks + 1);
}

/** 裝備變動時，主線與副本中的主角都立即更新 */
function onEquipmentChanged() {
  applyStatsToHero(stageRun.hero);
  applyBossFury(stageRun.hero);
  if (typeof dungeonRun !== 'undefined' && dungeonRun.active) applyStatsToHero(dungeonRun.hero);
}

/** 開始目前關卡：主角血量回滿，從第一隻怪開始 */
function startStage() {
  const total = getCurrentTotal();
  stageRun.hero = createHero();
  applyBossFury(stageRun.hero);
  stageRun.monsterIndex = 0;
  stageRun.monsterCount = isBossStage(total) ? 1 : CONFIG.stage.monstersPerStage;
  stageRun.waitTimer = 0;
  stageRun.nextAction = null;
  spawnMonster();
  onGameEvent('stageStart', { total });
}

function spawnMonster() {
  const total = getCurrentTotal();
  const boss = isBossStage(total);
  stageRun.battle = createBattle(stageRun.hero, createMonster(total, boss), {
    timeLimit: boss ? CONFIG.boss.timeLimitSec : 0,
    onEvent: (ev) => onGameEvent('battle', ev),
  });
  onGameEvent('monsterSpawn', { enemy: stageRun.battle.enemy });
}

/** 等待一段時間後執行動作（戰鬥結束後的停頓） */
function waitThen(sec, action) {
  stageRun.waitTimer = sec;
  stageRun.nextAction = action;
}

/** 移動到指定關卡（不檢查是否解鎖） */
function setCurrentStage(total) {
  const { chapter, level } = splitTotalStage(total);
  state.stage.chapter = chapter;
  state.stage.level = level;
}

// ---------- 每步更新 ----------

/** 主線每個邏輯步長呼叫一次 */
function updateStage(dt) {
  if (stageRun.paused || !stageRun.battle) return;
  updateIncomeTracker(dt);

  if (stageRun.nextAction) {
    stageRun.waitTimer -= dt;
    if (stageRun.waitTimer <= 0) {
      const action = stageRun.nextAction;
      stageRun.nextAction = null;
      action();
    }
    return;
  }

  const result = stepBattle(stageRun.battle, dt);
  if (result === 'win') onMonsterKilled();
  else if (result === 'lose' || result === 'timeout') onStageFailed(result);
}

// ---------- 爐火符收入 ----------

/** 爐火符收入倍率：隨本輪最高通關關卡成長（CONFIG.stageRewards.keyGrowthPerStage），再乘飛升天賦「聚寶」 */
function getKeyIncomeMult() {
  return (1 + state.stage.highest * CONFIG.stageRewards.keyGrowthPerStage) * getAscIncomeMult();
}

/** 套用收入倍率後的爐火符數量（取整數） */
function scaleKeyIncome(base) {
  return Math.round(base * getKeyIncomeMult());
}

// ---------- 戰鬥結果處理 ----------

function onMonsterKilled() {
  const total = getCurrentTotal();
  const boss = isBossStage(total);

  if (!boss) {
    const gold = getKillGold(total);
    state.gold += gold;
    trackStageIncome(gold, 0);
    onGameEvent('monsterKilled', { gold });
  } else {
    onGameEvent('monsterKilled', { gold: 0 });
  }
  trackDaily('kill');
  trackStat('kills');
  if (boss) trackStat('bossKills');

  stageRun.monsterIndex++;
  if (stageRun.monsterIndex < stageRun.monsterCount) {
    waitThen(CONFIG.battle.monsterDelaySec, spawnMonster);
  } else {
    onStageCleared();
  }
}

function onStageCleared() {
  const total = getCurrentTotal();
  const r = CONFIG.stageRewards;
  const reward = { keys: 0, gold: 0, stones: 0 };
  let firstBoss = false;

  if (isBossStage(total)) {
    if (!state.bossFirstClears.includes(total)) {
      firstBoss = true;
      state.bossFirstClears.push(total);
      reward.keys = scaleKeyIncome(r.bossFirstKeys);
      reward.stones = r.bossFirstStones;
      reward.gold = r.bossFirstGoldPerChapter * splitTotalStage(total).chapter;
    } else {
      reward.keys = scaleKeyIncome(r.bossRepeatKeys);
    }
  } else {
    reward.keys = scaleKeyIncome(randInt(r.clearKeysMin, r.clearKeysMax));
  }

  state.keys += reward.keys;
  state.gold += reward.gold;
  state.upgradeStones += reward.stones;
  if (!firstBoss) trackStageIncome(reward.gold, reward.keys); // 一次性獎勵不列入在線收益

  // 章節首殺獎勵：直接發放（舊存檔已通過的章節在 v9 遷移時寄到信箱）；用 chapterRewards 旗標避免重複
  let chapterReward = null;
  if (firstBoss) chapterReward = grantChapterReward(splitTotalStage(total).chapter);

  const firstClear = total > state.stage.highest;
  if (firstClear) state.stage.highest = total;
  // 挑戰型成就（D3）：打倒最終 Boss 的這一場（戰意歸零之前讀層數）
  if (total === getMaxStage()) {
    const bt = stageRun.battle;
    recordFinalBossWin({
      tier: state.ascension.tier,
      flawless: !!bt && bt.hero.lastHit === '',
      lastStand: !!bt && bt.surviveUsed,
      fury: state.stage.fury.boss === total ? state.stage.fury.stacks : 0,
      beasts: bt ? (bt.hero.pets || []).length : state.beasts.deployed.filter(Boolean).length,
      time: bt ? bt.time : 0,
      dao: state.dao.path,
      firstRun: firstClear, // 這一輪第一次通過第 100 關（首戰告捷）
      prevBest: state.ascension.bestFinalTier, // onAscStageCleared 之前讀：之前打倒最終 Boss 的最高天劫
    });
  }
  const tierRewards = onAscStageCleared(total); // 飛升：記錄在這一層天劫通過第 90 關；打倒最終 Boss 時發放天劫里程碑
  if (isBossStage(total) && state.stage.fury.boss === total) state.stage.fury = { boss: 0, stacks: 0 }; // 擊敗 Boss：戰意歸零
  stageRun.failCount = 0;

  const battleTime = stageRun.battle ? stageRun.battle.time : 0;
  const thunderHits = stageRun.battle ? stageRun.battle.mech.thunderHits : [];
  const mechCount = stageRun.battle ? stageRun.battle.mech.count : 0;
  if (isBossStage(total)) trackDaily('bossTry');
  onGameEvent('stageCleared', { total, reward, firstBoss, firstClear, chapterReward, tierRewards, battleTime, thunderHits, mechCount });

  // 自動推進：前往下一關（已是最終關則重複刷）
  if (state.stage.autoAdvance && total < getMaxStage()) {
    setCurrentStage(total + 1);
  }
  waitThen(CONFIG.battle.clearDelaySec, startStage);
}

/**
 * 發放章節首殺獎勵（每章只發一次）
 * @returns {{chapter: number, got: RewardGot}|null}
 */
function grantChapterReward(chapter) {
  const reward = CONFIG.chapterRewards[chapter - 1];
  if (!reward || state.stage.chapterRewards.includes(chapter)) return null;
  state.stage.chapterRewards.push(chapter);
  return { chapter, got: grantRewards(reward, 'chapter') };
}

/**
 * 輸給主線 Boss 的死因與建議
 * @param {string} reason 'lose' | 'timeout'
 * @param {string} lastHit 主角最後一次受傷的來源
 * @param {boolean} [enraged] Boss 是否已經狂暴（被狂暴後的一般攻擊擊敗時，死因改成狂暴）
 */
function getBossDeathInfo(total, reason, lastHit, enraged) {
  const chapter = splitTotalStage(total).chapter;
  const mech = getBossMechanic(chapter);
  const boss = getChapterMonsterInfo(chapter).bossName;
  let key = reason === 'timeout' ? 'timeout' : lastHit || 'attack';
  if (key === 'attack' && enraged) key = 'enrage';
  const cause = (CONFIG.bossDeathCauses[key] || CONFIG.bossDeathCauses.attack).replace('{boss}', boss);
  return { cause, advice: mech ? mech.advice : CONFIG.bossDefaultAdvice, mechanic: mech ? mech.id : '' };
}

function onStageFailed(reason) {
  const total = getCurrentTotal();
  stageRun.failCount++;
  if (isBossStage(total)) addBossFury(total);

  let retreated = false;
  if (stageRun.failCount >= CONFIG.stage.retreatAfterFails && total > 1) {
    // 連續失敗：退回前一關持續刷，等玩家手動按「挑戰」
    setCurrentStage(total - 1);
    state.stage.autoAdvance = false;
    stageRun.failCount = 0;
    retreated = true;
  }

  if (isBossStage(total)) trackDaily('bossTry');
  const battle = stageRun.battle;
  const death = isBossStage(total) && battle ? getBossDeathInfo(total, reason, battle.hero.lastHit, battle.mech.enraged) : null;
  onGameEvent('stageFailed', {
    total,
    reason,
    retreated,
    failCount: stageRun.failCount,
    fury: getBossFury(total),
    death,
    battleTime: battle ? battle.time : 0,
    thunderHits: battle ? battle.mech.thunderHits : [],
    mechCount: battle ? battle.mech.count : 0,
  });
  waitThen(CONFIG.battle.defeatDelaySec, startStage);
}

// ---------- 玩家操作 ----------

/** 「挑戰」：回到最前線關卡並開啟自動推進 */
function challengeFrontier() {
  state.stage.autoAdvance = true;
  stageRun.failCount = 0;
  setCurrentStage(getFrontierStage());
  startStage();
}

/**
 * 選擇關卡：
 * 選最前線 → 自動推進；選已通關的關卡 → 重複刷該關
 */
function selectStage(total) {
  if (total < 1 || total > getFrontierStage()) return false;
  state.stage.autoAdvance = total === getFrontierStage();
  stageRun.failCount = 0;
  setCurrentStage(total);
  startStage();
  return true;
}

/** 讀檔後初始化主線 */
function initStage() {
  // 防呆：目前關卡不能超過最前線
  if (getCurrentTotal() > getFrontierStage()) setCurrentStage(getFrontierStage());
  startStage();
}

// ---------- 在線收益記錄（離線收益的計算基準） ----------

const incomeWindow = { sec: 0, gold: 0, keys: 0 };

/** 記錄主線收益（擊殺金幣、通關鑰匙） */
function trackStageIncome(gold, keys) {
  incomeWindow.gold += gold;
  incomeWindow.keys += keys;
}

/** 每累積 60 秒主線時間，把這段收益併入移動平均 */
function updateIncomeTracker(dt) {
  incomeWindow.sec += dt;
  if (incomeWindow.sec < 60) return;
  const perMin = 60 / incomeWindow.sec;
  const gold = incomeWindow.gold * perMin;
  const keys = incomeWindow.keys * perMin;
  const r = state.onlineRate;
  const a = CONFIG.offline.rateSmoothing;
  if (r.samples === 0) {
    r.gold = gold;
    r.keys = keys;
  } else {
    r.gold = r.gold * (1 - a) + gold * a;
    r.keys = r.keys * (1 - a) + keys * a;
  }
  r.samples++;
  incomeWindow.sec = 0;
  incomeWindow.gold = 0;
  incomeWindow.keys = 0;
}

// ---------- 掛機（離線）收益 ----------

/**
 * 目前關卡每分鐘平均靈石產出
 *   有足夠的在線紀錄：用實際記錄的主線靈石收益（移動平均）
 *   紀錄不足：用「小怪靈石 × 每分鐘擊殺數」估算
 * @returns {{gold: number, basis: 'online'|'estimate'}}
 */
function getStageGoldPerMinute() {
  const cfg = CONFIG.offline;
  const r = state.onlineRate;
  if (r.samples >= cfg.minSamples && r.gold > 0) return { gold: r.gold, basis: 'online' };
  return { gold: getKillGold(getCurrentTotal()) * cfg.estKillsPerMinute, basis: 'estimate' };
}

/**
 * 依離線分鐘數計算收益（不入帳）
 * 每分鐘靈石 = 平均產出 × goldRatio；爐火符每 minutesPerKey 分鐘 keysPerInterval 張；最多 getOfflineMaxHours() 小時（洞府天賦會加）
 */
function calcOfflineReward(minutes) {
  const cfg = CONFIG.offline;
  const m = Math.floor(Math.max(0, Math.min(minutes, getOfflineMaxHours() * 60)));
  const rate = getStageGoldPerMinute();
  return {
    minutes: m,
    gold: Math.round(rate.gold * cfg.goldRatio * m * (isDoubleActive() ? CONFIG.shop.doubleCardMult : 1)),
    keys: scaleKeyIncome(Math.floor(m / cfg.minutesPerKey) * cfg.keysPerInterval),
    basis: rate.basis,
  };
}

/**
 * 累積離線收益到「待領取」（重複累積時總時數仍以上限為準）
 * @param {number} minutes 離線分鐘數
 * @returns {boolean} 是否有新的待領取收益
 */
function addOfflineTime(minutes) {
  if (minutes < CONFIG.offline.minMinutes) return false;
  const prev = state.offlineReward && !state.offlineReward.anomaly ? state.offlineReward.minutes : 0;
  state.offlineReward = calcOfflineReward(prev + minutes);
  return true;
}

/**
 * 讀檔時：用裝置時間與最後上線時間計算離線時長
 * 裝置時間比最後上線時間還早（時間倒退，例如手動調時間）→ 本次收益為 0
 */
function checkOfflineOnLoad(now = Date.now()) {
  const last = state.lastOnline || now;
  if (now < last - CONFIG.offline.rollbackToleranceMs) {
    // 已累積但還沒領的收益保留；這次不再增加
    if (!state.offlineReward) state.offlineReward = { minutes: 0, gold: 0, keys: 0, anomaly: true };
  } else {
    addOfflineTime((now - last) / 60000);
  }
  state.lastOnline = now;
}

/**
 * 領取離線收益
 * @param {boolean} double 雙倍領取（倍率見 CONFIG.offline.doubleMult；doubleCost 為 0 時免費）
 * @returns {null | {gold, keys, double}} 實際領到的資源；仙玉不足時回傳 null
 */
function claimOfflineReward(double = false) {
  const r = state.offlineReward;
  if (!r) return null;
  const cost = CONFIG.offline.doubleCost;
  if (double) {
    if (r.anomaly || (r.gold === 0 && r.keys === 0) || state.upgradeStones < cost) return null;
    state.upgradeStones -= cost;
  }
  const m = double ? CONFIG.offline.doubleMult : { gold: 1, keys: 1 };
  const gold = r.gold * m.gold;
  const keys = r.keys * m.keys;
  state.gold += gold;
  state.keys += keys;
  state.offlineReward = null;
  return { gold, keys, double };
}
