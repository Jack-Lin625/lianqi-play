// @ts-check
/* =========================================================
 * progress.js — 累計數據、成就、七日簽到
 * ========================================================= */

/** 累計數據（成就用） */
function trackStat(key, n = 1) {
  if (!n) return;
  state.stats[key] = Number(state.stats[key] || 0) + n;
  const exp = CONFIG.pass.exp;
  if (key === 'opened') addPassExp(n * exp.perItemOpened);
  else if (key === 'kills') addPassExp(n * exp.perKill);
}

// ---------- 成就 ----------

/**
 * 成就條件目前的數值
 * @returns {number}
 */
function getAchievementValue(a) {
  if (a.type.startsWith('stat:')) return Number(state.stats[a.type.slice(5)] || 0);
  switch (a.type) {
    case 'highest':
      return getBestStage();
    case 'chest':
      return state.chestLevel;
    case 'tower':
      return state.dungeons.tower.highestFloor;
    case 'codex':
      return getCodexCount();
    case 'codexDivine':
      return getCodexDivineCount();
    case 'finalTier':
      return state.ascension.bestFinalTier;
    case 'beastsOwned':
      return Object.keys(state.beasts.owned).length;
    case 'beastsAwakened':
      return getAwakenedCount();
    case 'daoFinals':
      return ['finalSword', 'finalSpell', 'finalBody'].filter((k) => Number(state.stats[k] || 0) > 0).length;
    case 'enhanceMax':
      return Math.max(0, ...Object.values(state.enhance));
    case 'daoChosen':
      return state.dao.path ? 1 : 0;
    case 'daoTier':
      return state.dao.path ? state.dao.tier : 0;
  }
  return 0;
}

/** 成就說明（{tier} 天劫層數、{time} 戰鬥秒數、{above} 比之前最高天劫高幾重、{count} 一次開爐的神品件數） */
function getAchievementDesc(a) {
  const f = a.final || {};
  return a.desc
    .replace('{tier}', String(f.minTier !== undefined ? f.minTier : ''))
    .replace('{time}', String(f.minTime !== undefined ? f.minTime : ''))
    .replace('{above}', String(f.aboveBest !== undefined ? f.aboveBest : ''))
    .replace('{count}', String(a.open ? a.open.divines : ''));
}

/**
 * 打倒主線最終 Boss 的那一場：依挑戰型成就的條件（CONFIG.achievements 的 final）累計 stats；也記錄用哪條道途打倒過（三道歸一）
 * @param {{tier: number, flawless: boolean, lastStand: boolean, fury: number, beasts: number, time: number, dao: string | null, firstRun?: boolean, prevBest?: number}} info
 *   firstRun：這一輪第一次通過第 100 關；prevBest：這一場之前打倒最終 Boss 的最高天劫（沒有時 −1）
 */
function recordFinalBossWin(info) {
  const daoKey = { sword: 'finalSword', spell: 'finalSpell', body: 'finalBody' }[info.dao || ''];
  if (daoKey) trackStat(daoKey);
  for (const a of CONFIG.achievements) {
    const f = a.final;
    if (!f || !a.type.startsWith('stat:')) continue;
    if (info.tier < (f.minTier || 0)) continue;
    if (f.flawless && !info.flawless) continue;
    if (f.lastStand && !info.lastStand) continue;
    if (f.maxFury !== undefined && info.fury > f.maxFury) continue;
    if (f.noBeast && info.beasts > 0) continue;
    if (f.minTime && info.time < f.minTime) continue;
    if (f.firstRun && !info.firstRun) continue;
    if (f.aboveBest !== undefined && info.tier < (info.prevBest === undefined ? -1 : info.prevBest) + f.aboveBest) continue;
    trackStat(a.type.slice(5));
  }
}

/**
 * 檢查新達成的成就
 * @returns {Object[]} 這次新達成的成就
 */
function checkAchievements() {
  const newly = [];
  for (const a of CONFIG.achievements) {
    if (state.achievements.done.includes(a.id)) continue;
    if (getAchievementValue(a) >= a.target) {
      state.achievements.done.push(a.id);
      newly.push(a);
    }
  }
  return newly;
}

/** 領取成就獎勵 */
function claimAchievement(id) {
  const a = CONFIG.achievements.find((x) => x.id === id);
  if (!a || !isFeatureOpen('achieve') || !state.achievements.done.includes(id) || state.achievements.claimed.includes(id)) return null;
  state.achievements.claimed.push(id);
  return grantRewards(a.reward, 'achievement');
}

function countClaimableAchievements() {
  return state.achievements.done.filter((id) => !state.achievements.claimed.includes(id)).length;
}

// ---------- 月曆簽到（30 格，累計不歸零） ----------
// state.signin = { count: 累計簽到次數, lastDate: 上次簽到日期 }

function canSignIn() {
  return state.signin.lastDate !== todayString();
}

/** 今天會領到（已簽到時：今天領到）的是第幾格（1～30） */
function getSigninDay() {
  const n = CONFIG.signin.days.length;
  return canSignIn() ? (state.signin.count % n) + 1 : ((Math.max(1, state.signin.count) - 1) % n) + 1;
}

/** 某一格實際發放的獎勵：外觀已擁有時改發 ownedCosmeticBonus */
function getSigninReward(day) {
  const r = CONFIG.signin.days[day - 1];
  if (r.cosmetic && state.shop.cosmetics.owned.includes(r.cosmetic)) {
    const { cosmetic, ...rest } = r;
    return mergeRewards([rest, CONFIG.signin.ownedCosmeticBonus]);
  }
  return r;
}

/** 簽到 @returns {null | {day: number, reward: Reward, got: RewardGot}} */
function signIn() {
  if (!canSignIn() || !isFeatureOpen('signin')) return null;
  const day = (state.signin.count % CONFIG.signin.days.length) + 1;
  const reward = getSigninReward(day);
  state.signin.count++;
  state.signin.lastDate = todayString();
  trackStat('loginDays');
  return { day, reward, got: grantRewards(reward, 'signin') };
}
