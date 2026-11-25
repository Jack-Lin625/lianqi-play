// @ts-check
/* =========================================================
 * ui-beast-pact.js — 魂契與召喚麒麟的畫面（v1.1 V3，PLAN.md 2.30）
 *   孵化區的魂契一行（升一級、全部升級）、圖鑑麒麟格的召喚按鈕與確認視窗
 * ========================================================= */

/** 魂契加成文字（例如「攻擊、氣血 +12%」） */
function pactBonusText(level = getPactLevel()) {
  const b = getPactBonus(level);
  const label = { atkPct: '攻擊', hpPct: '氣血' };
  const keys = Object.keys(CONFIG.beasts.soulPact.perLevel);
  const pct = (v) => `+${Math.round(v * 1000) / 10}%`;
  const vals = [...new Set(keys.map((k) => b[k] || 0))];
  if (vals.length === 1) return `${keys.map((k) => label[k] || statName(k)).join('、')} ${pct(vals[0])}`;
  return keys.map((k) => `${label[k] || statName(k)} ${pct(b[k] || 0)}`).join('、');
}

/** 孵化區的魂契區塊（靈獸覺醒開放前不顯示；魂契還沒開放時只顯示開放條件） */
function soulPactHTML() {
  if (!isFeatureOpen('beastAwaken')) return '';
  if (!isFeatureOpen('soulPact')) return `<div class="hatch-count pact-line locked">${ri('lock')}魂契：${getCondText(getFeature('soulPact').cond)}後開放</div>`;
  const lv = getPactLevel();
  const cost = getPactCost();
  const enough = state.beasts.essence >= cost;
  return `<div class="pact-row">
    <div class="hatch-count pact-line">魂契 第 <b>${lv}</b> 級：${lv ? pactBonusText(lv) : `每一級 ${pactBonusText(1)}`}</div>
    <div class="pact-btns">
      <button class="btn-primary pact-btn" data-pact="one" ${enough ? '' : 'disabled'}>締結第 ${lv + 1} 級 ${ri('essence')}${cost.toLocaleString()}</button>
      <button class="btn-secondary pact-btn" data-pact="all" ${enough ? '' : 'disabled'}>全部升級</button>
    </div>
  </div>`;
}

/** 圖鑑裡還沒擁有麒麟時的召喚按鈕（魂契開放後才出現） */
function qilinSummonHTML(key) {
  const q = CONFIG.beasts.qilinSummon;
  if (key !== q.key || state.beasts.owned[key] || !isFeatureOpen('soulPact')) return '';
  const enough = state.beasts.essence >= q.cost;
  return `<button class="btn-primary btn-summon" data-summon="${key}" ${enough ? '' : 'disabled'}>召喚 ${ri('essence')}${q.cost.toLocaleString()}</button>`;
}

/** 綁定魂契與召喚按鈕 */
function bindPactButtons(panel) {
  $$('[data-pact]', panel).forEach((el) => el.addEventListener('click', () => onPact(el.dataset.pact === 'all')));
  $$('[data-summon]', panel).forEach((el) => el.addEventListener('click', () => openQilinSummonConfirm()));
}

/** 升魂契（一級或全部） */
function onPact(all) {
  const before = getPactLevel();
  const res = all ? upgradePactAll() : upgradePact();
  if (!res.ok) return toast(res.error);
  const lv = getPactLevel();
  playSound('upgrade');
  toast(`${ri('star')} 魂契 第 ${before} → ${lv} 級：${pactBonusText(lv)}`);
  saveGame();
  renderAll();
  renderBeasts(true);
}

/** 召喚麒麟的確認視窗：消耗、得到的靈獸、之後升星與覺醒的精魄 */
function openQilinSummonConfirm() {
  const reason = getQilinSummonBlockReason();
  if (reason) return toast(reason);
  const q = CONFIG.beasts.qilinSummon;
  const b = CONFIG.beasts;
  const sp = b.species[q.key];
  const rarity = CONFIG.rarities[q.rarity];
  const later = b.starCost.reduce((s, x) => s + x, 0) + b.awaken.cost;
  const modal = openModal(`
    <div class="modal-title">${ri('star')}召喚・${sp.name}</div>
    <div class="awaken-big" style="color:${rarity.color}">${icon(sp.icon)}</div>
    <div class="awaken-rows">
      <div><span>得到</span><b style="color:${rarity.color}">${rarity.name}・${sp.name}（1 星）</b></div>
      <div><span>被動（上陣時）</span><b>${beastPassiveText(getBeastPassive(q.key, { rarity: q.rarity, star: 1, awakened: false }))}</b></div>
      <div><span>之後</span><b>照常升星、覺醒（合計 ${ri('essence')}${later.toLocaleString()}）</b></div>
    </div>
    <div class="awaken-cost">消耗 ${ri('essence')}靈獸精魄 ${q.cost.toLocaleString()}（目前 ${state.beasts.essence.toLocaleString()}）。每個角色只能召喚一次（已經有${sp.name}就不能召喚）。</div>
    <div class="modal-buttons">
      <button class="btn-secondary" data-act="cancel">再想想</button>
      <button class="btn-equip" data-act="ok">召 喚</button>
    </div>
  `);
  modal.querySelector('[data-act="cancel"]').addEventListener('click', closeModal);
  modal.querySelector('[data-act="ok"]').addEventListener('click', () => {
    const res = summonQilin();
    closeModal();
    if (!res.ok) return toast(res.error);
    playSound('hatch', q.rarity);
    replayAnim($('#screen-flash'), 'on');
    toast(`${ri('star')} ${rarity.name}・${sp.name}應召而來！`, CONFIG.fx.toast.long);
    saveGame();
    renderAll();
    renderBeasts(true);
  });
}
