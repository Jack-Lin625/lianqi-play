// @ts-check
/* =========================================================
 * welfare.js — 免費福利與信箱
 *
 * 每天第一次上線（本地日期換日）自動發放：
 *   1. 每日上線仙玉（CONFIG.welfare.dailyLoginGems）
 *   2. 新手七日禮：前 7 個有上線的日子各一份（CONFIG.welfare.newbieGifts）
 *   3. 月卡當日仙玉（月卡生效中）；到期前幾天提醒
 *   4. 戰令經驗（CONFIG.pass.exp.perLogin）
 * 發放結果放進 welfareQueue，由畫面顯示「今日福利」視窗。
 *
 * 信箱 state.mail：季末未領的戰令獎勵等會寄到這裡，玩家手動領取。
 * ========================================================= */

/**
 * 待顯示的「今日福利」（不存檔；獎勵已經入帳）
 * @type {{date: string, entries: {title: string, got: RewardGot}[], reminders: string[]}[]}
 */
const welfareQueue = [];

/**
 * 每天第一次上線時發放福利；同一天重複呼叫不會重複發放
 * @param {string} [today]
 * @returns {null | {date: string, entries: {title: string, got: RewardGot}[], reminders: string[]}}
 */
function checkDailyWelfare(today = todayString()) {
  const w = state.welfare;
  if (w.lastLoginDate === today) return null;
  w.lastLoginDate = today;
  w.loginDays++;

  const cfg = CONFIG.welfare;
  const entries = [];
  const reminders = [];
  if (cfg.dailyLoginGems > 0) entries.push({ title: '每日上線仙玉', got: grantRewards({ stones: cfg.dailyLoginGems }, 'login') });
  if (w.newbieClaimed < cfg.newbieGifts.length) {
    const day = w.newbieClaimed + 1;
    w.newbieClaimed = day;
    entries.push({ title: `新手七日禮・第 ${day} 天`, got: grantRewards(cfg.newbieGifts[day - 1], 'newbie') });
  }
  const month = claimMonthCard(today);
  if (month) {
    const left = getMonthCardDaysLeft();
    entries.push({ title: `月卡・剩 ${left} 天`, got: month });
    if (left <= CONFIG.shop.recharge.monthCard.remindDays) reminders.push(`月卡將在 ${left} 天後到期`);
  }
  addPassExp(CONFIG.pass.exp.perLogin);

  const summary = { date: today, entries, reminders };
  if (entries.length || reminders.length) welfareQueue.push(summary);
  return summary;
}

/** 新手七日禮還剩幾份 */
function getNewbieGiftsLeft() {
  return Math.max(0, CONFIG.welfare.newbieGifts.length - state.welfare.newbieClaimed);
}

// ---------- 信箱 ----------

/**
 * 寄一封信（附獎勵）
 * @param {string} title
 * @param {string} desc
 * @param {Reward} reward
 */
function addMail(title, desc, reward) {
  state.mailSeq = (state.mailSeq || 0) + 1;
  state.mail.push({ id: state.mailSeq, title, desc, reward, time: Date.now() });
}

/**
 * 領取一封信的獎勵（領完刪除）
 * @param {number} id
 * @returns {RewardGot|null}
 */
function claimMail(id) {
  if (!isFeatureOpen('pass')) return null; // 信箱與戰令一起開放
  const i = state.mail.findIndex((m) => m.id === id);
  if (i < 0) return null;
  const [mail] = state.mail.splice(i, 1);
  return grantRewards(mail.reward, 'mail');
}

/**
 * 全部領取
 * @returns {RewardGot|null}
 */
function claimAllMail() {
  if (!state.mail.length) return null;
  const list = state.mail.map((m) => m.id).map((id) => claimMail(id));
  return mergeRewardGot(list);
}

function countMail() {
  return state.mail.length;
}
