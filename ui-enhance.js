// @ts-check
/* =========================================================
 * ui-enhance.js — 強化分頁（從 ui-pages.js 拆出，第五階段 6-3 加入里程碑與詞條洗練）
 *   部位強化、強化里程碑（+4／+8／+12 解鎖）、身上法寶的詞條洗練（保留／還原）
 * ========================================================= */

/** 里程碑的說明文字（屬性加成用 bonusText，小特效用 desc） */
function getMilestoneText(ms) {
  return ms.desc || bonusText(ms.bonus || {});
}

/** 某部位的三段里程碑（已解鎖亮起、未解鎖灰色） */
function milestoneChipsHTML(slot) {
  const m = CONFIG.gear.enhance.milestones;
  const lv = getEnhanceLevel(slot);
  return (m.slots[slot] || [])
    .map((x, i) => {
      const on = lv >= m.levels[i];
      return `<span class="enh-ms ${on ? 'on' : ''}" title="+${m.levels[i]} 解鎖">+${m.levels[i]} ${getMilestoneText(x)}</span>`;
    })
    .join('');
}

function renderEnhance(force = false) {
  if (!pageActive('enhance', force)) return;
  const e = CONFIG.gear.enhance;
  const refineOpen = isFeatureOpen('divineRefine');
  const rows = CONFIG.slotOrder
    .map((slot) => {
      const lv = getEnhanceLevel(slot);
      const item = state.equipped[slot];
      const info = CONFIG.slots[slot];
      const cost = getEnhanceCost(slot);
      const color = item ? getRarity(item).color : '';
      let right;
      if (!cost) {
        right = `<span class="enh-max">${ri('star')}已達 +${e.maxLevel}</span>`;
      } else {
        const lackGold = state.gold < cost.gold;
        const lackIron = state.materials.iron < cost.iron;
        right = `<div class="enh-cost">
            <span class="${lackGold ? 'lack' : ''}">${ri('gold')}${fmtNum(cost.gold)}</span>
            ${cost.iron ? `<span class="${lackIron ? 'lack' : ''}">${ri('iron')}${cost.iron}</span>` : ''}
            <span class="enh-rate ${cost.rate < 1 ? 'risky' : ''}">成功率 ${Math.round(cost.rate * 100)}%</span>
          </div>
          <button class="btn-dg enh-btn" data-act="enhance" data-arg="${slot}" ${lackGold || lackIron ? 'disabled' : ''}>強化至 +${cost.next}</button>`;
      }
      if (refineOpen) right += refineSideHTML(slot);
      const rerollCost = getRerollCost(item);
      const reroll = rerollCost ? `<button class="btn-secondary enh-reroll" data-act="reroll" data-arg="${slot}">洗練詞條 ${ri('iron')}${rerollCost}</button>` : '';
      return `<div class="enh-row">
        <span class="enh-icon" style="color:${color}">${icon(info.icon)}</span>
        <div class="enh-main">
          <div class="enh-name">${info.name}<b>+${lv}</b></div>
          <div class="enh-item">${item ? itemDisplayName(item) : '未佩戴'}</div>
          <div class="enh-bonus">主屬性 +${Math.round(lv * e.statPerLevel * 100)}%${cost ? ` → +${Math.round(cost.next * e.statPerLevel * 100)}%` : ''}</div>
          <div class="enh-milestones">${milestoneChipsHTML(slot)}</div>
          ${refineOpen ? refineInfoHTML(slot) : ''}
          ${reroll}
        </div>
        <div class="enh-side">${right}</div>
      </div>`;
    })
    .join('');
  const panel = $('#enhance-panel');
  setHTML(panel, `<div class="card">
    <div class="sub-title">${icon('iron')}部位強化<small class="daily-reset">玄鐵 ${state.materials.iron}</small></div>
    <div class="enh-note">強化等級屬於部位，換上新法寶也會保留；強化到 +${e.milestones.levels.join('／+')} 時解鎖該部位的特效。${
      e.safeUntil >= e.maxLevel ? '<b>每次強化必定成功</b>。' : `+${e.safeUntil} 以前必定成功；之後有機率失敗，失敗會消耗材料但<b>不會降級</b>。`
    }玄鐵可從每日任務、上古妖王、坊市、圖鑑與成就取得，也能用來洗練法寶的詞條。</div>
    ${refineOpen ? refineHeaderHTML() : ''}
    ${rows}
  </div>`);
  bindPanel(panel, {
    enhance: (slot) => {
      const before = getEnhanceMilestones(slot).length;
      const res = enhanceSlot(slot);
      if (!res.ok) return toast(res.error);
      if (res.success) {
        playSound('upgrade');
        toast(`${ri('star')} ${CONFIG.slots[slot].name}強化成功：+${res.level}`);
        const unlocked = getEnhanceMilestones(slot);
        if (unlocked.length > before) {
          const ms = unlocked[unlocked.length - 1];
          showAchievementPop(`${CONFIG.slots[slot].name} +${ms.level} 解鎖`, getMilestoneText(ms), 'iron');
        } else if (res.level >= 10) showAchievementPop('強化成功', `${CONFIG.slots[slot].name} +${res.level}`, 'iron');
      } else {
        playSound('defeat');
        toast(`強化失敗，${CONFIG.slots[slot].name}維持 +${res.level}`);
      }
      afterShopChange();
    },
    reroll: (slot) => showRerollModal(/** @type {Slot} */ (slot)),
    refine: (slot) => {
      const res = refineSlot(/** @type {Slot} */ (slot));
      if (!res.ok) return toast(res.error);
      playSound('upgrade');
      toast(`${ri('marrow')} ${CONFIG.slots[slot].name}煉化成功：★${res.star}`);
      afterShopChange();
    },
    refineAll: () => {
      const res = refineAll();
      if (!res.count) return toast('神髓不足，或沒有可以煉化的部位');
      playSound('upgrade');
      const parts = CONFIG.slotOrder.filter((s) => res.slots[s]).map((s) => `${CONFIG.slots[s].name} ★${getRefineStar(s)}`);
      toast(`${ri('marrow')} 一鍵煉化 ${res.count} 星：${parts.join('、')}`, CONFIG.fx.toast.long);
      afterShopChange();
    },
  });
}

// ---------- 神品煉化（v1.1 V2，PLAN.md 2.29） ----------

/** 強化分頁上方：神髓數量、說明、一鍵煉化 */
function refineHeaderHTML() {
  const r = CONFIG.gear.refine;
  const total = getRefineTotalStars();
  const max = r.maxStar * CONFIG.slotOrder.length;
  return `<div class="refine-head">
    <div class="sub-title">${icon('marrow')}神品煉化<small class="daily-reset">神髓 ${state.materials.marrow.toLocaleString()}</small></div>
    <div class="enh-note">分解神品會得到神髓。穿著神品的部位可以用神髓煉化升星：每星神品主屬性 +${Math.round(r.statPerStar * 100)}%（每部位 ${r.maxStar} 星）。星數屬於部位，換上另一件神品也會保留；換成非神品時沒有加成。</div>
    <div class="refine-total"><span>六個部位合計 <b>${total}</b> / ${max} 星</span>
      <button class="btn-dg refine-all" data-act="refineAll" ${total >= max ? 'disabled' : ''}>一鍵煉化</button></div>
  </div>`;
}

/** 每個部位：目前星數與加成 */
function refineInfoHTML(slot) {
  const r = CONFIG.gear.refine;
  const star = getRefineStar(slot);
  const cost = getRefineCost(slot);
  const pct = (n) => Math.round(n * r.statPerStar * 100);
  const item = state.equipped[slot];
  const divine = item && getRarityIndex(item) === CONFIG.divineRarity;
  return `<div class="enh-refine ${divine ? '' : 'off'}">${ri('marrow')}煉化 ★${star}/${r.maxStar}　神品主屬性 +${pct(star)}%${cost ? ` → +${pct(cost.next)}%` : ''}${divine ? '' : '（穿上神品才生效）'}</div>`;
}

/** 每個部位右側：煉化按鈕 */
function refineSideHTML(slot) {
  const cost = getRefineCost(slot);
  if (!cost) return `<span class="enh-max refine-max">${ri('marrow')}★${CONFIG.gear.refine.maxStar} 圓滿</span>`;
  const reason = getRefineBlockReason(slot);
  return `<button class="btn-secondary refine-btn" data-act="refine" data-arg="${slot}" ${reason ? 'disabled' : ''} title="${reason || ''}">煉化 ★${cost.next} ${ri('marrow')}${cost.marrow.toLocaleString()}</button>`;
}


/** 一條詞條的文字 */
function affixText(a) {
  return `${statName(a.type)} +${fmtStat(a.type, a.value)}`;
}

/** 洗練視窗：選一條詞條重洗 */
function showRerollModal(slot) {
  const item = state.equipped[slot];
  if (!item) return;
  const cost = getRerollCost(item);
  const lack = state.materials.iron < cost;
  const rows = item.subStats
    .map(
      (a, i) => `<div class="reroll-row"><span>${affixText(a)}</span>
        <button class="btn-secondary" data-reroll="${i}" ${lack ? 'disabled' : ''}>洗這條 ${ri('iron')}${cost}</button></div>`
    )
    .join('');
  const modal = openModal(
    `<div class="modal-title">${ri('iron')}詞條洗練</div>
     <div class="unlock-hint">${itemDisplayName(item)}<br>選一條詞條重洗（種類和數值都重新隨機），其他詞條不動。洗完可以選保留或還原。</div>
     <div class="reroll-list">${rows}</div>
     <div class="queue-hint">持有玄鐵 ${state.materials.iron}</div>
     <div class="modal-buttons"><button class="btn-close">關閉</button></div>`,
    { closeOnOverlay: true }
  );
  modal.querySelector('.btn-close').addEventListener('click', closeModal);
  $$('[data-reroll]', modal).forEach((b) =>
    b.addEventListener('click', () => {
      const res = rerollAffix(slot, Number(b.dataset.reroll));
      if (!res.ok) return toast(res.error);
      playSound('upgrade');
      saveGame();
      showRerollResult(slot, res.old, res.now);
    })
  );
}

/** 洗練結果：舊 → 新，選保留或還原（直接關掉視窗等於保留） */
function showRerollResult(slot, old, now) {
  const modal = openModal(
    `<div class="modal-title">${ri('iron')}洗練結果</div>
     <div class="reroll-compare">
       <div class="reroll-old"><small>原本</small>${affixText(old)}</div>
       <div class="reroll-arrow">→</div>
       <div class="reroll-new"><small>洗出</small>${affixText(now)}</div>
     </div>
     <div class="modal-buttons">
       <button class="btn-salvage" id="btn-reroll-revert">還原</button>
       <button class="btn-equip" id="btn-reroll-keep">保留新的</button>
     </div>`
  );
  const done = (revert) => {
    if (revert) revertReroll();
    else keepReroll();
    saveGame();
    closeModal();
    renderAll();
    showRerollModal(slot); // 回到洗練視窗，方便連續洗
  };
  modal.querySelector('#btn-reroll-keep').addEventListener('click', () => done(false));
  modal.querySelector('#btn-reroll-revert').addEventListener('click', () => done(true));
}
