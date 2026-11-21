// @ts-check
/* =========================================================
 * ui-pity.js — 開爐保底進度（修煉頁開爐按鈕下方、煉器爐分頁機率表下方）
 * ========================================================= */

function renderPity() {
  const list = getPityStatus();
  const cell = (p, compact) => {
    const r = CONFIG.rarities[p.rarity];
    const name = p.rarity === CONFIG.rarities.length - 1 ? r.name : `${r.name}以上`;
    if (!p.active && p.rarity === CONFIG.divineRarity && !isFeatureOpen('chestBeyond')) return ''; // 神品：開放前不顯示
    if (!p.active) return `<span class="pity-item off">${name}：目前爐階不會出現</span>`;
    const left = p.count - p.progress;
    return `<span class="pity-item" style="--c:${r.color}">
      <span class="pity-name">${name}</span>
      ${compact ? '' : `<span class="pity-bar"><span style="width:${(p.progress / p.count) * 100}%"></span></span>`}
      <span class="pity-num">${p.progress}/${p.count}</span>${compact ? '' : `<small>再 ${left} 件必出</small>`}
    </span>`;
  };
  setHTML($('#pity-bar'), `<span class="pity-title">保底</span>${list.filter((p) => p.active).map((p) => cell(p, true)).join('')}`);
  setHTML(
    $('#pity-detail'),
    `<div class="sub-title">${icon('star')}保底進度<small class="daily-reset">以件數計算，跨天保留</small></div>
     ${list.map((p) => cell(p, false)).join('')}
     <div class="queue-hint">連續開出指定件數都沒有該品階以上時，下一件必定是該品階。開出就歸零。</div>`
  );
}
