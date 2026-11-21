// @ts-check
/* =========================================================
 * features.js — 功能開放表（CONFIG.features）與開爐件數檔位（CONFIG.chestTiers）
 *
 * state.features = { open: { 功能 id: 開放時的累計在線分鐘 }, tiersSeen: [已提示過的件數], playSeconds: 累計在線秒數 }
 * - 條件達成時開放並記錄；開放後不會再鎖回去（開爐檔位除外：月卡到期後，提早解鎖的檔位要等免費條件）
 * - 新開放的功能放進 featureUnlockQueue，由畫面播放演出、顯示已累積的進度與引導
 * - 鎖住期間，戰令經驗、成就、圖鑑、每日任務進度照常累積（各系統本來就在背後計算），開放時一次領取
 * ========================================================= */

/**
 * 待播放的開放演出（不存檔）
 * @type {{id: string, kind: string}[]}
 */
const featureUnlockQueue = [];

/** @returns {any} 功能定義 */
function getFeature(id) {
  return CONFIG.features.find((f) => f.id === id);
}

/** 累計在線分鐘 */
function getPlayMinutes() {
  return Math.floor((state.features.playSeconds || 0) / 60);
}

/** 累計在線時間（主迴圈每一步呼叫；閉關時間不算） */
function addPlayTime(sec) {
  state.features.playSeconds = (state.features.playSeconds || 0) + sec;
  trackDaily('online', sec / 60); // 每日任務「在線修煉 N 分鐘」
}

/**
 * 條件是否全部滿足（null = 沒有條件）
 * @param {{stage?: number, chest?: number, day?: number, playMinutes?: number, ascensions?: number}|null} cond
 * @param {any} [s] 要檢查的存檔（預設為目前的 state；存檔遷移時傳入舊資料）
 */
function isCondMet(cond, s = state) {
  if (!cond) return true;
  const highest = getBestStage(s); // 歷史最高關卡（飛升後重爬不會讓功能重新上鎖）
  const days = (s.welfare && s.welfare.loginDays) || 0;
  const minutes = Math.floor(((s.features && s.features.playSeconds) || 0) / 60);
  if (cond.stage !== undefined && highest < cond.stage) return false;
  if (cond.chest !== undefined && (s.chestLevel || 1) < cond.chest) return false;
  if (cond.day !== undefined && days < cond.day) return false;
  if (cond.playMinutes !== undefined && minutes < cond.playMinutes) return false;
  if (cond.ascensions !== undefined && ((s.ascension && s.ascension.count) || 0) < cond.ascensions) return false;
  return true;
}

/** 條件的說明文字（例如「通關 煉氣期五層」「煉器爐 10 階」） */
function getCondText(cond) {
  if (!cond) return '一開始就開放';
  const parts = [];
  if (cond.stage !== undefined) parts.push(`通關 ${formatStage(cond.stage)}`);
  if (cond.chest !== undefined) parts.push(`煉器爐 ${cond.chest} 階`);
  if (cond.day !== undefined) parts.push(`第 ${cond.day} 天上線`);
  if (cond.playMinutes !== undefined) parts.push(`累計修煉 ${cond.playMinutes} 分鐘`);
  if (cond.ascensions !== undefined) parts.push(`第 ${cond.ascensions} 次飛升`);
  return parts.join('、');
}

/** 功能是否已開放（「飛升後」的預留功能永遠不開放） */
function isFeatureOpen(id) {
  const f = getFeature(id);
  if (!f || f.kind === 'future') return false;
  if (!f.cond) return true;
  return state.features.open[id] !== undefined;
}

/** 鎖住時的說明（已開放回傳 null） */
function getFeatureLockText(id) {
  if (isFeatureOpen(id)) return null;
  const f = getFeature(id);
  if (!f) return null;
  if (f.kind === 'future') return `${f.name}：第 ${f.ascensions || 1} 次飛升後開放（即將推出）`;
  return `${f.name}：${getCondText(f.cond)}後開放`;
}

/**
 * 檢查新達成的功能並開放
 * @param {boolean} silent 不排入演出（舊存檔遷移、測試用）
 * @returns {string[]} 這次新開放的功能 id
 */
function checkFeatureUnlocks(silent = false) {
  const opened = [];
  for (const f of CONFIG.features) {
    if (f.kind === 'future' || !f.cond || state.features.open[f.id] !== undefined) continue;
    if (!isCondMet(f.cond)) continue;
    state.features.open[f.id] = getPlayMinutes();
    if (f.gift) grantRewards(f.gift, 'feature');
    opened.push(f.id);
    if (!silent) featureUnlockQueue.push({ id: f.id, kind: f.kind });
  }
  return opened;
}

/** 直接開放所有功能（測試、開發者按鈕用；不播放演出） */
function openAllFeatures() {
  for (const f of CONFIG.features) if (f.kind !== 'future' && f.cond && state.features.open[f.id] === undefined) state.features.open[f.id] = getPlayMinutes();
}

// ---------- 鎖住期間累積的進度 ----------

/**
 * 某功能鎖住期間累積、現在可一次領取的內容
 * @returns {{count: number, lines: string[]}}
 */
function getFeatureBacklog(id) {
  const f = getFeature(id);
  const lines = [];
  let count = 0;
  switch (f && f.backlog) {
    case 'daily': {
      count = countClaimableDaily(); // 會先抽今天的題目
      for (const t of getTodayTasks()) lines.push(`${t.name}：${fmtNum(Math.floor(getDailyProgress(t)))} / ${fmtNum(t.target)}${isDailyClaimable(t) ? '（可領取）' : ''}`);
      break;
    }
    case 'codex': {
      count = countClaimableCodex();
      lines.push(`已收錄 ${getCodexCount()} / ${getCodexTotal()} 種法寶`);
      if (count) lines.push(`可領取 ${count} 個收集獎勵`);
      break;
    }
    case 'achieve': {
      checkAchievements();
      count = countClaimableAchievements();
      lines.push(`已達成 ${state.achievements.done.length} / ${CONFIG.achievements.length} 項成就`);
      break;
    }
    case 'pass': {
      count = CONFIG.pass.tiers.filter((t, i) => canClaimPass(i, 'free')).length;
      lines.push(`戰令經驗 ${Math.floor(state.shop.pass.exp)}，已達 ${getPassLevel()} 級`);
      if (count) lines.push(`免費線可領取 ${count} 級獎勵`);
      if (state.mail.length) lines.push(`信箱有 ${state.mail.length} 封信`);
      break;
    }
  }
  return { count, lines };
}

/**
 * 一次領取某功能鎖住期間累積的獎勵
 * @returns {RewardGot|null}
 */
function claimFeatureBacklog(id) {
  const f = getFeature(id);
  if (!f || !isFeatureOpen(id)) return null;
  const list = [];
  switch (f.backlog) {
    case 'daily':
      list.push(...claimAllDaily());
      break;
    case 'codex':
      CONFIG.gear.codexMilestones.forEach((m, i) => list.push(claimCodexMilestone(i)));
      break;
    case 'achieve':
      for (const a of CONFIG.achievements) list.push(claimAchievement(a.id));
      break;
    case 'pass':
      list.push(claimAllPass('free'));
      break;
  }
  const got = list.filter(Boolean);
  return got.length ? mergeRewardGot(got) : null;
}

// ---------- 開爐件數檔位 ----------

/** 某一檔目前能用嗎（免費條件，或月卡生效中的提早條件） */
function isTierUnlocked(tier) {
  if (isCondMet(tier.cond)) return true;
  return !!tier.monthCard && isMonthCardActive() && isCondMet(tier.monthCard);
}

/** 已解鎖的件數（由小到大） */
function getUnlockedMultipliers() {
  return CONFIG.chestTiers.filter(isTierUnlocked).map((t) => t.count);
}

/** 檔位的解鎖說明（例如「通關 結丹期一層（月卡：築基期一層）」） */
function getTierLockText(tier) {
  const free = getCondText(tier.cond);
  return tier.monthCard ? `${free}（月卡：${getCondText(tier.monthCard)}）` : free;
}

/**
 * 新解鎖的檔位（升級提示用）；第一次呼叫只記錄、不提示
 * @returns {number[]}
 */
function checkTierUnlocks() {
  const now = getUnlockedMultipliers();
  const seen = state.features.tiersSeen;
  const fresh = now.filter((c) => !seen.includes(c));
  for (const c of fresh) seen.push(c);
  return fresh;
}
