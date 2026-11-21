// @ts-check
/* =========================================================
 * ui-offline.js — 「閉關歸來」視窗（離線收益）
 *   從 ui.js 拆出。雙倍領取免費時（CONFIG.offline.doubleCost = 0）只顯示一個領取按鈕，直接套用 doubleMult。
 * ========================================================= */

/** 雙倍領取的說明文字（依 CONFIG.offline.doubleMult：例如「爐火符雙倍」） */
function doubleLabel() {
  const m = CONFIG.offline.doubleMult;
  if (m.gold > 1 && m.keys > 1) return '雙倍';
  return m.keys > 1 ? '爐火符雙倍' : '靈石雙倍';
}

function showOfflineReward() {
  const r = state.offlineReward;
  if (!r) return;
  const cfg = CONFIG.offline;
  const h = Math.floor(r.minutes / 60);
  const m = r.minutes % 60;
  const capped = r.minutes >= getOfflineMaxHours() * 60;
  const empty = r.gold === 0 && r.keys === 0;
  const freeDouble = cfg.doubleCost <= 0;
  const lackStones = state.upgradeStones < cfg.doubleCost;

  let body;
  if (r.anomaly) {
    body = `<div class="retreat-time">天時紊亂</div>
      <div class="offline-time">偵測到裝置時間比上次離開時還早（可能調整過時間），<br>本次閉關沒有收益。</div>`;
  } else {
    const mult = freeDouble ? cfg.doubleMult : { gold: 1, keys: 1 };
    body = `<div class="retreat-time">閉關 ${h > 0 ? `<b>${h}</b> 小時 ` : ''}<b>${m}</b> 分</div>
      ${capped ? `<div class="offline-time">已達上限，最多累積 ${getOfflineMaxHours()} 小時</div>` : ''}
      <div class="reward-row"><span>${ri('gold')}+${fmtNum(r.gold * mult.gold)}</span><span>${ri('keys')}+${r.keys * mult.keys}</span></div>
      ${freeDouble && !empty ? `<div class="buff-on">${ri('star')}福利：${doubleLabel()}免費</div>` : ''}
      <div class="queue-hint">${
        r.basis === 'online'
          ? `靈石：最近在線時每分鐘平均產出的 ${Math.round(cfg.goldRatio * 100)}%；爐火符：每 ${cfg.minutesPerKey} 分鐘 ${scaleKeyIncome(cfg.keysPerInterval)} 張（隨境界成長）`
          : `靈石依目前境界估算；多在線修煉一段時間會更準確。爐火符：每 ${cfg.minutesPerKey} 分鐘 ${scaleKeyIncome(cfg.keysPerInterval)} 張（隨境界成長）`
      }</div>`;
  }

  let buttons;
  if (r.anomaly || empty) buttons = `<button class="btn-equip" id="btn-claim">${r.anomaly ? '知道了' : '領取'}</button>`;
  else if (freeDouble) buttons = `<button class="btn-equip" id="btn-claim-double">領取（${doubleLabel()}）</button>`;
  else
    buttons = `<button class="btn-salvage" id="btn-claim-double" ${lackStones ? 'disabled' : ''}>${doubleLabel()} ${ri('stones')}×${cfg.doubleCost}</button>
      <button class="btn-equip" id="btn-claim">領取</button>`;

  const modal = openModal(`
    <div class="retreat">
      <div class="retreat-figure">${icon('meditate')}</div>
      <div class="modal-title">閉關歸來</div>
      ${body}
    </div>
    <div class="modal-buttons">${buttons}</div>
  `);
  modal.classList.add('retreat-modal');

  const claim = (double) => {
    const got = claimOfflineReward(double);
    if (!got) {
      toast('仙玉不足');
      return;
    }
    if (!r.anomaly && !empty) {
      playSound('reward');
      toast(`領取 ${ri('gold')}+${fmtNum(got.gold)} ${ri('keys')}+${got.keys}`);
    }
    saveGame();
    closeModal();
    renderAll();
  };
  const single = modal.querySelector('#btn-claim');
  if (single) single.addEventListener('click', () => claim(false));
  const dbl = modal.querySelector('#btn-claim-double');
  if (dbl) dbl.addEventListener('click', () => claim(true));
}
