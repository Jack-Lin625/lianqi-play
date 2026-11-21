// @ts-check
/* =========================================================
 * ui-welfare.js — 「今日福利」視窗、信箱分頁
 * ========================================================= */

/**
 * 每天第一次上線：顯示今天自動發放的福利（獎勵已入帳）
 * @param {{date: string, entries: {title: string, got: RewardGot}[], reminders: string[]}} summary
 */
function showWelfareSummary(summary) {
  const rows = summary.entries
    .map((e) => `<div class="welfare-row"><div class="welfare-title">${e.title}</div><div class="reward-row">${rewardGotHTML(e.got)}</div></div>`)
    .join('');
  const reminders = summary.reminders.map((t) => `<div class="buff-on warn">${ri('bell')}${t}</div>`).join('');
  const hasItems = summary.entries.some((e) => e.got.items.length);
  playSound('reward');
  const modal = openModal(`
    <div class="modal-title">${ri('star')}今日福利</div>
    ${rows}
    ${reminders}
    ${getNewbieGiftsLeft() > 0 ? `<div class="queue-hint">新手七日禮還有 ${getNewbieGiftsLeft()} 份，明天上線繼續領取</div>` : ''}
    ${hasItems ? '<div class="queue-hint">法寶會接著跳出比較視窗</div>' : ''}
    <div class="modal-buttons"><button class="btn-equip">收下</button></div>`);
  modal.querySelector('.btn-equip').addEventListener('click', () => {
    closeModal();
    // 新玩家第一次進遊戲：福利視窗關閉後才開始開場引導
    if (getBestStage() === 0 && !isTutorialSeen('welcome') && !isModalOpen()) showTutorial('welcome');
  });
}

// ---------- 信箱 ----------

function renderMail(force = false) {
  if (!pageActive('mail', force)) return;
  const list = state.mail
    .slice()
    .reverse()
    .map(
      (m) => `<div class="daily-row">
        <div class="daily-main"><div class="daily-name">${m.title}</div>
          <div class="daily-desc">${m.desc}</div>
          <div class="daily-desc">${rewardSpecHTML(m.reward)}</div>
          <div class="daily-desc mail-time">${new Date(m.time).toLocaleString()}</div></div>
        <div class="daily-side"><button class="daily-claim" data-act="claim" data-arg="${m.id}">領取</button></div>
      </div>`
    )
    .join('');
  const panel = $('#mail-panel');
  setHTML(
    panel,
    `<div class="card"><div class="sub-title">${icon('scroll')}信箱<small class="daily-reset">${state.mail.length} 封</small></div>
      ${state.mail.length ? `<button class="btn-secondary mail-all" data-act="all">全部領取</button>${list}` : '<div class="queue-hint">沒有信件。賽季結束時未領的戰令獎勵會寄到這裡。</div>'}
    </div>`
  );
  bindPanel(panel, {
    claim: (id) => {
      const got = claimMail(Number(id));
      if (got) afterMailClaim(got);
    },
    all: () => {
      const got = claimAllMail();
      if (got) afterMailClaim(got);
    },
  });
}

function afterMailClaim(got) {
  showPurchaseResult(got, { title: '信件獎勵' });
  saveGame();
  renderAll();
  renderMail(true);
}
