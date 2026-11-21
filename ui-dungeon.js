// @ts-check
/* =========================================================
 * ui-dungeon.js — 歷練分頁的秘境卡片、掃蕩、結算視窗（從 ui.js 拆出）
 * ========================================================= */

/** 等待顯示的副本結算 */
const pendingDungeonResults = [];

/** 副本結束後：畫面切回主線並顯示結算 */
function afterDungeonEnd() {
  if (stageRun.battle) setEnemyAppearance(stageRun.battle.enemy);
  $('#hero-sprite').classList.toggle('dead', !!stageRun.hero && stageRun.hero.hp <= 0);
  renderAll();
  showNextQueuedModal();
}

/** 副本卡片的說明文字 */
function getDungeonDesc(type) {
  const c = CONFIG.dungeons[type];
  switch (type) {
    case 'gold':
      return `${c.durationSec} 秒內轟擊不會還手的靈石傀儡，依總傷害得靈石`;
    case 'key':
      return `妖獸成群來襲，每擊退一波得爐火符，最多 ${c.maxWaves} 波`;
    case 'tower':
      return '一層鎮一隻妖王，無限往上闖，首次通過得仙玉；每天可領一次塔俸';
    case 'worldBoss':
      return `${c.durationSec} 秒內對不死的上古妖王全力出手，依傷害區間得獎勵`;
  }
  return '';
}

/** 靈石秘境的換算說明：每點傷害的靈石很小時，改成「每 1M 傷害得 50 靈石」這種好讀的寫法 */
function goldPerDamageText(perDamage) {
  let unit = 1;
  while (perDamage * unit < 1 && unit < 1e18) unit *= 1000;
  return unit === 1 ? `靈石 = 總傷害 × ${perDamage}` : `每 ${fmtNum(unit)} 傷害得 ${fmtNum(perDamage * unit)} 靈石`;
}

/** 副本卡片的額外資訊 */
function getDungeonInfo(type) {
  const c = CONFIG.dungeons[type];
  const d = state.dungeons[type];
  switch (type) {
    case 'gold':
      return `難度倍率 <b>×${getDifficultyConfig('gold', getSelectedDifficulty('gold')).mult}</b>・${goldPerDamageText(c.goldPerDamage)} × 倍率`;
    case 'key': {
      const diff = getDifficultyConfig('key', getSelectedDifficulty('key'));
      const keys = Math.round(c.keysPerWave * diff.keyMult);
      return `每波 <b>${ri('keys')}+${keys}</b>・最多 ${ri('keys')}+${keys * c.maxWaves}・妖獸強度 ×${diff.statMult}<br>第 5、10 波有機會掉落 ${ri('egg')}靈獸蛋`;
    }
    case 'tower': {
      let next = d.highestFloor + 1;
      while (getTowerFloorStones(next) === 0) next++;
      const nextBig = (Math.floor(d.highestFloor / 10) + 1) * 10;
      const sw = getTowerSweepReward();
      return `<div class="dg-record">目前最高 <b>第 ${d.highestFloor} 層</b></div>下一個獎勵：第 ${next} 層 ${ri('stones')}+${getTowerFloorStones(next)}<br>每 10 層大獎：第 ${nextBig} 層 ${ri('egg')}靈獸蛋＋仙玉或高品階法寶<br>每日塔俸（依最高層）：${ri('stones')}+${sw.stones} ${ri('iron')}玄鐵+${sw.iron}`;
    }
    case 'worldBoss': {
      const chips = c.tiers
        .map((t) => {
          const dmg = getWorldBossTierDamage(t);
          return `<span class="tier-chip ${d.bestDamage >= dmg ? 'reached' : ''}">${fmtNum(dmg)}</span>`;
        })
        .join('');
      return `<div class="dg-record">個人最高傷害 <b>${fmtNum(d.bestDamage)}</b></div>目前傷害區間（隨進度成長）：${chips}`;
    }
  }
  return '';
}

/**
 * 副本分頁
 * @param {boolean} force 不在副本分頁時也強制重繪
 */
function renderDungeons(force = false) {
  const page = document.querySelector('.tab-page[data-page="dungeon"]');
  if (!force && !page.classList.contains('active')) return;

  const list = $('#dungeon-list');
  list.innerHTML = DUNGEON_TYPES.map((type) => {
    const c = CONFIG.dungeons[type];
    const unlocked = isDungeonUnlocked(type);
    const remaining = getDungeonRemaining(type);
    const block = getDungeonBlockReason(type);

    const count =
      type === 'tower'
        ? '<span class="dg-count">不限次數</span>'
        : `<span class="dg-count ${remaining <= 0 ? 'empty' : ''}">今日 ${remaining}/${CONFIG.dungeons.dailyFree}</span>`;

    let diffs = '';
    if (c.difficulties && unlocked) {
      const sel = getSelectedDifficulty(type);
      const maxDiff = getUnlockedDifficulty(type);
      diffs =
        '<div class="dg-diffs">' +
        c.difficulties
          .map((d, i) => {
            const lv = i + 1;
            const locked = lv > maxDiff;
            const label = locked ? `${ri('lock')}${lv}<small>${shortStage(d.unlockStage)}</small>` : `難度 ${lv}`;
            return `<button class="dg-diff ${lv === sel ? 'active' : ''}" data-diff-type="${type}" data-diff="${lv}" ${locked ? 'disabled' : ''}>${label}</button>`;
          })
          .join('') +
        '</div>';
    }

    const info = unlocked ? `<div class="dg-info">${getDungeonInfo(type)}</div>` : '';
    // 次數用完時可用仙玉多買一次
    const canBuyHere = unlocked && type !== 'tower' && remaining <= 0 && getDungeonBuysLeft(type) > 0;
    const buy = canBuyHere
      ? `<button class="btn-secondary dg-buy" data-buy="${type}" ${state.upgradeStones < CONFIG.dungeons.buyCost ? 'disabled' : ''}>多買一次 ${ri('stones')}×${CONFIG.dungeons.buyCost}</button>`
      : '';
    const btnText = block && !(dungeonRun.active && dungeonRun.type === type) ? block : dungeonRun.active && dungeonRun.type === type ? '歷練中…' : '進入秘境';
    const sweep = type === 'tower' ? towerButtonsHTML() : sweepButtonHTML(type);

    return `<div class="card dungeon-card ${unlocked ? '' : 'locked'}" data-scene="${CONFIG.dungeons.scenes[type]}">
      <div class="dg-head">
        <span class="dg-icon">${icon(c.icon)}</span>
        <div class="dg-title"><div class="dg-name">${c.name}</div><div class="dg-desc">${getDungeonDesc(type)}</div></div>
        ${unlocked ? count : ''}
      </div>
      ${diffs}${info}
      <div class="dg-btns">
        <button class="btn-dg" data-dungeon="${type}" ${block ? 'disabled' : ''}>${btnText}</button>
        ${sweep}
      </div>
      ${buy}
    </div>`;
  }).join('');

  $$('[data-diff]', list).forEach((b) =>
    b.addEventListener('click', () => {
      setSelectedDifficulty(b.dataset.diffType, Number(b.dataset.diff));
      saveGame();
      renderDungeons(true);
    })
  );
  $$('[data-buy]', list).forEach((b) =>
    b.addEventListener('click', async () => {
      const type = b.dataset.buy;
      if (!(await askConfirm(`花費仙玉 ${CONFIG.dungeons.buyCost}，多買一次「${CONFIG.dungeons[type].name}」？`, { okText: '購買' }))) return;
      const res = buyDungeonAttempt(type);
      if (!res.ok) {
        toast(res.error);
        return;
      }
      playSound('coin');
      toast(`${ri('stones')} 已多買一次${CONFIG.dungeons[type].name}`);
      saveGame();
      renderAll();
      renderDungeons(true);
    })
  );
  $$('[data-sweep]', list).forEach((b) =>
    b.addEventListener('click', () => {
      const type = b.dataset.sweep;
      const res = sweepDungeon(type, getSelectedDifficulty(type));
      if (!res) {
        toast(getSweepBlockReason(type, getSelectedDifficulty(type)) || '無法掃蕩');
        return;
      }
      saveGame();
      pendingDungeonResults.push(res);
      renderAll();
      renderDungeons(true);
      showNextQueuedModal();
    })
  );
  // 鎮妖塔：快速登塔、每日塔俸（D2）
  const towerResult = (res, block) => {
    if (!res) {
      toast(block || '無法進行');
      return;
    }
    saveGame();
    pendingDungeonResults.push(res);
    renderAll();
    renderDungeons(true);
    showNextQueuedModal();
  };
  $$('[data-tower-quick]', list).forEach((b) => b.addEventListener('click', () => towerResult(quickClimbTower(), getTowerQuickBlockReason())));
  $$('[data-tower-sweep]', list).forEach((b) => b.addEventListener('click', () => towerResult(claimTowerSweep(), getTowerSweepBlockReason())));
  $$('[data-dungeon]', list).forEach((b) =>
    b.addEventListener('click', () => {
      const type = b.dataset.dungeon;
      if (startDungeon(type, getSelectedDifficulty(type))) saveGame();
      else toast(getDungeonBlockReason(type) || '無法進入');
    })
  );
}

/** 掃蕩按鈕與目前難度的紀錄（鎮妖塔沒有掃蕩） */
function sweepButtonHTML(type) {
  if (!CONFIG.dungeons.sweepEnabled || type === 'tower' || !isDungeonUnlocked(type)) return '';
  const diff = getSelectedDifficulty(type);
  const record = getSweepRecord(type, diff);
  const block = getSweepBlockReason(type, diff);
  const label = record > 0 ? `掃蕩<small>${sweepRecordText(type, record)}</small>` : '掃蕩<small>尚無紀錄</small>';
  return `<button class="btn-secondary dg-sweep" data-sweep="${type}" ${block ? 'disabled' : ''} title="${block || '直接領取最佳紀錄的獎勵'}">${label}</button>`;
}

/** 鎮妖塔的「快速登塔」「塔俸」按鈕（D2） */
function towerButtonsHTML() {
  if (!isDungeonUnlocked('tower')) return '';
  const qBlock = getTowerQuickBlockReason();
  const sBlock = getTowerSweepBlockReason();
  const done = state.dungeons.tower.sweepDate === todayString();
  const n = CONFIG.dungeons.tower.quickMaxFloors;
  return `<button class="btn-secondary dg-sweep" data-tower-quick ${qBlock ? 'disabled' : ''} title="${qBlock || `直接結算，最多連闖 ${n} 層`}">快速登塔<small>最多 ${n} 層</small></button>
    <button class="btn-secondary dg-sweep ${sBlock ? '' : 'ready'}" data-tower-sweep ${sBlock ? 'disabled' : ''} title="${sBlock || '依最高層領取今天的塔俸'}">塔俸<small>${done ? '今天已領' : sBlock ? '未達條件' : '今天可領'}</small></button>`;
}

/** 紀錄的說明文字 */
function sweepRecordText(type, record) {
  if (type === 'gold') return `紀錄 ${fmtNum(record)} 靈石`;
  if (type === 'key') return `紀錄 ${record} 波`;
  if (type === 'worldBoss') return `紀錄 ${record} 區間`;
  return '';
}

/** 副本結算視窗 */
function showDungeonResult(r) {
  const c = CONFIG.dungeons[r.type];
  let body = '';
  if (r.reason === 'quick') {
    body = `<div class="result-big">快速登塔<br><b>${r.cleared ? `第 ${r.from}～${r.from + r.cleared - 1} 層` : '沒有通過新的一層'}</b></div>
      <div class="queue-hint">${r.lostAt ? `敗在第 ${r.lostAt} 層（妖王還剩 ${Math.ceil(r.enemyLeft * 100)}% 氣血）` : `連闖 ${r.cleared} 層，可以再挑戰`}・最高紀錄：第 ${state.dungeons.tower.highestFloor} 層</div>`;
  } else if (r.reason === 'towerSweep') {
    body = `<div class="result-big">每日塔俸<br><b>最高第 ${r.record} 層</b></div>
      <div class="queue-hint">每天依最高層領一次；往上爬，塔俸會變多</div>`;
  } else if (r.reason === 'sweep') {
    body = `<div class="result-big">掃蕩<br><b>${sweepRecordText(r.type, r.record)}</b></div>
      <div class="queue-hint">依最佳紀錄直接領取獎勵，想刷新紀錄請親自挑戰</div>`;
  } else switch (r.type) {
    case 'gold':
      body = `<div class="result-big">總傷害<br><b>${fmtNum(r.damage)}</b></div>`;
      break;
    case 'worldBoss':
      body = `<div class="result-big">總傷害<br><b>${fmtNum(r.damage)}</b>${r.newBest ? `<br>${ri('star')} 新紀錄！` : ''}</div>
        <div class="queue-hint">達成 ${r.tiersReached}/${c.tiers.length} 個傷害區間</div>`;
      break;
    case 'key': {
      const cleared = r.reason === 'complete' ? r.wave : r.wave - 1;
      body = `<div class="result-big">擊退波數<br><b>${cleared} / ${c.maxWaves}</b></div>`;
      break;
    }
    case 'tower':
      body = `<div class="result-big">停在<br><b>第 ${r.floor} 層</b></div>
        <div class="queue-hint">最高紀錄：第 ${state.dungeons.tower.highestFloor} 層</div>`;
      break;
  }

  const e = r.earned;
  const rewards = [];
  if (e.gold) rewards.push(`<span>${ri('gold')}+${fmtNum(e.gold)}</span>`);
  if (e.keys) rewards.push(`<span>${ri('keys')}+${e.keys}</span>`);
  if (e.stones) rewards.push(`<span>${ri('stones')}+${e.stones}</span>`);
  if (e.eggs) rewards.push(`<span>${ri('egg')}+${e.eggs}</span>`);
  if (e.iron) rewards.push(`<span>${ri('iron')}玄鐵+${e.iron}</span>`);
  if (e.items) rewards.push(`<span>${ri('sword')}法寶×${e.items}</span>`);
  const reasonText = { done: '時辰已到', defeat: '敗退', complete: '妖潮盡退！', quit: '已離開', sweep: '掃蕩完成', quick: '快速登塔', towerSweep: '塔俸' }[r.reason] || '';

  playSound('reward');
  const modal = openModal(`
    <div class="modal-title">${ri(c.icon)}${c.name}・${reasonText}</div>
    ${body}
    <div class="reward-row">${rewards.length ? rewards.join('') : '<span class="queue-hint">沒有獲得獎勵</span>'}</div>
    <div class="modal-buttons"><button class="btn-equip">回到修煉</button></div>
  `);
  modal.querySelector('.btn-equip').addEventListener('click', closeModal);
}

