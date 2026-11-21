// @ts-check
/* =========================================================
 * ui-daily.js — 每日任務、每週任務、活躍度寶箱（歷練分頁上方）、月曆簽到頁、自動發放提示（6-5）
 * 邏輯在 daily.js、progress.js
 * ========================================================= */

/** 每日面板目前的頁籤（不存檔） */
let dailyTab = 'daily';

/** 活躍度條＋寶箱 */
function activityBarHTML(kind) {
  const chests = CONFIG.activity[kind];
  const max = chests[chests.length - 1].need;
  const act = kind === 'daily' ? getDailyActivity() : getWeeklyActivity();
  const opened = (kind === 'daily' ? state.daily : state.weekly).chests;
  const boxes = chests
    .map((c, i) => {
      const isOpen = opened.includes(i);
      const ready = isActivityChestClaimable(kind, i);
      return `<button class="act-chest ${isOpen ? 'opened' : ''} ${ready ? 'ready' : ''}" style="left:${(c.need / max) * 100}%"
        data-act="chest" data-arg="${kind}:${i}" ${ready ? '' : 'disabled'} title="${c.need} 活躍度">
        ${ri(isOpen ? 'check' : 'furnace')}<span>${c.need}</span></button>`;
    })
    .join('');
  const rewards = chests.map((c) => `<div class="act-reward"><b>${c.need}</b>${rewardSpecHTML(c.reward)}</div>`).join('');
  return `<div class="act-wrap">
      <div class="act-label">${kind === 'daily' ? '今日' : '本週'}活躍度 <b>${act}</b> / ${max}</div>
      <div class="act-track"><div class="act-fill" style="width:${Math.min(100, (act / max) * 100)}%"></div>${boxes}</div>
      <details class="act-detail"><summary>寶箱內容</summary>${rewards}</details>
    </div>`;
}

/** 一列任務 */
function taskRowHTML(t, prog, claimed, ready, act, extra) {
  const btn = claimed
    ? '<span class="daily-done">已領取</span>'
    : `<button class="daily-claim" data-act="${act}" data-arg="${t.id}" ${ready ? '' : 'disabled'}>領取</button>`;
  const shown = Math.floor(prog);
  return `<div class="daily-row ${claimed ? 'done' : ''}">
      <div class="daily-main">
        <div class="daily-name">${t.name}<small>${getTaskDesc(t)}</small></div>
        <div class="daily-bar"><div class="daily-fill" style="width:${(prog / t.target) * 100}%"></div><span>${fmtNum(shown)}/${fmtNum(t.target)}</span></div>
      </div>
      <div class="daily-side"><div class="daily-reward">${extra}</div>${btn}</div>
    </div>`;
}

function renderDaily(force = false) {
  if (!pageActive('dungeon', force)) return;
  ensureDailyFresh();
  const panel = $('#daily-panel');
  if (!isFeatureOpen('daily')) {
    // 鎖住期間進度照常累積，開放時一次領取
    setHTML(panel, `<div class="card daily-card locked-card"><div class="sub-title">${icon('scroll')}每日任務</div>
      <div class="locked-note">${ri('lock')}${getFeatureLockText('daily')}<small>鎖住期間任務進度照常累積，開放時可以一次領取</small></div></div>`);
    return;
  }
  const per = Math.round(getActivityPerTask());
  const exp = CONFIG.pass.exp;
  let body;
  if (dailyTab === 'daily') {
    const rows = getTodayTasks()
      .map((t) => taskRowHTML(t, getDailyProgress(t), state.daily.claimed.includes(t.id), isDailyClaimable(t), 'task', `${rewardSpecHTML(CONFIG.dailyTaskRules.reward)}<small>活躍 +${per}・戰令 +${exp.perDailyTask}</small>`))
      .join('');
    body = `${activityBarHTML('daily')}${rows}<div class="queue-hint">已完成但沒領的任務與寶箱，重置時會自動發放</div>`;
  } else {
    const rows = getWeeklyTaskList()
      .map((t) => taskRowHTML(t, getWeeklyProgress(t), state.weekly.claimed.includes(t.id), isWeeklyClaimable(t), 'weekly', `${rewardSpecHTML(CONFIG.weeklyTaskRules.reward)}<small>戰令 +${exp.perWeeklyTask}</small>`))
      .join('');
    body = `${activityBarHTML('weekly')}${rows}<div class="queue-hint">每週活躍度 = 這週每天的活躍度加總，週一子時重置</div>`;
  }
  const n = countClaimableDaily();
  const tabs = `<div class="daily-tabs">
      <button class="daily-tab ${dailyTab === 'daily' ? 'active' : ''}" data-act="tab" data-arg="daily">今日任務</button>
      <button class="daily-tab ${dailyTab === 'weekly' ? 'active' : ''}" data-act="tab" data-arg="weekly">每週任務</button>
      ${n ? `<button class="daily-claim daily-all" data-act="all">全部領取</button>` : ''}
    </div>`;
  setHTML(panel, `<div class="card daily-card"><div class="sub-title">${icon('scroll')}每日任務<small class="daily-reset">子時重置</small></div>${tabs}${body}</div>`);
  const after = (got, text) => {
    if (!got) return;
    playSound('reward');
    toast(`${text} ${rewardGotHTML(got)}`);
    saveGame();
    lastHTML.delete(panel); // 強制重繪
    renderAll();
    renderDaily(true);
  };
  bindPanel(panel, {
    tab: (arg) => {
      dailyTab = arg;
      lastHTML.delete(panel);
      renderDaily(true);
    },
    task: (id) => after(claimDaily(id), '任務完成'),
    weekly: (id) => after(claimWeekly(id), '每週任務完成'),
    chest: (arg) => {
      const [kind, i] = arg.split(':');
      after(claimActivityChest(/** @type {'daily'|'weekly'} */ (kind), Number(i)), '開啟寶箱');
    },
    all: () => {
      const list = claimAllDaily();
      if (list.length) after(mergeRewardGot(list), '全部領取');
    },
  });
}

// ---------- 月曆簽到 ----------

function renderSignin(force = false) {
  if (!pageActive('signin', force)) return;
  const can = canSignIn();
  const today = getSigninDay();
  const big = CONFIG.signin.bigDays;
  const cells = CONFIG.signin.days
    .map((r, i) => {
      const day = i + 1;
      const claimed = can ? day < today : day <= today;
      const isToday = day === today;
      const reward = getSigninReward(day);
      return `<div class="sign-cell ${big.includes(day) ? 'big' : ''} ${claimed ? 'claimed' : ''} ${isToday && can ? 'today' : ''}">
        <div class="sign-day">${day}</div><div class="sign-reward">${rewardSpecHTML(reward)}</div>${claimed ? `<div class="sign-mark">${icon('check')}</div>` : ''}</div>`;
    })
    .join('');
  const round = Math.floor(Math.max(0, state.signin.count - (can ? 0 : 1)) / CONFIG.signin.days.length) + 1;
  const panel = $('#signin-panel');
  setHTML(panel, `<div class="card"><div class="sub-title">${icon('scroll')}月曆簽到<small class="daily-reset">第 ${round} 輪・累計 ${state.signin.count} 次</small></div>
    <div class="queue-hint">中斷不歸零，簽滿 30 格從頭再來；每 7 格一個大獎，第 28 格是限定外觀</div>
    <div class="sign-grid month">${cells}</div>
    <button class="btn-primary sign-btn" data-act="sign" ${can ? '' : 'disabled'}>${can ? '簽 到' : '今日已簽到'}</button></div>`);
  bindPanel(panel, {
    sign: () => {
      const res = signIn();
      if (!res) return;
      showAchievementPop(`簽到第 ${res.day} 格`, rewardSpecHTML(res.reward), 'scroll');
      afterShopChange();
    },
  });
}

// ---------- 重置時自動發放的提示 ----------

/** 有自動發放的紀錄就跳視窗（showNextQueuedModal 呼叫）；有跳出時回傳 true */
function showAutoClaimNotice() {
  if (!state.autoClaim.notices.length) return false;
  const list = takeAutoClaimNotices();
  saveGame();
  const rows = list
    .map((e) => `<div class="welfare-row"><div class="welfare-title">${e.title}</div><div class="reward-row">${rewardGotHTML(e.got)}</div></div>`)
    .join('');
  playSound('reward');
  const modal = openModal(`
    <div class="modal-title">${ri('scroll')}昨日未領取的獎勵已自動發放</div>
    <div class="queue-hint">已完成但沒領的任務與活躍度寶箱，重置時自動放進背包</div>
    ${rows}
    <div class="modal-buttons"><button class="btn-equip">收下</button></div>`);
  modal.querySelector('.btn-equip').addEventListener('click', () => {
    closeModal(); // 會接著顯示下一個排隊的視窗
    renderAll();
  });
  return true;
}
