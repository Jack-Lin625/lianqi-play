// @ts-check
/* =========================================================
 * ui-ascend.js — 飛升頁（修士 → 飛升）、飛升確認視窗、演出、主畫面提示（路線圖 B1，PLAN.md 2.22）
 *   狀態、預覽（現在飛升可得／再推到第 Y 關可得）、下一輪天劫層數、飛升按鈕與冷卻倒數、
 *   本輪降低天劫、飛升天賦、天劫里程碑與神品自選（B2）、之後開放的內容（B3 實作前顯示「即將開放」）、飛升紀錄
 * ========================================================= */

/** 飛升頁上選的下一輪天劫層數（不存檔；超過上限時自動夾住） */
let ascendTierPick = 0;

/** 飛升後不會重置的項目（確認視窗與說明共用） */
const ASCEND_KEEP_LIST = [
  '法寶（身上與待決定）、爐階與升爐格、強化等級、詞條洗練',
  '道途（路線、轉數、天賦）、靈獸（品階、星數、上陣、羈絆）',
  '仙玉、玄鐵、精魄、靈獸蛋、信箱、外觀、儲值紀錄',
  '戰令、成就、圖鑑、每日／每週任務與活躍度、月曆簽到、秘境與鎮妖塔紀錄',
  '已開放的功能、開爐件數檔位（不會重新上鎖）；章節首殺與 Boss 首殺不會重複領',
];

/** 天劫層數的說明文字（妖獸倍率、仙元倍率） */
function tierEffectText(t) {
  const c = CONFIG.ascension.tribulation;
  return `妖獸${tribulationMultText(t)}・仙元 ×${(1 + c.pointsPerTier * t).toFixed(1)}`;
}

/** 之後開放的內容（第 n 次飛升；還沒實作的標「即將開放」，B3 後全部已實作） */
function ascendUnlocksHTML() {
  const u = CONFIG.ascension.unlocks;
  const n = state.ascension.count;
  const rows = [
    { at: u.talents, name: '飛升天賦', ready: true },
    { at: u.chestTier25, name: '爐階 21～25、新品階「神品」', ready: true },
    { at: u.beastAwaken, name: '靈獸覺醒（5 星靈獸覺醒，換覺醒技）', ready: true },
    { at: u.chestTier30, name: '爐階 26～30', ready: true },
    { at: u.divineRefine, name: '神品煉化（分解神品得神髓，替部位煉化升星）', ready: true },
    { at: u.soulPact, name: '魂契（精魄升級，攻擊、氣血每級 +1%）、精魄召喚麒麟', ready: true },
  ];
  return rows
    .map((r) => {
      const reached = n >= r.at;
      const tag = r.ready ? (reached ? '已開放' : `還差 ${r.at - n} 次`) : reached ? '即將開放（下次更新）' : `還差 ${r.at - n} 次・即將開放`;
      return `<li class="${reached ? 'done' : ''}">第 ${r.at} 次飛升：${r.name}<small>${tag}</small></li>`;
    })
    .join('');
}

/** 天劫里程碑：第一次在天劫 N 重以上打倒最終 Boss 的獎勵（B2） */
function tierMilestonesHTML() {
  const a = state.ascension;
  return CONFIG.ascension.tierMilestones
    .map((m) => {
      const done = a.tierRewards.includes(m.tier);
      return `<li class="${done ? 'done' : ''}">天劫 ${m.tier} 重打倒最終 Boss：${rewardSpecHTML(m.reward)}<small>${done ? '已領取' : '未達成'}</small></li>`;
    })
    .join('');
}

/** 神品自選（天劫 12 重里程碑）：六個部位選一個 */
function divinePickHTML() {
  const n = state.ascension.divinePicks || 0;
  if (!n) return '';
  const btns = CONFIG.slotOrder
    .map((s) => {
      const d = GEAR_DATA && (GEAR_DATA.divines || []).find((m) => m.slot === s);
      return `<button class="btn-secondary asc-divine" data-divine="${s}">${CONFIG.slots[s].name}${d ? `<small>${d.name}</small>` : ''}</button>`;
    })
    .join('');
  return `<div class="card asc-divine-card"><div class="sub-title">${ri('star')}神品自選<small class="daily-reset">還可以選 ${n} 件</small></div>
    <div class="queue-hint">選一個部位，得到該部位的神品專屬法寶（等級照目前的法寶等級）。</div>
    <div class="asc-divine-row">${btns}</div></div>`;
}

/** 一個飛升天賦的卡片 */
function ascTalentCardHTML(t) {
  const lv = getAscTalentLevel(t.id);
  const cost = getAscTalentCost(t.id);
  const open = isAscTalentOpen();
  const kind = { stat: '屬性', resource: '資源', convenience: '便利' }[t.kind] || '';
  const maxText = t.max !== undefined ? ` / ${t.max}` : '';
  let btn;
  if (!cost) btn = `<span class="talent-chosen">${ri('star')}已滿級</span>`;
  else if (!open) btn = `<button class="btn-secondary" disabled>第 ${CONFIG.ascension.unlocks.talents} 次飛升後開放</button>`;
  else {
    const lack = state.ascension.points < cost;
    btn = `<button class="btn-secondary asc-buy" data-asc-talent="${t.id}" ${lack ? 'disabled' : ''}>提升 仙元 ${cost}</button>`;
  }
  return `<div class="talent-card asc-talent">
    <div class="talent-name">${t.name}<small class="asc-lv">${kind}・${lv}${maxText} 級</small></div>
    <div class="talent-desc">目前：${lv ? getAscTalentText(t, lv) : '—'}</div>
    ${cost ? `<div class="talent-good">下一級：${getAscTalentText(t, lv + 1)}</div>` : ''}
    ${btn}
  </div>`;
}

/**
 * 飛升頁
 * @param {boolean} force 不在飛升頁時也強制重繪
 */
function renderAscend(force = false) {
  const page = document.querySelector('.tab-page[data-page="ascend"]');
  if (!page || (!force && !page.classList.contains('active'))) return;
  const panel = $('#ascend-panel');
  const c = CONFIG.ascension;
  const a = state.ascension;
  if (!isFeatureOpen('ascension')) {
    setHTML(panel, `<div class="card dao-locked"><div class="dao-big">${icon('lotus')}</div><div class="dao-title">飛升未開</div>
      <p><b>${getCondText(getFeature('ascension').cond)}</b>後開放。</p></div>`);
    return;
  }
  const cap = getTierCap();
  ascendTierPick = Math.max(0, Math.min(cap, ascendTierPick));
  const pv = getAscendPreview();
  const reason = getAscendBlockReason();
  const cd = getAscendCooldownLeft();
  const h = state.stage.highest;
  const lowered = a.minTierThisRun !== a.tier;
  const nextLine = pv.next
    ? `再推到 <b>${formatStage(pv.next.stage)}</b> 可得 <b>${pv.next.points}</b> 仙元${pv.next.final ? '（含打倒最終 Boss 大獎）' : ''}`
    : '本輪已打倒最終 Boss，仙元已是這一層的最高';
  const tierNote = `仙元依本輪用過的<b>最低天劫層數（${pv.tier} 重）</b>計算${lowered ? '（本輪中途降過層）' : ''}`;
  const estimate = h >= c.gate ? getAscendPoints(h, ascendTierPick) : 0;
  const lowerOptions = [];
  for (let t = 0; t < a.tier; t++) lowerOptions.push(`<button class="btn-secondary asc-lower" data-lower="${t}">降到 ${t} 重</button>`);
  const history = a.history
    .slice(0, 5)
    .map((x, i) => `<li>第 ${a.count - i} 次：${formatStage(x.highest)}・天劫 ${x.tier} 重・仙元 +${x.got}</li>`)
    .join('');
  setHTML(
    panel,
    `<div class="card asc-status">
      <div class="sub-title">${icon('lotus')}飛升<small class="daily-reset">第 ${a.count} 次</small></div>
      <div class="asc-grid">
        <div>仙元<b id="asc-points">${a.points}</b></div>
        <div>歷史最高<b>${getBestStage() ? formatStage(getBestStage()) : '—'}</b></div>
        <div>本輪最高<b>${h ? formatStage(h) : '—'}</b></div>
        <div>本輪天劫<b>${a.tier} 重</b></div>
        <div>最高天劫紀錄<b>${a.maxClearedTier >= 0 ? `${a.maxClearedTier} 重` : '—'}</b></div>
        <div>打倒最終 Boss<b>${a.bestFinalTier >= 0 ? `天劫 ${a.bestFinalTier} 重` : '—'}</b></div>
        <div>可選上限<b>${cap} 重</b></div>
      </div>
    </div>
    <div class="card asc-preview">
      <div class="sub-title">${ri('star')}飛升預覽</div>
      <div class="asc-now">${h >= c.gate ? `現在飛升可得 <b>${pv.now}</b> 仙元` : `本輪通過 ${formatStage(c.gate)}後才能飛升`}</div>
      <div class="asc-next">${nextLine}</div>
      <div class="queue-hint">${tierNote}</div>
      <div class="asc-tier">
        <div class="asc-tier-head">下一輪天劫</div>
        <div class="asc-tier-row">
          <button class="btn-secondary asc-tier-btn" data-tier-step="-1" ${ascendTierPick <= 0 ? 'disabled' : ''}>−</button>
          <b class="asc-tier-val">${ascendTierPick} 重</b>
          <button class="btn-secondary asc-tier-btn" data-tier-step="1" ${ascendTierPick >= cap ? 'disabled' : ''}>＋</button>
        </div>
        <div class="queue-hint">${tierEffectText(ascendTierPick)}${ascendTierPick ? `：下一輪妖獸是第 1 輪的${tribulationMultText(ascendTierPick)}，打不過可以在本頁降層` : ''}</div>
        <div class="queue-hint">上限 = 曾經本輪通過 ${formatStage(c.gate)}的最高層數 + ${c.tribulation.aboveCleared}；飛升後本輪只能降層、不能升層</div>
        ${ascendTierPick && h >= c.gate ? `<div class="queue-hint">用這一層、照本輪最高關卡估算：${estimate} 仙元（實際在下一輪結束時依下一輪的進度計算）</div>` : ''}
      </div>
      <button class="btn-primary asc-btn" id="btn-ascend" ${reason ? 'disabled' : ''}>
        飛 升<span class="btn-sub" id="asc-reason">${reason || `+${pv.now} 仙元・下一輪從${formatStage(getAscStartStage())}開始`}</span>
      </button>
      ${cd > 0 ? `<div class="asc-cooldown">冷卻 <b id="asc-countdown">${formatDuration(cd)}</b> 後可飛升</div>` : ''}
    </div>
    ${a.tier > 0 ? `<div class="card"><div class="sub-title">${ri('lightning')}本輪天劫 ${a.tier} 重<small class="daily-reset">${tierEffectText(a.tier)}</small></div>
      <div class="queue-hint">打不過可以降層（立即生效、不能再升回來）；仙元改用降層後的層數計算。</div>
      <div class="asc-lower-row">${lowerOptions.join('')}</div></div>` : ''}
    ${divinePickHTML()}
    <div class="card">
      <div class="sub-title">${ri('taiji')}飛升天賦<small class="daily-reset">仙元 ${a.points}</small></div>
      <div class="talent-row">${c.talents.map(ascTalentCardHTML).join('')}</div>
    </div>
    <div class="card">
      <div class="sub-title">${ri('lightning')}天劫里程碑<small class="daily-reset">每一層只發一次</small></div>
      <ul class="asc-unlocks">${tierMilestonesHTML()}</ul>
    </div>
    <div class="card">
      <div class="sub-title">${ri('scroll')}飛升後開放</div>
      <ul class="asc-unlocks">${ascendUnlocksHTML()}</ul>
      ${history ? `<div class="sub-title">${ri('book')}飛升紀錄</div><ul class="asc-history">${history}</ul>` : ''}
    </div>`
  );
  if (boundElements.has(panel)) return;
  boundElements.add(panel);
  panel.addEventListener('click', (e) => {
    const el = /** @type {HTMLElement} */ (e.target).closest('button');
    if (!el || /** @type {HTMLButtonElement} */ (el).disabled) return;
    if (el.dataset.tierStep) {
      ascendTierPick += Number(el.dataset.tierStep);
      playSound('click');
      renderAscend(true);
    } else if (el.dataset.ascTalent) {
      const r = buyAscTalent(el.dataset.ascTalent);
      if (!r.ok) return toast(r.error);
      playSound('upgrade');
      saveGame();
      renderAll();
      renderAscend(true);
    } else if (el.dataset.divine) {
      const r = pickDivine(/** @type {Slot} */ (el.dataset.divine));
      if (!r.ok) return toast(r.error);
      playSound('reward');
      saveGame();
      renderAll();
      renderAscend(true);
      showNextQueuedModal(); // 待決定佇列：跳比較視窗
    } else if (el.dataset.lower !== undefined) {
      onLowerTier(Number(el.dataset.lower));
    } else if (el.id === 'btn-ascend') {
      showAscendConfirm();
    }
  });
}

/** 降低本輪天劫（二次確認） */
async function onLowerTier(t) {
  const ok = await askConfirm(`把本輪天劫從 ${state.ascension.tier} 重降到 <b>${t} 重</b>？<br>妖獸立即變弱，但本輪的仙元改用 ${t} 重計算，而且本輪不能再升回來。`, { okText: '降低天劫' });
  if (!ok) return;
  const r = lowerTier(t);
  if (!r.ok) return toast(r.error);
  toast(`本輪天劫降為 ${t} 重`);
  saveGame();
  renderAll();
  renderAscend(true);
}

/** 飛升確認視窗：會得到的仙元、會重置／不會重置、先去花資源的捷徑、按兩次確定 */
function showAscendConfirm() {
  const reason = getAscendBlockReason();
  if (reason) return toast(reason);
  const pv = getAscendPreview();
  const r = getAscendResetInfo();
  const t = ascendTierPick;
  const modal = openModal(
    `<div class="modal-title">${ri('lotus')}第 ${state.ascension.count + 1} 次飛升</div>
     <div class="asc-confirm-got">得到 <b>${pv.now}</b> 仙元（天劫 ${pv.tier} 重計算）・下一輪天劫 <b>${t} 重</b>（${tierEffectText(t)}）</div>
     ${t ? `<div class="asc-warn">${ri('lightning')}下一輪的妖獸是第 1 輪的${tribulationMultText(t)}；打不過可以在飛升頁降層。</div>` : ''}
     ${ascendBonusNotes(state.ascension.count + 1)}
     <div class="sub-title">會重置</div>
     <ul class="asc-list reset">
       <li>主線關卡回到 <b>${formatStage(r.startStage)}</b>（Boss 戰意歸零）</li>
       <li>靈石 ${fmtNum(r.gold)} → <b>${fmtNum(r.goldAfter)}</b>（失去 ${fmtNum(r.gold - r.goldAfter)}）</li>
       <li>爐火符 ${fmtNum(r.keys)} → <b>${fmtNum(r.keysAfter)}</b>（失去 ${fmtNum(r.keys - r.keysAfter)}）</li>
     </ul>
     <div class="asc-spend">還有靈石或爐火符？先花掉再飛升：
       <div class="btn-row">
         <button class="btn-secondary" data-asc-go="chest">升爐</button>
         <button class="btn-secondary" data-asc-go="enhance">強化</button>
         <button class="btn-secondary" data-asc-go="main">開爐</button>
       </div>
     </div>
     <div class="sub-title">不會重置</div>
     <ul class="asc-list keep">${ASCEND_KEEP_LIST.map((x) => `<li>${x}</li>`).join('')}</ul>
     <div class="queue-hint">飛升前會自動備份存檔，可以在「設定 → 存檔」還原。下次飛升要等 ${CONFIG.ascension.cooldownHours} 小時。</div>
     <div class="modal-buttons">
       <button class="btn-close">取消</button>
       <button class="btn-danger-solid" id="btn-ascend-ok">確定飛升</button>
     </div>`
  );
  modal.querySelector('.btn-close').addEventListener('click', closeModal);
  $$('[data-asc-go]', modal).forEach((b) =>
    b.addEventListener('click', () => {
      closeModal();
      switchTab(b.dataset.ascGo);
    })
  );
  const ok = /** @type {HTMLButtonElement} */ (modal.querySelector('#btn-ascend-ok'));
  let armed = false;
  ok.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      ok.textContent = '真的要飛升嗎？';
      return;
    }
    closeModal();
    doAscend(t);
  });
}

/** 第 n 次飛升會額外得到的東西（確認視窗用）：神品賀禮、境界圖鑑套組啟動 */
function ascendBonusNotes(n) {
  const notes = [];
  const gift = CONFIG.ascension.divineGift;
  if (gift && n === gift.at) notes.push(`${ri('seal')}這次飛升會得到一件<b>神品法寶</b>（部位隨機）`);
  if (n === (CONFIG.gear.codexSets.realmMinAscensions || 0)) notes.push(`${ri('book')}境界的<b>圖鑑套組加成</b>開始生效（${codexRealmBonusText()}）`);
  return notes.length ? `<ul class="asc-list keep">${notes.map((x) => `<li>${x}</li>`).join('')}</ul>` : '';
}

/** 目前收集齊的境界套組加起來的加成文字 */
function codexRealmBonusText() {
  const sets = getCodexSetStatus().filter((g) => g.minAsc > 0 && g.done);
  if (!sets.length) return '目前還沒有收集齊任何一個境界';
  const b = CONFIG.gear.codexSets.realm;
  return `已收集齊 ${sets.length} 個境界：攻擊、氣血各 +${Math.round(b.atkPct * sets.length * 100)}%`;
}

/** 執行飛升與演出 */
function doAscend(tier) {
  const r = ascend(tier);
  if (!r.ok) return toast(r.error || '無法飛升');
  ascendTierPick = state.ascension.tier;
  setBattleHint(''); // 上一輪的 Boss 機制提示
  saveGame();
  replayAnim($('#screen-flash'), 'on');
  const extra = [];
  if (r.giftItems && r.giftItems.length) extra.push(`獲得神品「${r.giftItems.map((it) => itemDisplayName(it)).join('、')}」`);
  if (r.codexActivated) extra.push(`圖鑑套組加成啟動（${codexRealmBonusText()}）`);
  const sub = `仙元 +${r.got}・從${formatStage(r.startStage)}重新修煉${tier ? `・天劫 ${tier} 重` : ''}`;
  playCeremony({ kind: 'ascend', title: `第 ${r.count} 次飛升`, subtitle: extra.length ? `${sub}<br>${extra.join('<br>')}` : sub });
  renderAll();
  switchTab('main');
  if (r.count === CONFIG.ascension.unlocks.talents) setTimeout(() => toast(`${ri('taiji')} 飛升天賦已開放：到「修士 → 飛升」用仙元提升`, CONFIG.fx.toast.long), CONFIG.fx.ceremonyMs);
}

/** 每秒：冷卻倒數（只改數字，不整頁重繪）；倒數結束時重繪 */
function tickAscendCountdown() {
  const el = document.querySelector('#asc-countdown');
  if (!el) return;
  const left = getAscendCooldownLeft();
  if (left > 0) el.textContent = formatDuration(left);
  else {
    renderAscend(true);
    renderTabNotices();
  }
}

/** 主畫面：可以飛升時的提示、天劫層數 */
function renderAscendBadge() {
  const badge = $('#ascend-badge');
  if (!badge) return;
  const show = !dungeonRun.active && isFeatureOpen('ascension') && canAscend();
  badge.classList.toggle('hidden', !show);
  if (show) setHTML(badge, `${ri('lotus')}可飛升：+${getAscendPreview().now} 仙元`);
}

/** 天劫層數標籤（關卡名稱旁；0 層不顯示） */
function tribulationTag() {
  const t = state.ascension.tier;
  return t > 0 ? `<small class="trib-tag">天劫 ${t} 重</small>` : '';
}

/** 設定頁：還原飛升前的存檔 */
async function onRestoreAscendBackup() {
  const b = getAscendBackup();
  if (!b) return toast('沒有飛升前的備份');
  const when = new Date(b.at).toLocaleString();
  if (!(await askConfirm(`還原到第 ${b.count + 1} 次飛升前（${when}）的存檔？<br>之後的進度都會消失。`, { okText: '還原', danger: true }))) return;
  const res = importSave(b.data);
  if (!res.ok) return toast(res.error || '還原失敗');
  onStateReplaced();
  toast('已還原飛升前的存檔');
}

/** 設定頁的「還原飛升前的存檔」按鈕狀態 */
function renderAscendBackupButton() {
  const btn = $button('#btn-asc-restore');
  if (!btn) return;
  const b = getAscendBackup();
  btn.disabled = !b;
  setHTML($('#asc-restore-note'), b ? `最近一次：第 ${b.count + 1} 次飛升前（${new Date(b.at).toLocaleString()}）` : '還沒有飛升過');
}
