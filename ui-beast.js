// @ts-check
/* =========================================================
 * ui-beast.js — 靈獸分頁（從 ui.js 拆出，第五階段 6-4 加入羈絆與升星技能）
 *   孵化、上陣欄位、羈絆一覽（生效中的亮起）、靈獸卡片（升星技能 2／4 星）
 *   覺醒（B3）的卡片區塊、確認視窗、覺醒共鳴在 ui-beast-awaken.js
 * ========================================================= */

/** 星數顯示 ★★★☆☆ */
function starsHTML(star) {
  const max = CONFIG.beasts.starMax;
  return `<span class="stars">${'★'.repeat(star)}<span class="stars-empty">${'☆'.repeat(max - star)}</span></span>`;
}

/** 被動加成文字 */
function beastPassiveText(passive) {
  const label = { atkPct: '攻擊', hpPct: '氣血', defPct: '護體', critRate: '會心率', spd: '身法', goldPct: '靈石掉落' };
  return Object.entries(passive)
    .map(([k, v]) => (k === 'spd' ? `${label[k]} +${v.toFixed(2)}` : `${label[k] || statName(k)} +${(v * 100).toFixed(1)}%`))
    .join('、');
}

function renderBeasts(force = false) {
  const page = document.querySelector('.tab-page[data-page="beast"]');
  if (!force && !page.classList.contains('active')) return;
  const b = CONFIG.beasts;
  const st = state.beasts;
  const slots = getBeastSlots();

  // 孵化區
  let html = `<div class="card beast-hatch">
    <div class="hatch-egg ${st.eggs > 0 ? 'has' : ''}" id="hatch-egg">${icon('egg')}</div>
    <div class="hatch-info">
      <div class="hatch-count">靈獸蛋 <b>${st.eggs}</b></div>
      <div class="hatch-count">靈獸精魄 <b>${st.essence}</b></div>
      ${awakenResonanceHTML()}
      <div class="hatch-note">來源：妖獸潮第 5、10 波、鎮妖塔每 10 層、每日任務</div>
    </div>
    <div class="hatch-btns">
      <button class="btn-primary" id="btn-hatch" ${st.eggs > 0 ? '' : 'disabled'}>孵 化</button>
      ${st.eggs >= 10 ? '<button class="btn-secondary" id="btn-hatch10">孵化 ×10</button>' : ''}
    </div>
  </div>`;

  // 上陣欄位
  html += `<div class="card"><div class="sub-title">${icon('b-fox')}上陣靈獸<small class="daily-reset">${slots}/2 欄</small></div><div class="beast-slots">`;
  for (let i = 0; i < 2; i++) {
    const key = st.deployed[i];
    if (i >= slots) {
      html += `<div class="beast-slot locked">${ri('lock')}${getCondText(getFeature('beastSlot2').cond)}後開放</div>`;
    } else if (key) {
      const sp = b.species[key];
      const o = st.owned[key];
      html += `<div class="beast-slot" style="color:${CONFIG.rarities[o.rarity].color}">${icon(sp.icon)}<span>${CONFIG.rarities[o.rarity].name}・${sp.name}</span></div>`;
    } else {
      html += `<div class="beast-slot empty">空欄位</div>`;
    }
  }
  html += `</div>`;
  // 羈絆一覽（6-4）
  const bond = getActiveBond();
  html += `<div class="bond-list">${b.bonds
    .map((x) => {
      const who = x.core ? `${b.species[x.core].name}＋任一隻` : x.pair.map((k) => b.species[k].name).join('＋');
      return `<div class="bond ${bond && bond.id === x.id ? 'on' : ''}"><b>${x.name}</b><span>${who}</span><small>${x.desc}</small></div>`;
    })
    .join('')}</div>`;
  html += `</div>`;

  // 圖鑑
  html += `<div class="beast-grid">`;
  for (const key of b.order) {
    const sp = b.species[key];
    const o = st.owned[key];
    if (!o) {
      html += `<div class="card beast-card unknown">
        <div class="beast-icon">${icon(sp.icon)}</div>
        <div class="beast-name">${sp.name}</div>
        <div class="beast-desc">${sp.onlyRarity !== undefined ? '只在仙品現世' : '尚未結緣'}</div>
      </div>`;
      continue;
    }
    const rarity = CONFIG.rarities[o.rarity];
    const atk = getBeastAttack(key);
    const cost = getStarUpCost(key);
    const deployed = st.deployed.includes(key);
    html += `<div class="card beast-card ${deployed ? 'deployed' : ''} ${o.awakened ? 'awakened' : ''}" style="--beast-color:${rarity.color}">
      ${o.awakened ? '<span class="awaken-badge">覺</span>' : ''}
      <div class="beast-icon" style="color:${rarity.color}">${icon(sp.icon)}</div>
      <div class="beast-name">${sp.name}<small style="color:${rarity.color}">${rarity.name}</small></div>
      ${starsHTML(o.star)}
      <div class="beast-line">${beastPassiveText(getBeastPassive(key))}</div>
      <div class="beast-line"><b>${atk.name}</b>：每 ${atk.cooldown} 秒 ${atk.mult.toFixed(1)} 倍攻擊</div>
      ${starSkillHTML(key, o.star, !!o.awakened)}
      ${awakenCardHTML(key)}
      <div class="beast-btns">
        <button class="btn-secondary" data-deploy="${key}">${deployed ? '下陣' : '上陣'}</button>
        ${cost === null ? '<span class="beast-max">已滿星</span>' : `<button class="btn-secondary" data-starup="${key}" ${st.essence < cost ? 'disabled' : ''}>升星 ${ri('essence')}${cost}</button>`}
      </div>
    </div>`;
  }
  html += `</div>`;
  const panel = $('#beast-panel');
  panel.innerHTML = html;

  const hatch = $('#btn-hatch');
  if (hatch) hatch.addEventListener('click', () => onHatch(1));
  bindAwakenButtons(panel);
  const hatch10 = $('#btn-hatch10');
  if (hatch10) hatch10.addEventListener('click', () => onHatch(10));
  $$('[data-deploy]', panel).forEach((el) =>
    el.addEventListener('click', () => {
      const before = getActiveBond();
      const res = toggleDeployBeast(el.dataset.deploy);
      if (!res.ok) {
        toast(res.error);
        return;
      }
      playSound('equip');
      const now = getActiveBond();
      if (now && (!before || before.id !== now.id)) toast(`${ri('star')} 羈絆・${now.name}：${now.desc}`);
      saveGame();
      renderAll();
      renderBeasts(true);
    })
  );
  $$('[data-starup]', panel).forEach((el) =>
    el.addEventListener('click', () => {
      const res = starUpBeast(el.dataset.starup);
      if (!res.ok) {
        toast(res.error);
        return;
      }
      playSound('upgrade');
      const key = el.dataset.starup;
      const star = state.beasts.owned[key].star;
      const ss = CONFIG.beasts.starSkills;
      let extra = '';
      if (star === ss.levels[0]) extra = `，技能倍率 +${Math.round(ss.multPct * 100)}%`;
      else if (star === ss.levels[1] && ss.effects[key]) extra = `，${ss.effects[key].desc}`;
      toast(`${ri('star')} ${CONFIG.beasts.species[key].name}升星！${extra}`);
      saveGame();
      renderAll();
      renderBeasts(true);
    })
  );
}

/** 孵化：蛋殼晃動、裂開，再顯示結果 */
function onHatch(times) {
  const results = [];
  for (let i = 0; i < times; i++) {
    const r = hatchEgg();
    if (!r) break;
    results.push(r);
  }
  if (results.length === 0) return;
  saveGame();
  const best = Math.max(...results.map((r) => r.rarity));
  const egg = $('#hatch-egg');
  if (egg) replayAnim(egg, 'cracking');
  playSound('hatch', best);
  setTimeout(() => {
    renderAll();
    renderBeasts(true);
    showHatchResult(results);
  }, CONFIG.fx.hatchRevealMs);
}

function showHatchResult(results) {
  const b = CONFIG.beasts;
  const rows = results
    .map((r) => {
      const sp = b.species[r.key];
      const rarity = CONFIG.rarities[r.rarity];
      let note;
      if (r.isNew) note = '<b class="up">新結緣！</b>';
      else if (r.upgraded) note = `<b class="up">品階提升</b>（${CONFIG.rarities[r.oldRarity].name} → ${rarity.name}），${ri('essence')}+${r.essence}`;
      else note = `已擁有，化為 ${ri('essence')}靈獸精魄 +${r.essence}`;
      return `<div class="hatch-row" style="color:${rarity.color}">
        <span class="hatch-row-icon">${icon(sp.icon)}</span>
        <span class="hatch-row-name">${rarity.name}・${sp.name}</span>
        <span class="hatch-row-note">${note}</span>
      </div>`;
    })
    .join('');
  const single = results.length === 1 ? results[0] : null;
  const head = single
    ? `<div class="hatch-big" style="color:${CONFIG.rarities[single.rarity].color}">${icon(b.species[single.key].icon)}</div>`
    : '';
  const modal = openModal(`
    <div class="modal-title">${ri('egg')}靈獸破殼</div>
    ${head}
    <div class="hatch-list">${rows}</div>
    <div class="modal-buttons"><button class="btn-equip">收下</button></div>
  `);
  modal.querySelector('.btn-equip').addEventListener('click', closeModal);
  if (results.some((r) => r.rarity >= CONFIG.chestAnim.goldLightFromRarity)) replayAnim($('#screen-flash'), 'on');
}


/** 升星技能（2／4 星）：已解鎖亮起；覺醒後 4 星效果由覺醒技取代（劃掉） */
function starSkillHTML(key, star, awakened = false) {
  const ss = CONFIG.beasts.starSkills;
  const lines = [
    { lv: ss.levels[0], text: `技能倍率 +${Math.round(ss.multPct * 100)}%` },
    ss.effects[key] ? { lv: ss.levels[1], text: awakened ? `<s>${ss.effects[key].desc}</s>` : ss.effects[key].desc } : null,
  ].filter(Boolean);
  return `<div class="beast-starskills">${lines
    .map((x) => `<span class="enh-ms ${star >= x.lv ? 'on' : ''}">${x.lv}★ ${x.text}</span>`)
    .join('')}</div>`;
}
