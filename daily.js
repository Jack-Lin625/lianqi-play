// @ts-check
/* =========================================================
 * daily.js — 每日任務池、每週任務（戰令任務）、活躍度寶箱（6-5）
 *
 * state.daily  = { date, tasks: 抽到的任務 id（null = 還沒抽）, progress: { 計數器: 數量 }, claimed: [任務 id], chests: [寶箱索引] }
 * state.weekly = { week: 這週第一天的日期, drawn, alt: [改用替代任務的 id], progress, claimed, chests, activity }
 * state.autoClaim = { pending: [{ title, reward }]（還沒發放，例如存檔遷移）, notices: [{ title, got }]（已發放、等著跳提示） }
 *
 * - 每天 00:00 換題；每週 CONFIG.activity.weekStartDay 00:00 重置每週任務與每週活躍度。
 * - 只抽「已開放、而且目前做得到」的任務；每日任務本身還沒開放時，等開放的那一刻才抽。
 * - 進度計數器不管有沒有抽到、功能有沒有開放都會累積（功能鎖住期間進度照常累積）。
 * - 重置時「已完成但沒領」的任務與寶箱自動發放，下次打開畫面時跳提示（state.autoClaim.notices）。
 * 任務與獎勵定義在 CONFIG.dailyTaskPool、dailyTaskRules、weeklyTasks、weeklyTaskRules、activity。
 * ========================================================= */

/** 一個計數器同時累積到哪些合併計數器（每週任務用） */
const TRACK_ALIASES = {
  tower: ['towerOrBoss'],
  worldBoss: ['towerOrBoss'],
  enhance: ['growth'],
  reroll: ['growth'],
  starUp: ['growth'],
};

/** 抽題時「目前做得到」的條件（CONFIG.dailyTaskPool 的 need） */
const DAILY_NEEDS = {
  chestNotMax: () => state.chestLevel < getChestMaxLevel(),
  hasSweep: () => ['gold', 'key', 'worldBoss'].some((t) => isDungeonUnlocked(t) && getSweepRecord(t, getUnlockedDifficulty(t)) > 0),
  hasEgg: () => state.beasts.eggs > 0,
  beastNotMax: () => Object.keys(state.beasts.owned).some((k) => !!getStarUpCost(k)),
  enhanceNotMax: () => CONFIG.slotOrder.some((s) => !!getEnhanceCost(s)),
  canReroll: () => CONFIG.slotOrder.some((s) => getRerollCost(state.equipped[s]) > 0),
};

function emptyDaily(date) {
  return { date, tasks: null, progress: {}, claimed: [], chests: [] };
}

function emptyWeekly(week) {
  return { week, drawn: false, alt: [], progress: {}, claimed: [], chests: [], activity: 0 };
}

/** 某天所屬那一週的第一天（'YYYY-MM-DD'） */
function weekStartOf(date) {
  const d = parseLocalDate(date);
  const back = (d.getDay() - CONFIG.activity.weekStartDay + 7) % 7;
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
  const pad = (n) => String(n).padStart(2, '0');
  return `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
}

/** 'YYYY-MM-DD' → 'M/D' */
function shortDate(date) {
  const [, m, d] = String(date).split('-').map(Number);
  return m && d ? `${m}/${d}` : String(date);
}

// ---------- 任務定義 ----------

/** @returns {any} */
function getDailyTaskDef(id) {
  return CONFIG.dailyTaskPool.find((t) => t.id === id) || null;
}

/** 任務說明（{target} 換成目標數量） */
function getTaskDesc(t) {
  return String(t.desc).replace('{target}', fmtNum(t.target));
}

/** 這個任務現在抽不抽得到（已開放而且做得到） */
function isDailyTaskAvailable(t) {
  if (t.feature && !isFeatureOpen(t.feature)) return false;
  if (t.cond && !isCondMet(t.cond)) return false;
  if (t.need && !DAILY_NEEDS[t.need]()) return false;
  return true;
}

/** 抽今天的任務 */
function drawDailyTasks() {
  const r = CONFIG.dailyTaskRules;
  const avail = CONFIG.dailyTaskPool.filter(isDailyTaskAvailable);
  const n = avail.length >= r.manyThreshold ? r.many : r.few;
  // 洗牌（Fisher–Yates）後依序挑，同組超過上限的跳過
  const pool = avail.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = [];
  const groups = {};
  for (const t of pool) {
    if (picked.length >= n) break;
    if (t.group && (groups[t.group] || 0) >= (r.groupMax[t.group] ?? Infinity)) continue;
    if (t.group) groups[t.group] = (groups[t.group] || 0) + 1;
    picked.push(t.id);
  }
  // 顯示順序照任務池
  state.daily.tasks = CONFIG.dailyTaskPool.filter((t) => picked.includes(t.id)).map((t) => t.id);
}

/** 決定這週的每週任務：功能都沒開放的改用替代任務 */
function drawWeeklyTasks() {
  state.weekly.alt = CONFIG.weeklyTasks.filter((t) => t.alt && t.features && !t.features.some((f) => isFeatureOpen(f))).map((t) => t.id);
  state.weekly.drawn = true;
}

/** 今天的任務（定義） */
function getTodayTasks() {
  return (state.daily.tasks || []).map(getDailyTaskDef).filter(Boolean);
}

/** 這週的每週任務（套用替代任務） */
function getWeeklyTaskList() {
  return CONFIG.weeklyTasks.map((t) => (state.weekly.alt.includes(t.id) && t.alt ? { ...t, ...t.alt, id: t.id, isAlt: true } : t));
}

// ---------- 重置 ----------

/**
 * 日期換了就換題（先把昨天已完成但沒領的自動發放）；每日任務開放後抽題
 * @returns {boolean} 是否換日
 */
function ensureDailyFresh() {
  const today = todayString();
  let changed = false;
  if (state.daily.date !== today) {
    autoClaimDaily();
    ensureWeeklyFresh(today);
    state.daily = emptyDaily(today);
    changed = true;
  } else ensureWeeklyFresh(today);
  flushAutoClaimPending();
  if (isFeatureOpen('daily')) {
    if (!state.daily.tasks) drawDailyTasks();
    if (!state.weekly.drawn) drawWeeklyTasks();
  }
  return changed;
}

function ensureWeeklyFresh(today = todayString()) {
  const week = weekStartOf(today);
  if (state.weekly.week === week) return false;
  autoClaimWeekly();
  state.weekly = emptyWeekly(week);
  return true;
}

/** 存檔遷移留下、還沒發放的獎勵 */
function flushAutoClaimPending() {
  const a = state.autoClaim;
  while (a.pending.length) {
    const p = a.pending.shift();
    a.notices.push({ title: p.title, got: grantRewards(p.reward, 'autoClaim') });
  }
}

/** 換日：昨天已完成但沒領的每日任務與活躍度寶箱自動發放 */
function autoClaimDaily() {
  const d = state.daily;
  if (!d.tasks || !d.date) return;
  const rewards = [];
  for (const t of getTodayTasks()) if (isDailyClaimable(t)) rewards.push(markDailyClaimed(t));
  CONFIG.activity.daily.forEach((c, i) => {
    if (isActivityChestClaimable('daily', i)) rewards.push(markChestClaimed('daily', i));
  });
  if (rewards.length) state.autoClaim.notices.push({ title: `${shortDate(d.date)} 每日任務`, got: grantRewards(mergeRewards(rewards), 'autoClaim') });
}

/** 換週：上週已完成但沒領的每週任務與每週寶箱自動發放 */
function autoClaimWeekly() {
  const w = state.weekly;
  if (!w.week) return;
  const rewards = [];
  for (const t of getWeeklyTaskList()) if (isWeeklyClaimable(t)) rewards.push(markWeeklyClaimed(t));
  CONFIG.activity.weekly.forEach((c, i) => {
    if (isActivityChestClaimable('weekly', i)) rewards.push(markChestClaimed('weekly', i));
  });
  if (rewards.length) state.autoClaim.notices.push({ title: `${shortDate(w.week)} 那週的每週任務`, got: grantRewards(mergeRewards(rewards), 'autoClaim') });
}

/** 取出等著跳提示的自動發放紀錄（取出後清空） */
function takeAutoClaimNotices() {
  const list = state.autoClaim.notices;
  state.autoClaim.notices = [];
  return list;
}

// ---------- 進度 ----------

/** 累積進度（例如 trackDaily('kill', 1)）；每日與每週一起累積 */
function trackDaily(track, amount = 1) {
  ensureDailyFresh();
  const before = {};
  for (const t of getTodayTasks()) before[t.id] = getDailyProgress(t);
  for (const key of [track, ...(TRACK_ALIASES[track] || [])]) {
    state.daily.progress[key] = (state.daily.progress[key] || 0) + amount;
    state.weekly.progress[key] = (state.weekly.progress[key] || 0) + amount;
  }
  for (const t of getTodayTasks()) {
    if (before[t.id] < t.target && getDailyProgress(t) >= t.target && !state.daily.claimed.includes(t.id)) onGameEvent('dailyDone', { task: t });
  }
}

function getDailyProgress(task) {
  return Math.min(task.target, state.daily.progress[task.track] || 0);
}

function getWeeklyProgress(task) {
  return Math.min(task.target, state.weekly.progress[task.track] || 0);
}

function isDailyClaimable(task) {
  return (state.daily.tasks || []).includes(task.id) && getDailyProgress(task) >= task.target && !state.daily.claimed.includes(task.id);
}

function isWeeklyClaimable(task) {
  return state.weekly.drawn && getWeeklyProgress(task) >= task.target && !state.weekly.claimed.includes(task.id);
}

/** 每個每日任務的活躍度（= 總活躍度 ÷ 當天任務數） */
function getActivityPerTask() {
  const n = (state.daily.tasks || []).length;
  return n ? CONFIG.dailyTaskRules.activityTotal / n : 0;
}

/** 今天的活躍度 */
function getDailyActivity() {
  return Math.round(state.daily.claimed.length * getActivityPerTask());
}

function getWeeklyActivity() {
  return Math.round(state.weekly.activity);
}

function isActivityChestClaimable(kind, i) {
  const c = CONFIG.activity[kind][i];
  const s = kind === 'daily' ? state.daily : state.weekly;
  const act = kind === 'daily' ? getDailyActivity() : getWeeklyActivity();
  return !!c && act >= c.need && !s.chests.includes(i);
}

// ---------- 領取（mark* 只記帳，不發放；呼叫端負責 grantRewards） ----------

function markDailyClaimed(t) {
  state.daily.claimed.push(t.id);
  state.weekly.activity += getActivityPerTask();
  for (const key of ['dailyTask']) state.weekly.progress[key] = (state.weekly.progress[key] || 0) + 1;
  addPassExp(CONFIG.pass.exp.perDailyTask);
  return CONFIG.dailyTaskRules.reward;
}

function markWeeklyClaimed(t) {
  state.weekly.claimed.push(t.id);
  addPassExp(CONFIG.pass.exp.perWeeklyTask);
  return CONFIG.weeklyTaskRules.reward;
}

function markChestClaimed(kind, i) {
  (kind === 'daily' ? state.daily : state.weekly).chests.push(i);
  return CONFIG.activity[kind][i].reward;
}

/**
 * 領取每日任務
 * @returns {null | RewardGot} 實際發放的內容（任務未完成、已領或每日任務尚未開放時為 null）
 */
function claimDaily(id) {
  ensureDailyFresh();
  const task = getDailyTaskDef(id);
  if (!task || !isFeatureOpen('daily') || !isDailyClaimable(task)) return null;
  return grantRewards(markDailyClaimed(task), 'daily');
}

/** 領取每週任務 @returns {null | RewardGot} */
function claimWeekly(id) {
  ensureDailyFresh();
  const task = getWeeklyTaskList().find((t) => t.id === id);
  if (!task || !isFeatureOpen('daily') || !isWeeklyClaimable(task)) return null;
  return grantRewards(markWeeklyClaimed(task), 'weekly');
}

/** 開活躍度寶箱 @param {'daily'|'weekly'} kind @returns {null | RewardGot} */
function claimActivityChest(kind, i) {
  ensureDailyFresh();
  if (!isFeatureOpen('daily') || !isActivityChestClaimable(kind, i)) return null;
  return grantRewards(markChestClaimed(kind, i), 'activity');
}

/**
 * 一鍵領取：每日任務 → 每日寶箱 → 每週任務 → 每週寶箱（任務先領，活躍度才夠開寶箱）
 * @returns {RewardGot[]}
 */
function claimAllDaily() {
  ensureDailyFresh();
  if (!isFeatureOpen('daily')) return [];
  const list = [];
  for (const t of getTodayTasks()) list.push(claimDaily(t.id));
  CONFIG.activity.daily.forEach((c, i) => list.push(claimActivityChest('daily', i)));
  for (const t of getWeeklyTaskList()) list.push(claimWeekly(t.id));
  CONFIG.activity.weekly.forEach((c, i) => list.push(claimActivityChest('weekly', i)));
  return list.filter(Boolean);
}

/** 可領取的任務與寶箱數（分頁提示點用） */
function countClaimableDaily() {
  ensureDailyFresh();
  let n = getTodayTasks().filter(isDailyClaimable).length + getWeeklyTaskList().filter(isWeeklyClaimable).length;
  for (const kind of ['daily', 'weekly']) CONFIG.activity[kind].forEach((c, i) => (n += isActivityChestClaimable(kind, i) ? 1 : 0));
  return n;
}
