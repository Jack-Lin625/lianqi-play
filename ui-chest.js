// @ts-check
/* =========================================================
 * ui-chest.js — 煉器爐的畫面（從 ui.js 拆出）
 *   開爐按鈕與件數選單、煉器爐升階（分段強化）、機率對照、自動開爐設定、開爐演出與結果彙整
 * ========================================================= */

function renderChest() {
  $('#chest-level').textContent = toCN(state.chestLevel);
  $('#chest-level-2').textContent = toCN(state.chestLevel);

  // 開箱按鈕：自動開箱中變成「停止」
  const effective = getEffectiveMultiplier();
  const btn = $button('#btn-open');
  const pending = hasPendingItems();
  if (autoRun.active) {
    btn.disabled = false;
    btn.classList.add('stop');
    btn.innerHTML = `停 止<span class="btn-sub">${pending ? '等待你決定新法寶…' : '自動開爐中'}</span>`;
  } else {
    btn.classList.remove('stop');
    btn.disabled = effective <= 0 || pending || chestRevealing;
    let sub = effective > 0 ? `消耗 ${ri('keys')}×${fmtNum(getOpenKeyCost(effective))}` : '爐火符不足';
    if (pending) sub = '請先處理新法寶';
    btn.innerHTML = `開 爐<span class="btn-sub">${sub}</span>`;
  }

  // 件數：一顆按鈕顯示目前件數，點開列出全部檔位（未解鎖的顯示鎖頭與條件）
  const unlocked = getUnlockedMultipliers();
  // 舊存檔或月卡到期：選了目前不能用的件數時，改成可用的最大件數
  if (!unlocked.includes(state.multiplier)) {
    state.multiplier = Math.max(1, ...unlocked.filter((c) => c <= state.multiplier));
  }
  const nextTier = CONFIG.chestTiers.find((t) => !unlocked.includes(t.count));
  setHTML(
    $('#btn-batch'),
    `×${state.multiplier}<span class="btn-batch-sub">${nextTier ? `${unlocked.length}/${CONFIG.chestTiers.length} 檔` : '全部解鎖'} ▾</span>`
  );
  const autoBtn = $button('#btn-auto');
  refreshAutoBatchOptions();

  // 自動按鈕
  autoBtn.classList.toggle('running', autoRun.active);
  autoBtn.disabled = !autoRun.active && (effective <= 0 || pending);
}

/** 件數選單：列出全部檔位；未解鎖的顯示鎖頭與解鎖條件（含月卡提早解鎖） */
function showBatchMenu() {
  const unlocked = getUnlockedMultipliers();
  const monthActive = isMonthCardActive();
  const rows = CONFIG.chestTiers
    .map((t) => {
      const ok = unlocked.includes(t.count);
      const early = ok && t.monthCard && !isCondMet(t.cond); // 靠月卡提早解鎖
      const cost = getOpenKeyCost(t.count);
      const note = ok
        ? `${ri('keys')}${fmtNum(cost)}${early ? '<span class="tier-month">月卡提早解鎖</span>' : ''}`
        : `${ri('lock')}${getCondText(t.cond)}${t.monthCard ? `<span class="tier-month">月卡：${getCondText(t.monthCard)}${monthActive ? '' : '（需月卡）'}</span>` : ''}`;
      return `<button class="tier-row ${ok ? '' : 'locked'} ${state.multiplier === t.count ? 'active' : ''}" data-count="${t.count}" ${ok ? '' : 'disabled'}>
        <b>×${t.count}</b><span class="tier-note">${note}</span></button>`;
    })
    .join('');
  const modal = openModal(
    `<div class="modal-title">一次開爐件數</div>
     <div class="tier-list">${rows}</div>
     <div class="queue-hint">每件消耗 ${ri('keys')}${fmtNum(CONFIG.chest.keysPerItem)}；爐火符不足時自動改用付得起的最大件數</div>
     <div class="modal-buttons"><button class="btn-close">關閉</button></div>`,
    { closeOnOverlay: true }
  );
  modal.querySelector('.btn-close').addEventListener('click', closeModal);
  $$('.tier-row:not(.locked)', modal).forEach((b) =>
    b.addEventListener('click', () => {
      setMultiplier(Number(b.dataset.count));
      saveGame();
      closeModal();
      renderChest();
    })
  );
}

/** 寶箱分頁：目前 / 下一級機率對照 */
function renderRateTable() {
  const rates = getChestRates(state.chestLevel);
  const isMax = state.chestLevel >= getChestMaxLevel();
  const next = isMax ? null : getChestRates(state.chestLevel + 1);

  const head = isMax
    ? `<tr><th>品階</th><th>${toCN(state.chestLevel)}階</th></tr>`
    : `<tr><th>品階</th><th>${toCN(state.chestLevel)}階</th><th>${toCN(state.chestLevel + 1)}階</th></tr>`;

  // 神品：21 階以上才出現（目前與下一階都是 0 時不顯示，避免飛升前多一列 0%）
  const rows = CONFIG.rarities
    .map((r, i) => {
      if (i === CONFIG.divineRarity && rates[i] <= 0 && !(next && next[i] > 0)) return '';
      let nextCell = '';
      if (next) {
        const d = next[i] - rates[i];
        let mark = '';
        if (d > 0.0001) mark = `<span class="rate-change up">▲</span>`;
        else if (d < -0.0001) mark = `<span class="rate-change dim">▼</span>`;
        nextCell = `<td class="${d > 0.0001 ? 'up' : ''}">${next[i].toFixed(4)}%${mark}</td>`;
      }
      return `<tr><td style="color:${r.color};font-weight:700">${r.name}</td><td>${rates[i].toFixed(4)}%</td>${nextCell}</tr>`;
    })
    .join('');
  $('#rate-table').innerHTML = `<table class="rate-table">${head}${rows}</table>`;
  renderUpgradeCost();
}

/** 強化條、下一格費用與按鈕狀態（強化條沒滿：強化一格；滿了：升階） */
function renderUpgradeCost() {
  const cost = getChestUpgradeCost();
  const box = $('#upgrade-cost');
  const btn = $button('#btn-upgrade');
  if (!cost) {
    const abs = getChestAbsoluteMaxLevel();
    const nextCap = CONFIG.chest.levelCaps.find((c) => c.max > state.chestLevel && !isFeatureOpen(c.feature));
    box.innerHTML =
      state.chestLevel >= abs || !nextCap
        ? `<span class="max-note">${ri('star')} 煉器爐已臻圓滿</span>`
        : `<span class="max-note">${ri('star')} 已達目前上限（${toCN(state.chestLevel)}階）</span><div class="seg-info">${getFeatureLockText(nextCap.feature)}</div>`;
    btn.classList.add('hidden');
    return;
  }
  btn.classList.remove('hidden');
  const n = getChestSegmentCount();
  const cells = Array.from({ length: n }, (_, i) => `<span class="seg-cell ${i < state.chestProgress ? 'full' : ''}"></span>`).join('');
  let html = `<div class="seg-bar" title="強化 ${state.chestProgress} / ${n} 格">${cells}</div>`;
  if (!isChestProgressFull()) {
    const gold = getChestSegmentCost();
    html += `<div class="seg-info">強化 ${state.chestProgress} / ${n} 格，填滿後才能升階</div>`;
    html += `<span class="cost-item ${state.gold < gold ? 'lack' : ''}">${ri('gold')} ${fmtNum(state.gold)} / ${fmtNum(gold)}</span>`;
    const iron = getChestSegmentIron();
    if (iron > 0) html += `<span class="cost-item ${state.materials.iron < iron ? 'lack' : ''}">${ri('iron')} ${fmtNum(state.materials.iron)} / ${fmtNum(iron)}</span>`;
    setHTML(btn, `強 化<span class="btn-sub">第 ${state.chestProgress + 1} 格</span>`);
    btn.disabled = !canFillChestSegment();
  } else {
    html += `<div class="seg-info">強化條已滿，可以升階！</div>`;
    if (cost.stones > 0) {
      html += `<span class="cost-item ${state.upgradeStones < cost.stones ? 'lack' : ''}">${ri('stones')} ${fmtNum(state.upgradeStones)} / ${fmtNum(cost.stones)}</span>`;
    }
    setHTML(btn, `升 階<span class="btn-sub">${toCN(state.chestLevel)}階 → ${toCN(state.chestLevel + 1)}階</span>`);
    btn.disabled = !canUpgradeChest();
  }
  box.innerHTML = html;
}

/** 升級特效 */
function playChestUpgradeEffect() {
  ['#chest-icon', '#chest-icon-2'].forEach((sel) => replayAnim($(sel), 'chest-up'));
}

// ---------- 自動開箱設定 ----------

/** 建立設定欄位並綁定事件 */
function initAutoSettingsUI() {
  const R = CONFIG.rarities;
  $('#set-target').innerHTML = R.slice(1)
    .map((r, i) => `<option value="${i + 1}">${i + 1 === R.length - 1 ? r.name : r.name + '以上'}</option>`)
    .join('');
  const affixOptions =
    '<option value="">不指定</option>' + Object.keys(CONFIG.subStats).map((k) => `<option value="${k}">${statName(k)}</option>`).join('');
  $('#set-affix1').innerHTML = affixOptions;
  $('#set-affix2').innerHTML = affixOptions;

  const bind = (sel, key, parse) => {
    const el = $select(sel);
    el.addEventListener('change', () => {
      state.autoOpenSettings[key] = parse(el.value);
      saveGame();
      renderAutoRule();
    });
  };
  bind('#set-target', 'targetRarity', Number);
  bind('#set-affix1', 'affix1', String);
  bind('#set-affix2', 'affix2', String);
  bind('#set-batch', 'batch', Number);
  bind('#set-speed', 'speed', Number);
  const better = /** @type {HTMLInputElement} */ ($('#set-better'));
  better.addEventListener('change', () => {
    state.autoOpenSettings.requireBetter = better.checked;
    saveGame();
    renderAutoRule();
  });
  syncAutoSettingsUI();
}

let autoBatchOptionsKey = '';

/** 件數下拉選單只列已解鎖的檔位（解鎖新檔位或月卡到期時重建） */
function refreshAutoBatchOptions() {
  const unlocked = getUnlockedMultipliers();
  const s = state.autoOpenSettings;
  if (!unlocked.includes(s.batch)) s.batch = Math.max(1, ...unlocked.filter((c) => c <= s.batch));
  const key = unlocked.join(',');
  const el = $select('#set-batch');
  if (key !== autoBatchOptionsKey) {
    autoBatchOptionsKey = key;
    el.innerHTML = unlocked.map((c) => `<option value="${c}">×${c}</option>`).join('');
  }
  el.value = String(s.batch);
}

/** 讀檔 / 重置後，讓設定欄位顯示目前設定 */
function syncAutoSettingsUI() {
  const s = state.autoOpenSettings;
  $select('#set-target').value = String(s.targetRarity);
  $select('#set-affix1').value = s.affix1;
  $select('#set-affix2').value = s.affix2;
  /** @type {HTMLInputElement} */ ($('#set-better')).checked = s.requireBetter;
  $select('#set-speed').value = String(s.speed);
  refreshAutoBatchOptions();
  renderAutoRule();
}

/** 自動開爐規則說明（畫面上寫清楚：不符合條件的一律分解） */
function renderAutoRule() {
  const s = state.autoOpenSettings;
  const R = CONFIG.rarities;
  const conds = [`<b style="color:${R[s.targetRarity].color}">${R[s.targetRarity].name}</b>以上`];
  if (s.affix1) conds.push(`帶有「${statName(s.affix1)}」`);
  if (s.affix2) conds.push(`帶有「${statName(s.affix2)}」`);
  if (s.requireBetter) conds.push('戰力高於目前裝備');
  let html = `${ri('scroll')}規則：煉出符合「${conds.join('、')}」的法寶時停止並跳出比較視窗；<b>其他法寶一律自動分解</b>成靈石。`;
  if (s.targetRarity >= 3) html += `<div class="auto-warn">${ri('lock')}目標品階較高：比身上強但品階較低的法寶也會被分解。</div>`;
  setHTML($('#auto-rule'), html);
}

/** 手動開箱動畫播放中（結果尚未揭曉） */
let chestRevealing = false;

/**
 * 開箱後的畫面處理（手動與自動共用）
 * 手動：寶箱搖晃 → 依最高品質發光 → 顯示結果與比較視窗
 * 自動：短暫搖晃與發光，立即顯示結果
 */
function handleChestOpened(result) {
  if (battleSilent) return;
  if (coachActive === 'welcome') dismissCoach();
  const maxRarity = Math.max(...result.items.map(getRarityIndex));
  const best = result.items.find((it) => getRarityIndex(it) === maxRarity);
  playChestOpenEffect(maxRarity, result.auto);
  if (!result.auto && maxRarity >= CONFIG.chestAnim.runeFromRarity) setTimeout(() => playRuneReveal(best, maxRarity), CONFIG.chestAnim.revealDelayMs - CONFIG.chestAnim.runeLeadMs);

  const reveal = () => {
    chestRevealing = false;
    playSound('reveal', maxRarity);
    showOpenResult(result);
    if (result.pityHits && result.pityHits.length > 0) {
      const names = result.pityHits.map((r) => `<b style="color:${CONFIG.rarities[r].color}">${CONFIG.rarities[r].name}</b>`).join('、');
      toast(`${ri('star')} 保底觸發：${names}`, CONFIG.fx.toast.long);
    }
    renderAll();
    // 手動一次開多件：先顯示彙整畫面，關閉後保留的法寶照原流程逐件比較
    if (!result.auto && result.items.length > 1 && !isModalOpen()) showOpenSummary(result);
    else showNextQueuedModal();
  };

  if (result.auto) {
    reveal();
  } else {
    chestRevealing = true;
    playSound('open');
    renderChest();
    // 品階越高演出越長：地品金光、天品符文陣、仙品再加專屬名稱；播完才跳出比較視窗
    setTimeout(reveal, getRevealDelay(maxRarity));
  }
}

/**
 * 開爐動畫：爐身震動、爐火竄起 → 依最高品階發光
 * 地品以上再放出金光（光芒旋轉 + 全螢幕金色閃光）
 */
function playChestOpenEffect(maxRarity, auto) {
  const color = CONFIG.rarities[maxRarity].color;
  const stage = $('#furnace-stage');
  const burnMs = auto ? CONFIG.chestAnim.autoBurnMs : CONFIG.chestAnim.revealDelayMs;
  stage.style.setProperty('--burn-ms', burnMs + 'ms');
  replayAnim($('#chest-icon'), auto ? 'shake-short' : 'shake');
  replayAnim(stage, 'burning');
  setTimeout(() => stage.classList.remove('burning'), burnMs + CONFIG.chestAnim.burnTailMs);

  const delay = auto ? 0 : Math.max(0, burnMs - CONFIG.chestAnim.glowLeadMs);
  setTimeout(() => {
    const glow = $('#chest-glow');
    glow.style.setProperty('--glow', color);
    glow.classList.toggle('big', maxRarity >= CONFIG.chestAnim.goldLightFromRarity);
    replayAnim(glow, 'burst');
    // 玄品：藍色光環；地品以上另有金光
    $('#furnace-stage').dataset.rarity = maxRarity;
    if (maxRarity >= 2) replayAnim($('#furnace-stage'), 'ring');
    if (maxRarity >= CONFIG.chestAnim.goldLightFromRarity) {
      replayAnim($('#gold-rays'), 'on');
      replayAnim($('#screen-flash'), 'on');
    }
  }, delay);
}

// ---------- 開箱結果摘要 ----------

/**
 * 一次開多件的彙整畫面：各品階件數、保留了哪幾件、分解得到多少靈石
 * （演出只有最高品階的那一件播放，見 handleChestOpened）
 */
function showOpenSummary(result) {
  const R = CONFIG.rarities;
  const counts = R.map((r, i) =>
    result.counts[i] > 0 ? `<div class="sum-count" style="color:${r.color}"><b>${result.counts[i]}</b><span>${r.name}</span></div>` : ''
  ).join('');
  const kept = (result.kept || [])
    .map((it) => `<div class="sum-kept" style="color:${getRarity(it).color}">${ri(CONFIG.slots[it.slot].icon)}${itemDisplayName(it)}</div>`)
    .join('');
  const modal = openModal(
    `<div class="modal-title">煉出 ${result.items.length} 件法寶</div>
     <div class="sum-counts">${counts}</div>
     <div class="sub-title">${ri('star')}保留 ${result.pendingCount} 件</div>
     <div class="sum-kept-list">${kept || '<div class="queue-hint">沒有比身上更好的法寶</div>'}</div>
     <div class="sum-salvage">分解 ${result.salvagedCount} 件，得 ${ri('gold')}<b>${fmtNum(result.salvageGold)}</b></div>
     <div class="modal-buttons"><button class="btn-primary btn-close">${result.pendingCount ? '逐件比較' : '確定'}</button></div>`
  );
  modal.querySelector('.btn-close').addEventListener('click', closeModal);
}

function showOpenResult(result) {
  const box = $('#open-result');
  const chips = CONFIG.rarities
    .map((r, i) =>
      result.counts[i] > 0 ? `<span class="rarity-chip" style="color:${r.color}">${r.name} ×${result.counts[i]}</span>` : ''
    )
    .join('');
  const lines = [];
  if (result.salvagedCount > 0) {
    lines.push(`分解 ${result.salvagedCount} 件，得 ${ri('gold')} <b>${fmtNum(result.salvageGold)}</b>`);
  }
  if (result.pendingCount > 0) {
    lines.push(`有 <b>${result.pendingCount}</b> 件${result.stopTriggered ? '符合目標的' : '更好的'}法寶！`);
  }
  box.innerHTML = `
    <div class="result-head">${result.auto ? ri('cycle') + '自動' : ''}煉出 ${result.items.length} 件法寶</div>
    <div class="result-counts">${chips}</div>
    ${lines.map((l) => `<div class="result-line">${l}</div>`).join('')}`;
  box.classList.remove('hidden');
  // 重新觸發動畫
  box.style.animation = 'none';
  void box.offsetWidth;
  box.style.animation = '';
}

