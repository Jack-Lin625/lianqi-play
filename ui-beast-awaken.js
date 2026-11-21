// @ts-check
/* =========================================================
 * ui-beast-awaken.js — 靈獸覺醒的畫面（B3，PLAN.md 2.25；從 ui-beast.js 分出）
 *   靈獸卡片上的覺醒區塊、覺醒確認視窗、覺醒演出、孵化區的「覺醒共鳴」一行
 * ========================================================= */

/** 共鳴加成文字（例如「攻擊、氣血 +4%」） */
function awakenResonanceText(n = getAwakenedCount()) {
  const r = getAwakenResonance(n);
  const label = { atkPct: '攻擊', hpPct: '氣血' };
  const keys = Object.keys(CONFIG.beasts.awaken.resonance);
  const pct = (v) => `+${Math.round(v * 1000) / 10}%`;
  const vals = [...new Set(keys.map((k) => r[k] || 0))];
  if (vals.length === 1) return `${keys.map((k) => label[k] || statName(k)).join('、')} ${pct(vals[0])}`;
  return keys.map((k) => `${label[k] || statName(k)} ${pct(r[k] || 0)}`).join('、');
}

/** 孵化區的覺醒共鳴一行（功能還沒開放時不顯示） */
function awakenResonanceHTML() {
  if (!isFeatureOpen('beastAwaken')) return '';
  const n = getAwakenedCount();
  return `<div class="hatch-count awaken-res">覺醒共鳴 <b>${n}</b> 隻：${n ? awakenResonanceText(n) : `每覺醒一隻 ${awakenResonanceText(1)}`}</div>`;
}

/** 靈獸卡片上的覺醒區塊（已覺醒：覺醒效果；可覺醒：按鈕；5 星但還沒開放：提示） */
function awakenCardHTML(key) {
  const o = state.beasts.owned[key];
  const aw = CONFIG.beasts.awaken;
  if (!o) return '';
  if (o.awakened) {
    const sk = aw.skills[key];
    return `<div class="awaken-info">
      <span class="enh-ms on">覺醒加成 ×${aw.scaleMult}</span>
      ${aw.opener ? '<span class="enh-ms on">先手</span>' : ''}
      ${sk ? `<span class="enh-ms on awaken-skill">${sk.name}：${sk.desc}</span>` : ''}
    </div>`;
  }
  if (o.star < CONFIG.beasts.starMax) return '';
  if (!isFeatureOpen('beastAwaken')) return `<div class="awaken-hint">${getCondText(getFeature('beastAwaken').cond)}後可以覺醒</div>`;
  const enough = state.beasts.essence >= aw.cost;
  return `<button class="btn-primary btn-awaken" data-awaken="${key}" ${enough ? '' : 'disabled'}>覺醒 ${ri('essence')}${fmtNum(aw.cost)}</button>`;
}

/** 綁定卡片上的覺醒按鈕 */
function bindAwakenButtons(panel) {
  $$('[data-awaken]', panel).forEach((el) => el.addEventListener('click', () => openAwakenConfirm(el.dataset.awaken)));
}

/** 覺醒確認視窗：消耗、覺醒前後的被動與技能倍率、覺醒技、先手、共鳴 */
function openAwakenConfirm(key) {
  const reason = getAwakenBlockReason(key);
  if (reason) return toast(reason);
  const aw = CONFIG.beasts.awaken;
  const sp = CONFIG.beasts.species[key];
  const o = state.beasts.owned[key];
  const woke = { ...o, awakened: true };
  const atkBefore = getBeastAttack(key);
  const atkAfter = getBeastAttack(key, woke);
  const n = getAwakenedCount();
  const sk = aw.skills[key];
  const oldEffect = CONFIG.beasts.starSkills.effects[key];
  const modal = openModal(`
    <div class="modal-title">${ri('star')}靈獸覺醒・${sp.name}</div>
    <div class="awaken-big" style="color:${CONFIG.rarities[o.rarity].color}">${icon(sp.icon)}</div>
    <div class="awaken-rows">
      <div><span>被動（上陣時）</span><b>${beastPassiveText(getBeastPassive(key))} → ${beastPassiveText(getBeastPassive(key, woke))}</b></div>
      <div><span>技能（上陣時）</span><b>${atkBefore.name} ${atkBefore.mult.toFixed(1)} 倍 → ${atkAfter.name} ${atkAfter.mult.toFixed(1)} 倍</b></div>
      ${sk ? `<div><span>覺醒技</span><b>${oldEffect ? `${oldEffect.desc} → ` : ''}${sk.desc}</b></div>` : ''}
      ${aw.opener ? '<div><span>先手（上陣時）</span><b>每場戰鬥一開始立刻出手一次</b></div>' : ''}
      <div><span>覺醒共鳴（不必上陣）</span><b>${n ? awakenResonanceText(n) : '無'} → ${awakenResonanceText(n + 1)}</b></div>
    </div>
    <div class="awaken-cost">消耗 ${ri('essence')}靈獸精魄 ${fmtNum(aw.cost)}（目前 ${fmtNum(state.beasts.essence)}）。覺醒是永久的，飛升不會重置。</div>
    <div class="modal-buttons">
      <button class="btn-secondary" data-act="cancel">再想想</button>
      <button class="btn-equip" data-act="ok">覺 醒</button>
    </div>
  `);
  modal.querySelector('[data-act="cancel"]').addEventListener('click', closeModal);
  modal.querySelector('[data-act="ok"]').addEventListener('click', () => {
    const res = awakenBeast(key);
    closeModal();
    if (!res.ok) return toast(res.error);
    playSound('upgrade');
    replayAnim($('#screen-flash'), 'on');
    toast(`${ri('star')} ${sp.name}覺醒！${sp.skill.name} → ${sk ? sk.name : sp.skill.name}`, CONFIG.fx.toast.long);
    saveGame();
    renderAll();
    renderBeasts(true);
  });
}
