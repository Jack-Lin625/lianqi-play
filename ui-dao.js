// @ts-check
/* =========================================================
 * ui-dao.js — 道途分頁（從 ui.js 拆出，第五階段 6-2 加入天賦）
 *   目前道途、屬性加成、技能、每一轉二選一的天賦、突破二轉、改修其他道途
 *   天賦還沒選時：打開道途分頁會跳出選擇視窗；選道途、突破二轉後也會直接跳出
 * ========================================================= */

/** 屬性加成文字，例如 攻擊 +20%、氣血 -10% */
function daoBonusList(bonus) {
  const label = { atkPct: '攻擊', hpPct: '氣血', defPct: '護體', critRate: '會心率' };
  return Object.entries(bonus).map(([k, v]) => {
    const sign = v >= 0 ? '+' : '-';
    return `<span class="dao-chip ${v >= 0 ? 'up' : 'down'}">${label[k] || statName(k)} ${sign}${Math.round(Math.abs(v) * 100)}%</span>`;
  });
}

/** 技能說明文字 */
function daoSkillText(sk) {
  const start = sk.castAtStart ? '開戰立即施放，之後' : '';
  if (sk.type === 'damage') return `${start}每 ${sk.cooldown} 秒施放，造成 <b>${sk.mult} 倍</b>攻擊傷害`;
  if (sk.type === 'shield') return `${start}每 ${sk.cooldown} 秒施放，<b>${sk.duration} 秒</b>內受到的傷害減少 <b>${Math.round(sk.reduction * 100)}%</b>`;
  return '';
}

/** 一條道途某一轉的說明區塊（skill 可傳入已套用天賦的技能） */
function daoTierHTML(t, skill = t.skill, bonus = t.bonus) {
  return `<div class="dao-chips">${daoBonusList(bonus).join('')}</div>
    <div class="dao-skill"><span class="dao-skill-name">${skill.name}</span>${daoSkillText(skill)}</div>`;
}

/** 一張天賦卡片 */
function talentCardHTML(tal, tier, chosen, canPick) {
  const cost = getDaoTalentCost(tier);
  let btn = '';
  if (chosen) btn = `<span class="talent-chosen">${ri('star')}已選</span>`;
  else if (canPick) {
    const lack = state.upgradeStones < cost;
    btn = `<button class="btn-secondary talent-pick" data-talent="${tal.id}" data-tier="${tier}" ${lack ? 'disabled' : ''}>${
      lack ? `仙玉不足（需要 ${cost}）` : cost > 0 ? `改選 ${ri('stones')}×${cost}` : '選擇'
    }</button>`;
  }
  return `<div class="talent-card${chosen ? ' chosen' : ''}">
    <div class="talent-name">${tal.name}</div>
    <div class="talent-desc">${tal.desc}</div>
    <div class="talent-good">適合：${tal.good}</div>
    ${btn}
  </div>`;
}

/** 目前道途的天賦區塊（一轉、二轉各二選一；未到的轉數只顯示預覽） */
function daoTalentsHTML() {
  let html = '';
  for (let tier = 1; tier <= getDaoMaxTier(); tier++) {
    const list = getDaoTalentChoices(state.dao.path, tier);
    if (!list.length) continue;
    const cur = getDaoTalent(tier);
    const reached = tier <= state.dao.tier;
    const head = reached ? (cur ? `${toCN(tier)}轉天賦` : `${toCN(tier)}轉天賦（尚未選擇）`) : `${toCN(tier)}轉天賦（突破${toCN(tier)}轉後選擇）`;
    html += `<div class="dao-talents${reached ? '' : ' locked'}">
      <div class="dao-ascend-head">${ri('taiji')}${head}</div>
      <div class="talent-row">${list.map((t) => talentCardHTML(t, tier, !!cur && cur.id === t.id, reached)).join('')}</div>
    </div>`;
  }
  return html;
}

/** 底部分頁的提示點：可選道途、可突破、天賦未選時亮起 */
function renderDaoNotice() {
  renderTabNotices();
}

/**
 * 道途分頁
 * @param {boolean} force 不在道途分頁時也強制重繪
 */
function renderDao(force = false) {
  const page = document.querySelector('.tab-page[data-page="dao"]');
  if (!force && !page.classList.contains('active')) return;
  const panel = $('#dao-panel');
  const cfg = CONFIG.dao;

  // 尚未解鎖
  if (!isDaoUnlocked()) {
    panel.innerHTML = `<div class="card dao-locked">
      <div class="dao-big">${icon('taiji')}</div>
      <div class="dao-title">道途未開</div>
      <p><b>${getCondText(getFeature('dao').cond)}</b>後，即可在劍修、法修、體修中擇一而修。</p>
      <p class="dao-progress">目前最高：${getBestStage() > 0 ? formatStage(getBestStage()) : '尚未突破'}</p>
    </div>`;
    return;
  }

  const cur = state.dao.path;
  let html = '';

  // 目前道途、天賦與突破
  if (cur) {
    const p = cfg.paths[cur];
    const t = getDaoTierConfig();
    const maxTier = getDaoMaxTier();
    let ascend = '';
    if (state.dao.tier < maxTier) {
      const next = getDaoTierConfig(cur, state.dao.tier + 1);
      const ready = canAscendDao();
      ascend = `<div class="dao-ascend">
        <div class="dao-ascend-head">${ri('lightning')}突破${toCN(state.dao.tier + 1)}轉：<b>${next.name}</b></div>
        ${daoTierHTML(next)}
        <button class="btn-primary dao-ascend-btn" id="btn-dao-ascend" ${ready ? '' : 'disabled'}>
          突 破<span class="btn-sub">${ready ? `${t.name} → ${next.name}` : `需${getCondText(getFeature('daoAscend').cond)}`}</span>
        </button>
      </div>`;
    } else {
      ascend = `<div class="dao-ascend done">${ri('star')}已臻${toCN(maxTier)}轉圓滿</div>`;
    }
    html += `<div class="card dao-current" style="--dao-color:${p.color}">
      <div class="dao-head">
        <span class="dao-icon">${icon(p.icon)}</span>
        <div><div class="dao-name">${t.name}<small>${toCN(state.dao.tier)}轉</small></div><div class="dao-desc">${p.desc}</div></div>
      </div>
      ${daoTierHTML(t, getDaoSkill(), getDaoBonus())}
      ${daoTalentsHTML()}
      ${ascend}
    </div>`;
  } else {
    html += `<div class="card dao-intro"><div class="dao-title">${ri('taiji')}擇道而修</div>
      <p>選擇一條道途，獲得屬性加成與專屬技能，並在每一轉二選一天賦。第一次選擇免費，之後改修需要 ${ri('stones')}${cfg.rerollCost}。</p></div>`;
  }

  // 三條道途
  const cost = getDaoChooseCost();
  html += `<div class="dao-list-title">${cur ? '改修其他道途（天賦重選，免費）' : '三條道途'}</div>`;
  for (const key of cfg.order) {
    if (key === cur) continue;
    const p = cfg.paths[key];
    const t = getDaoTierConfig(/** @type {'sword'|'spell'|'body'} */ (key), cur ? state.dao.tier : 1);
    const lack = state.upgradeStones < cost;
    const btn = cost > 0 ? `改修此道 ${ri('stones')}×${cost}` : '選擇此道';
    const talents = (p.talents || []).map((pair, i) => `${toCN(i + 1)}轉：${pair.map((x) => x.name).join(' ／ ')}`).join('<br>');
    html += `<div class="card dao-option" style="--dao-color:${p.color}">
      <div class="dao-head">
        <span class="dao-icon">${icon(p.icon)}</span>
        <div><div class="dao-name">${t.name}</div><div class="dao-desc">${p.desc}</div></div>
      </div>
      ${daoTierHTML(t)}
      ${talents ? `<div class="talent-preview">天賦二選一<br>${talents}</div>` : ''}
      <button class="btn-dg dao-choose" data-dao="${key}" ${lack ? 'disabled' : ''}>${lack ? `仙玉不足（需要 ${cost}）` : btn}</button>
    </div>`;
  }
  panel.innerHTML = html;

  $$('[data-dao]', panel).forEach((b) => b.addEventListener('click', () => onChooseDao(b.dataset.dao)));
  $$('[data-talent]', panel).forEach((b) => b.addEventListener('click', () => onChooseTalent(Number(b.dataset.tier), b.dataset.talent)));
  const ascendBtn = $('#btn-dao-ascend');
  if (ascendBtn) ascendBtn.addEventListener('click', onAscendDao);

  // 有還沒選的天賦（舊存檔、剛選道途或突破）：跳出選擇視窗；其他視窗開著時排隊，關掉後接著跳
  if (force && !isModalOpen()) showDaoTalentPrompt();
}

/**
 * 在道途分頁上、有還沒選的天賦時跳出選擇視窗（每個轉數每次開遊戲只自動跳一次，「稍後再選」後不再打擾）
 * @returns {boolean} 是否跳出了視窗
 */
function showDaoTalentPrompt() {
  const page = document.querySelector('.tab-page[data-page="dao"]');
  if (!page || !page.classList.contains('active')) return false;
  const pending = getPendingTalentTier();
  const key = `${state.dao.path}:${pending}`;
  if (!pending || talentPickerShown.has(key)) return false;
  talentPickerShown.add(key);
  showTalentPicker(pending);
  return true;
}

/** 已經自動跳過選擇視窗的「道途:轉數」 */
const talentPickerShown = new Set();

/** 天賦二選一的視窗（還沒選時免費） */
function showTalentPicker(tier) {
  const list = getDaoTalentChoices(state.dao.path, tier);
  if (!list.length) return;
  const p = CONFIG.dao.paths[state.dao.path];
  const modal = openModal(
    `<div class="modal-title">${ri('taiji')}${getDaoName()}・${toCN(tier)}轉天賦</div>
     <div class="unlock-hint">二選一，之後改選需要 ${ri('stones')}${CONFIG.dao.rerollCost}</div>
     <div class="talent-row" style="--dao-color:${p.color}">${list.map((t) => talentCardHTML(t, tier, false, true)).join('')}</div>
     <div class="modal-buttons"><button class="btn-close">稍後再選</button></div>`
  );
  modal.querySelector('.btn-close').addEventListener('click', closeModal);
  $$('[data-talent]', modal).forEach((b) =>
    b.addEventListener('click', () => {
      closeModal();
      onChooseTalent(tier, b.dataset.talent, true);
    })
  );
}

/**
 * 選擇或改選天賦
 * @param {boolean} [fromPicker] 從選擇視窗來的（第一次選，不用再確認）
 */
async function onChooseTalent(tier, id, fromPicker = false) {
  const tal = getDaoTalentChoices(state.dao.path, tier).find((t) => t.id === id);
  if (!tal) return;
  const cost = getDaoTalentCost(tier);
  if (!fromPicker || cost > 0) {
    const msg = cost > 0 ? `改選「${tal.name}」？<br>消耗仙玉 ${cost}。` : `選擇「${tal.name}」？<br>之後改選需要仙玉 ${CONFIG.dao.rerollCost}。`;
    if (!(await askConfirm(msg, { okText: cost > 0 ? '改選' : '選擇' }))) return;
  }
  const res = chooseDaoTalent(tier, id);
  if (!res.ok) {
    toast(res.error);
    return;
  }
  toast(`領悟天賦「${tal.name}」`);
  saveGame();
  renderAll();
  renderDao(true);
}

async function onChooseDao(path) {
  const t = getDaoTierConfig(path, state.dao.path ? state.dao.tier : 1);
  const cost = getDaoChooseCost();
  const msg = cost > 0
    ? `改修「${t.name}」？<br>消耗仙玉 ${cost}，目前的道途加成、技能與天賦會被取代（天賦重選免費）。`
    : `選擇「${t.name}」？<br>之後改修其他道途需要仙玉 ${CONFIG.dao.rerollCost}。`;
  if (!(await askConfirm(msg, { okText: cost > 0 ? '改修' : '入道' }))) return;
  const res = chooseDao(path);
  if (!res.ok) {
    toast(res.error);
    return;
  }
  playCeremony({ kind: 'dao', title: `踏上${t.name}之道`, subtitle: t.skill.name });
  saveGame();
  renderAll();
  renderDao(true);
}

function onAscendDao() {
  const before = getDaoName();
  const res = ascendDao();
  if (!res.ok) {
    toast(res.error);
    return;
  }
  playCeremony({ kind: 'dao', title: `${before} → ${getDaoName()}`, subtitle: `二轉突破・${getDaoSkill().name}` });
  if (coachActive === 'daoAscend') dismissCoach();
  saveGame();
  renderAll();
  renderDao(true);
}

/** 天賦在戰鬥中觸發的跳字（目前只有金鐘罩反彈） */
function playTalentEvent(ev) {
  if (ev.id === 'reflect') {
    const target = ev.side === 'hero' ? 'enemy' : 'hero';
    spawnFloat(target, `<small>金鐘罩</small>${fmtNum(ev.damage)}`, 'proc');
  }
}
