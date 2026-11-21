// @ts-check
/* =========================================================
 * ui-boss.js — 主線 Boss 機制與章節首殺的畫面（第五階段 6-1）
 *   機制標籤（挑戰前可點開說明）、Boss 身上的狀態圖示、機制觸發的跳字、
 *   失敗時的死因與建議、「章節通關」獎勵視窗
 * 再生、劇毒這類每秒持續的機制不跳字，只在 Boss 身上顯示狀態圖示；
 * 鬼甲開始、雷霆、反噬、狂暴開始這類瞬發或切換型才跳字。
 * ========================================================= */

/** 等待顯示的「章節通關」視窗（等天劫演出結束才顯示，之後才輪到法寶比較） */
const chapterClearQueue = [];

/** 敵人名稱下方的機制標籤（沒有機制就隱藏） */
function renderBossMechTag(enemy) {
  const el = $('#boss-mech');
  const m = enemy && enemy.isBoss ? enemy.mechanic : null;
  el.classList.toggle('hidden', !m);
  if (!m) return;
  el.dataset.mech = m.id;
  setHTML(el, `${ri(m.icon)}<span>${m.name}</span>`);
  el.classList.toggle('active', !!m.status);
}

/** 每一幀更新 Boss 狀態圖示：持續型一直亮；鬼甲在護盾期間亮；狂暴開始後亮 */
function renderBossStatus(battle) {
  const m = battle && battle.enemy.isBoss ? battle.enemy.mechanic : null;
  if (!m) return;
  let active = !!m.status;
  if (m.id === 'ghostShield') active = battle.enemy.shieldLeft > 0;
  else if (m.id === 'enrage') active = battle.mech.enraged;
  const el = $('#boss-mech');
  if (el.classList.contains('active') !== active) el.classList.toggle('active', active);
}

/** 點機制標籤：顯示說明、克制方式 */
function showBossMechInfo() {
  const total = getCurrentTotal();
  if (!isBossStage(total)) return;
  const chapter = splitTotalStage(total).chapter;
  const m = getBossMechanic(chapter);
  if (!m) return;
  const boss = getChapterMonsterInfo(chapter).bossName;
  const modal = openModal(
    `<div class="modal-title">${ri(m.icon)}${boss}・${m.name}</div>
     <div class="mech-desc">${m.desc}</div>
     <div class="mech-counter"><b>克制：</b>${m.counter}</div>
     <div class="modal-buttons"><button class="btn-close">關閉</button></div>`,
    { closeOnOverlay: true }
  );
  modal.querySelector('.btn-close').addEventListener('click', closeModal);
}

/** 第一次挑戰某章 Boss 前：在戰鬥區顯示機制說明 */
function showBossMechHint(total) {
  if (!isBossStage(total) || total <= getBestStage()) return;
  const m = getBossMechanic(splitTotalStage(total).chapter);
  if (m) setBattleHint(`妖王機制・${m.name}：${m.desc}`);
}

/** 機制觸發的跳字（只有瞬發或切換型會送出事件） */
function playMechEvent(ev) {
  switch (ev.id) {
    case 'ghostShield': {
      const m = CONFIG.bossMechanics.find((x) => x && x.id === 'ghostShield');
      spawnFloat('enemy', `<small>${ev.name}！</small>減傷 ${Math.round(m.reduction * 100)}%`, 'shield');
      playSound('shield');
      break;
    }
    case 'thunder':
      replayAnim($('#battle-area'), 'thunder-flash');
      if (ev.dodged) {
        spawnFloat('hero', `<small>${ev.name}</small>閃避`, 'dodge');
        playSound('dodge');
      } else {
        replayAnim($('#hero-sprite'), 'hit');
        spawnFloat('hero', `<small>${ev.name}</small>${fmtNum(ev.damage)}`, 'down');
        playSound('thunder');
      }
      break;
    case 'backlash':
      spawnFloat('hero', `<small>${ev.name}</small>${fmtNum(ev.damage)}`, 'down');
      break;
    case 'enrage': {
      const m = CONFIG.bossMechanics.find((x) => x && x.id === 'enrage');
      spawnFloat('enemy', `<small>${ev.name}！</small>攻擊 ×${m.atkMult}`, 'crit');
      replayAnim($('#enemy-sprite'), 'lunge');
      playSound('thunder');
      break;
    }
  }
}

/** 輸給 Boss 時的提示：死因 + 建議（有戰意時一併說明） */
function getBossFailHint(data) {
  const d = data.death;
  let msg = `${d.cause}，${d.advice}`;
  if (data.fury) msg += `。戰意 +1（${data.fury} 層，攻擊與氣血 +${Math.round(data.fury * CONFIG.boss.fury.perStack * 100)}%）`;
  return msg;
}

/** 首殺章節：排入「章節通關」視窗，等天劫演出結束後顯示 */
function queueChapterClear(chapterReward) {
  chapterClearQueue.push({ ...chapterReward, readyAt: Date.now() + CONFIG.fx.tribulationDelayMs + CONFIG.fx.ceremonyMs });
  showNextQueuedModal();
}

/**
 * 顯示下一個「章節通關」視窗；還沒到時間就稍後再檢查
 * @returns {boolean} 是否佔用了這次顯示機會（顯示中或等待中）
 */
function showNextChapterClear() {
  if (!chapterClearQueue.length) return false;
  const next = chapterClearQueue[0];
  const wait = next.readyAt - Date.now();
  if (wait > 0) {
    setTimeout(showNextQueuedModal, wait + 50);
    return true;
  }
  chapterClearQueue.shift();
  const got = next.got;
  const title = next.title || `章節通關・${getRealmName(next.chapter)}`;
  const hint = next.hint || `首次擊敗${getChapterMonsterInfo(next.chapter).bossName}，獲得章節獎勵：`;
  const modal = openModal(
    `<div class="modal-title">${ri('seal')}${title}</div>
     <div class="unlock-hint">${hint}</div>
     <div class="unlock-got">${rewardGotHTML(got)}</div>
     <div class="modal-buttons"><button class="btn-primary btn-close">${got.items.length ? '查看法寶' : '確定'}</button></div>`
  );
  playSound('reward');
  modal.querySelector('.btn-close').addEventListener('click', closeModal);
  return true;
}
