// @ts-check
/* =========================================================
 * ui-pages.js — 強化、圖鑑、坊市、仙玉商店、成就、簽到 分頁（儲值在 ui-recharge.js、信箱在 ui-welfare.js）
 *
 * 每個分頁只綁一次點擊事件（事件代理，按鈕用 data-act），
 * 內容沒變就不重建 DOM，避免自動開爐時頻繁重繪吃掉點擊。
 * ========================================================= */

/** 頁面容器綁定點擊事件（只綁一次） */
function bindPanel(panel, handlers) {
  if (panel._bound) return;
  panel._bound = true;
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled || !panel.contains(b)) return;
    const fn = handlers[b.dataset.act];
    if (fn) fn(b.dataset.arg, b);
  });
}

function pageActive(name, force) {
  return force || document.querySelector(`.tab-page[data-page="${name}"]`).classList.contains('active');
}

// ---------- 獎勵與機率顯示 ----------

/**
 * 獎勵內容（購買前顯示用）
 * @param {Reward} r
 */
function rewardSpecHTML(r) {
  const parts = [];
  if (r.gold) parts.push(`${ri('gold')}${fmtNum(r.gold)}`);
  if (r.keys) parts.push(`${ri('keys')}×${r.keys}`);
  if (r.stones) parts.push(`${ri('stones')}×${r.stones}`);
  if (r.eggs) parts.push(`${ri('egg')}×${r.eggs}`);
  if (r.essence) parts.push(`${ri('essence')}×${r.essence}`);
  if (r.iron) parts.push(`${ri('iron')}玄鐵×${r.iron}`);
  if (r.marrow) parts.push(`${ri('marrow')}神髓×${fmtNum(r.marrow)}`);
  if (r.doubleHours) parts.push(`雙倍收益 ${r.doubleHours} 小時`);
  for (const spec of r.items || []) parts.push(`<span style="color:${CONFIG.rarities[spec.rarity].color}">${CONFIG.rarities[spec.rarity].name}法寶</span>`);
  if (r.beast) parts.push(`${CONFIG.rarities[r.beast.rarity].name}${CONFIG.beasts.species[r.beast.key].name}`);
  for (const lootId of [r.loot, ...(r.loots || [])]) if (lootId) parts.push(`隨機：${CONFIG.lootTables[lootId].name}`);
  if (r.cosmetic) parts.push(`外觀：${CONFIG.shop.cosmetics[r.cosmetic].name}`);
  if (r.divinePick) parts.push(`<span style="color:${CONFIG.rarities[CONFIG.divineRarity].color}">神品法寶（六部位自選）×${r.divinePick}</span>`);
  return parts.join('、');
}

/** 實際獲得內容（發放後顯示用） */
function rewardGotHTML(got) {
  const parts = [];
  if (got.gold) parts.push(`<span>${ri('gold')}+${fmtNum(got.gold)}</span>`);
  if (got.keys) parts.push(`<span>${ri('keys')}+${got.keys}</span>`);
  if (got.stones) parts.push(`<span>${ri('stones')}+${got.stones}</span>`);
  if (got.eggs) parts.push(`<span>${ri('egg')}+${got.eggs}</span>`);
  if (got.essence) parts.push(`<span>${ri('essence')}+${got.essence}</span>`);
  if (got.iron) parts.push(`<span>${ri('iron')}玄鐵+${got.iron}</span>`);
  if (got.marrow) parts.push(`<span>${ri('marrow')}神髓+${fmtNum(got.marrow)}</span>`);
  if (got.doubleHours) parts.push(`<span>${ri('star')}雙倍收益 ${got.doubleHours} 小時</span>`);
  if (got.cosmetic) parts.push(`<span>外觀：${CONFIG.shop.cosmetics[got.cosmetic].name}</span>`);
  if (got.divinePick) parts.push(`<span style="color:${CONFIG.rarities[CONFIG.divineRarity].color}">${ri('star')}神品自選 ×${got.divinePick}（到飛升頁選部位）</span>`);
  for (const it of got.items) parts.push(`<span style="color:${getRarity(it).color}">${ri(CONFIG.slots[it.slot].icon)}${it.name}</span>`);
  for (const b of got.beasts || []) {
    const sp = CONFIG.beasts.species[b.key];
    const note = b.isNew ? '新結緣' : b.upgraded ? '品階提升' : `化為精魄 +${b.essence}`;
    parts.push(`<span style="color:${CONFIG.rarities[b.rarity].color}">${ri(sp.icon)}${CONFIG.rarities[b.rarity].name}${sp.name}（${note}）</span>`);
  }
  return parts.join('');
}

/** 隨機表的機率表 */
function oddsTableHTML(lootId) {
  const rows = getLootOdds(lootId)
    .map((o) => `<tr><td>${o.label}</td><td>${o.pct.toFixed(o.pct < 1 ? 2 : 1)}%</td></tr>`)
    .join('');
  return `<div class="odds"><div class="odds-title">${CONFIG.lootTables[lootId].name}・各結果機率</div><table>${rows}</table></div>`;
}

/**
 * 購買確認視窗：列出內容，含隨機結果的商品一定先顯示每種結果的機率
 * @param {{title: string, priceHTML: string, reward: Reward, note?: string}} o
 * @returns {Promise<boolean>}
 */
function confirmPurchase({ title, priceHTML, reward, note }) {
  const odds = reward.loot ? oddsTableHTML(reward.loot) : '';
  return askConfirm(
    `<div class="buy-title">${title}</div>
     <div class="buy-content">內容：${rewardSpecHTML(reward) || '—'}</div>
     ${odds}
     ${note ? `<div class="buy-note">${note}</div>` : ''}
     <div class="buy-price">價格：${priceHTML}</div>`,
    { okText: '購買' }
  );
}

/** 只看機率（不購買） */
function showOdds(lootId) {
  const modal = openModal(`<div class="modal-title">機率公示</div>${oddsTableHTML(lootId)}
    <div class="queue-hint">機率依權重計算，每次開啟獨立抽選</div>
    <div class="modal-buttons"><button class="btn-close">關閉</button></div>`, { closeOnOverlay: true });
  modal.querySelector('.btn-close').addEventListener('click', closeModal);
}

/**
 * 購買結果視窗（儲值類標示測試模式）
 * @param {RewardGot} got
 * @param {{title?: string, test?: boolean}} [opts]
 */
function showPurchaseResult(got, { title, test = false } = {}) {
  playSound('reward');
  const modal = openModal(`
    ${test ? '<div class="test-banner">測試模式：已模擬購買</div>' : ''}
    <div class="modal-title">${title}</div>
    ${got.rolled.length ? `<div class="queue-hint">隨機結果：${got.rolled.join('、')}</div>` : ''}
    <div class="reward-row">${rewardGotHTML(got) || '<span class="queue-hint">已生效</span>'}</div>
    ${got.items.length ? '<div class="queue-hint">法寶會接著跳出比較視窗</div>' : ''}
    <div class="modal-buttons"><button class="btn-equip">收下</button></div>`);
  modal.querySelector('.btn-equip').addEventListener('click', closeModal);
}

function afterShopChange() {
  saveGame();
  renderAll();
}

// 強化分頁（部位強化、里程碑、詞條洗練）在 ui-enhance.js

// ---------- 圖鑑 ----------

function renderCodex(force = false) {
  if (!pageActive('codex', force) || !GEAR_DATA) return;
  const total = getCodexTotal();
  const count = getCodexCount();
  const seen = state.codex.seen;
  // 圖鑑兌換（v1.1 V1）：可兌換的格子可以點；兌換來的格子當凡品顯示、加「兌」字
  const ex = CONFIG.gear.codexExchange;
  const exList = isCodexExchangeOpen() ? getCodexExchangeList() : [];
  const exIds = new Set(exList.map((e) => e.id));
  const cell = (t) => {
    const r = seen[t.id];
    if (r === undefined) {
      if (exIds.has(t.id)) return `<button class="cx-cell unseen cx-ex" data-act="exchange" data-arg="${t.id}">可兌換</button>`;
      return `<div class="cx-cell unseen">？？？</div>`;
    }
    if (r === ex.seenValue) return `<div class="cx-cell cx-exd" style="color:${CONFIG.rarities[0].color}" title="仙玉兌換（只記錄圖鑑）">${t.name}<em class="cx-ex-mark">兌</em></div>`;
    return `<div class="cx-cell" style="color:${CONFIG.rarities[r].color}" title="最高：${CONFIG.rarities[r].name}">${t.name}</div>`;
  };
  const exCard = !isFeatureOpen('codex')
    ? ''
    : !isCodexExchangeOpen()
      ? `<div class="card cx-ex-card"><div class="sub-title">${icon('stones')}圖鑑兌換</div><div class="queue-hint">第 ${ex.minAscensions} 次飛升後，可以用仙玉兌換已經開不到的境界外觀（只記錄圖鑑，不會得到法寶）。</div></div>`
      : `<div class="card cx-ex-card"><div class="sub-title">${icon('stones')}圖鑑兌換<small class="daily-reset">每種 ${ri('stones')}${fmtNum(ex.price)}</small></div>
        <div class="queue-hint">${exList.length ? `可兌換 <b>${exList.length}</b> 種（已經開不到的境界外觀），全部需要 ${ri('stones')}${fmtNum(ex.price * exList.length)}；目前仙玉 ${fmtNum(state.upgradeStones)}。點下方「可兌換」的格子兌換。` : '目前沒有可以兌換的外觀。'}只記錄圖鑑、不會得到法寶；之後開爐開到同一件時，會改記實際品階。</div></div>`;
  const milestones = CONFIG.gear.codexMilestones
    .map((m, i) => {
      const done = state.codex.claimed.includes(i);
      const ready = !done && count >= m.count;
      return `<div class="cx-ms ${done ? 'done' : ''}"><span>收集 ${m.count} 種</span><span class="cx-ms-r">${rewardSpecHTML(m.reward)}</span>
        ${done ? '<span class="daily-done">已領取</span>' : `<button class="daily-claim" data-act="codex" data-arg="${i}" ${ready ? '' : 'disabled'}>領取</button>`}</div>`;
    })
    .join('');
  const realms = GEAR_DATA.realms
    .map((r) => {
      const sets = r.sets.map((id) => `<span class="cx-set" title="${GEAR_DATA.sets[id].desc}">${GEAR_DATA.sets[id].name}</span>`).join('');
      const cells = CONFIG.slotOrder.map((slot) => r.items[slot].map(cell).join('')).join('');
      const got = CONFIG.slotOrder.reduce((n, slot) => n + r.items[slot].filter((t) => seen[t.id] !== undefined).length, 0);
      return `<details class="cx-realm" ${got ? 'open' : ''}><summary>${r.realm}<small>${got}/18</small>${sets}</summary><div class="cx-grid">${cells}</div></details>`;
    })
    .join('');
  const mythics = GEAR_DATA.mythics
    .map((m) => {
      const r = seen[m.id];
      if (r === undefined) return `<div class="cx-myth unseen"><b>仙品・？？？</b><span>${CONFIG.slots[m.slot].name}</span></div>`;
      return `<div class="cx-myth"><b>${m.name}</b><span>${m.effect.name}：${effectText(m.effect)}</span><i>${m.desc}</i></div>`;
    })
    .join('');
  // 神品專屬（B2）：爐階 21～25 開放前顯示鎖住的說明
  const divineList = GEAR_DATA.divines || [];
  const divines = divineList
    .map((m) => {
      const r = seen[m.id];
      if (r === undefined) return `<div class="cx-myth unseen"><b>神品・？？？</b><span>${CONFIG.slots[m.slot].name}</span></div>`;
      return `<div class="cx-myth divine"><b>${m.name}</b><span>${m.effect.name}：${effectText(m.effect)}</span><i>${m.desc}</i></div>`;
    })
    .join('');
  const divineLock = isFeatureOpen('chestBeyond') ? '' : `<div class="queue-hint">${getFeatureLockText('chestBeyond')}</div>`;
  const statName = { atkPct: '攻擊', hpPct: '氣血' };
  const setBonus = (b) => Object.entries(b).map(([k, v]) => `${statName[k] || k} +${Math.round(v * 100)}%`).join('、');
  const ascCount = state.ascension.count;
  const codexSets = getCodexSetStatus()
    .map((g) => {
      const wait = g.minAsc > ascCount ? `<em class="cx-asc-lock">飛升後生效</em>` : '';
      return `<li class="${g.active ? 'done' : g.done ? 'done waiting' : ''}">${g.name}<small>${g.have}/${g.total}</small><span>${setBonus(g.bonus)}${wait}</span></li>`;
    })
    .join('');
  const realmMin = CONFIG.gear.codexSets.realmMinAscensions || 0;
  const codexAscHint = realmMin > ascCount ? `境界的套組加成在第 ${realmMin} 次飛升後才生效（現在先收集，飛升時一起啟動）。` : '';
  const codexBonus = getCodexSetBonus();
  const codexBonusText = Object.keys(codexBonus).length ? setBonus(codexBonus) : '還沒有收集齊任何一組';
  const panel = $('#codex-panel');
  setHTML(panel, `<div class="card">
      <div class="sub-title">${icon('book')}法寶圖鑑<small class="daily-reset">${count}/${total}</small></div>
      <div class="daily-bar cx-bar"><div class="daily-fill" style="width:${(count / total) * 100}%"></div><span>${count}/${total}</span></div>
      <div class="cx-milestones">${milestones}</div>
    </div>
    ${exCard}
    <div class="card"><div class="sub-title">${icon('star')}圖鑑套組加成<small class="daily-reset">目前：${codexBonusText}</small></div>
      <div class="queue-hint">收集齊一組就永久生效（與其他加成相乘，計入戰力）。${codexAscHint}</div>
      <ul class="cx-sets">${codexSets}</ul></div>
    <div class="card"><div class="sub-title">${icon('seal')}仙品專屬</div><div class="cx-myths">${mythics}</div></div>
    ${divineList.length ? `<div class="card"><div class="sub-title">${icon('seal')}神品專屬<small class="daily-reset">六件湊成${GEAR_DATA.sets.taichu ? GEAR_DATA.sets.taichu.name : '套裝'}</small></div>${divineLock}<div class="cx-myths">${divines}</div></div>` : ''}
    <div class="card"><div class="sub-title">${icon('scroll')}各境界法寶</div>${realms}</div>`);
  bindPanel(panel, {
    exchange: (id) => openCodexExchangeConfirm(id),
    codex: (i) => {
      const r = claimCodexMilestone(Number(i));
      if (!r) return;
      playSound('reward');
      toast(`圖鑑獎勵：${rewardSpecHTML(r)}`);
      afterShopChange();
    },
  });
}

/** 圖鑑兌換的確認視窗（v1.1 V1） */
function openCodexExchangeConfirm(id) {
  const reason = getCodexExchangeBlockReason(id);
  if (reason) return toast(reason);
  const e = getCodexExchangeList().find((x) => x.id === id);
  if (!e) return;
  const price = CONFIG.gear.codexExchange.price;
  const after = e.left - 1;
  const modal = openModal(`
    <div class="modal-title">${icon('book')}圖鑑兌換</div>
    <div class="awaken-rows">
      <div><span>外觀</span><b>${e.realmName}・${CONFIG.slots[e.slot].name}・${e.name}</b></div>
      <div><span>消耗</span><b>${ri('stones')}仙玉 ${fmtNum(price)}（目前 ${fmtNum(state.upgradeStones)}）</b></div>
      <div><span>${e.realmName}全收集</span><b>${after ? `兌換後還差 ${after} 種` : '兌換後收集齊！'}</b></div>
    </div>
    <div class="awaken-cost">只記錄圖鑑，不會得到法寶。</div>
    <div class="modal-buttons">
      <button class="btn-secondary" data-act="cancel">再想想</button>
      <button class="btn-equip" data-act="ok">兌 換</button>
    </div>
  `);
  modal.querySelector('[data-act="cancel"]').addEventListener('click', closeModal);
  modal.querySelector('[data-act="ok"]').addEventListener('click', () => {
    const res = exchangeCodex(id);
    closeModal();
    if (!res.ok) return toast(res.error);
    playSound('reward');
    const done = (res.completed || []).map((n) => {
      const g = getCodexSetStatus().find((x) => x.name === n);
      const b = g ? Object.entries(g.bonus).map(([k, v]) => `${{ atkPct: '攻擊', hpPct: '氣血' }[k] || k} +${Math.round(v * 100)}%`).join('、') : '';
      return `${n}完成：${b}`;
    });
    toast(done.length ? `${icon('star')} ${done.join('；')}` : `已兌換「${e.name}」`, done.length ? CONFIG.fx.toast.long : CONFIG.fx.toast.normal);
    saveGame();
    renderAll();
    renderCodex(true);
  });
}

// ---------- 坊市 ----------

function renderMarket(force = false) {
  if (!pageActive('market', force)) return;
  ensureMarketFresh();
  const cards = state.shop.market.items
    .map((slot, i) => {
      const e = getMarketEntry(slot.id);
      const price = getMarketPrice(e);
      const lack = state.gold < price;
      return `<div class="shop-card ${slot.bought ? 'sold' : ''}">
        <span class="shop-icon">${icon(e.icon)}</span>
        <div class="shop-name">${e.name}</div>
        ${e.reward.loot ? `<button class="odds-link" data-act="odds" data-arg="${e.reward.loot}">查看機率</button>` : ''}
        <button class="shop-buy" data-act="buy" data-arg="${i}" ${slot.bought || lack ? 'disabled' : ''}>${slot.bought ? '已售出' : `${ri('gold')}${fmtNum(price)}`}</button>
      </div>`;
    })
    .join('');
  const cost = getMarketRefreshCost();
  const panel = $('#market-panel');
  setHTML(panel, `<div class="card">
    <div class="sub-title">${icon('lantern')}坊市<small class="daily-reset">每日子時刷新</small></div>
    <div class="shop-grid">${cards}</div>
    <button class="btn-secondary market-refresh" data-act="refresh" ${state.upgradeStones < cost ? 'disabled' : ''}>立即刷新 ${ri('stones')}×${cost}</button>
  </div>`);
  bindPanel(panel, {
    odds: (id) => showOdds(id),
    buy: async (i) => {
      const slot = state.shop.market.items[Number(i)];
      const e = getMarketEntry(slot.id);
      if (e.reward.loot && !(await confirmPurchase({ title: e.name, priceHTML: `${ri('gold')}${fmtNum(getMarketPrice(e))}`, reward: e.reward }))) return;
      const res = buyMarketItem(Number(i));
      if (!res.ok) return toast(res.error);
      if (res.got.items.length || res.got.rolled.length) showPurchaseResult(res.got, { title: e.name });
      else {
        playSound('coin');
        toast(`購得 ${e.name}`);
      }
      afterShopChange();
    },
    refresh: async () => {
      if (!(await askConfirm(`花費仙玉 ${getMarketRefreshCost()} 立即刷新坊市？`, { okText: '刷新' }))) return;
      const res = refreshMarketManual();
      if (!res.ok) return toast(res.error);
      playSound('coin');
      afterShopChange();
    },
  });
}

// ---------- 仙玉商店 ----------

function renderGemshop(force = false) {
  if (!pageActive('gemshop', force)) return;
  const items = CONFIG.shop.gem
    .map((e) => {
      const lack = state.upgradeStones < e.price;
      return `<div class="shop-card">
        <span class="shop-icon">${icon(e.icon)}</span>
        <div class="shop-name">${e.name}</div>
        ${e.desc ? `<div class="shop-desc">${e.desc}</div>` : ''}
        ${e.reward.loot ? `<button class="odds-link" data-act="odds" data-arg="${e.reward.loot}">查看機率</button>` : ''}
        <button class="shop-buy" data-act="buy" data-arg="${e.id}" ${lack ? 'disabled' : ''}>${ri('stones')}${e.price}</button>
      </div>`;
    })
    .join('');
  const cos = Object.entries(CONFIG.shop.cosmetics)
    .map(([id, c]) => {
      const owned = state.shop.cosmetics.owned.includes(id);
      const on = state.shop.cosmetics.equipped === id;
      const btn = on
        ? '<span class="daily-done">穿戴中</span>'
        : owned
          ? `<button class="shop-buy" data-act="wear" data-arg="${id}">穿戴</button>`
          : c.price === null
            ? `<span class="daily-done">${c.source || '無法購買'}</span>`
            : `<button class="shop-buy" data-act="cos" data-arg="${id}" ${state.upgradeStones < c.price ? 'disabled' : ''}>${ri('stones')}${c.price}</button>`;
      return `<div class="shop-card"><span class="shop-icon cos-preview" style="color:${c.color || 'var(--ink)'};--aura:${c.aura || 'transparent'}">${icon('hero')}</span>
        <div class="shop-name">${c.name}</div>${btn}</div>`;
    })
    .join('');
  const dbl = isDoubleActive() ? `<div class="buff-on">${ri('star')}雙倍收益生效中，剩 ${Math.ceil((state.shop.doubleUntil - Date.now()) / 3600000)} 小時</div>` : '';
  const panel = $('#gemshop-panel');
  setHTML(panel, `<div class="card"><div class="sub-title">${icon('stones')}仙玉商店<small class="daily-reset">仙玉 ${state.upgradeStones}</small></div>${dbl}<div class="shop-grid">${items}</div></div>
    <div class="card"><div class="sub-title">${icon('hero')}外觀<small class="daily-reset">只改變外觀，不影響數值</small></div><div class="shop-grid">${cos}</div></div>`);
  bindPanel(panel, {
    odds: (id) => showOdds(id),
    buy: async (id) => {
      const e = CONFIG.shop.gem.find((x) => x.id === id);
      if (!(await confirmPurchase({ title: e.name, priceHTML: `${ri('stones')}${e.price}`, reward: e.reward, note: e.desc }))) return;
      const res = buyGemItem(id);
      if (!res.ok) return toast(res.error);
      showPurchaseResult(res.got, { title: e.name });
      afterShopChange();
    },
    cos: async (id) => {
      const c = CONFIG.shop.cosmetics[id];
      if (!(await askConfirm(`花費仙玉 ${c.price} 購買外觀「${c.name}」？`, { okText: '購買' }))) return;
      const res = buyCosmetic(id);
      if (!res.ok) return toast(res.error);
      playSound('unlock');
      toast(`換上外觀「${c.name}」`);
      afterShopChange();
    },
    wear: (id) => {
      equipCosmetic(id);
      playSound('equip');
      afterShopChange();
    },
  });
}

// ---------- 儲值：在 ui-recharge.js ----------

// ---------- 成就 ----------

function renderAchieve(force = false) {
  if (!pageActive('achieve', force)) return;
  const done = state.achievements.done.length;
  // 挑戰型成就（challenge）排在一起、放最後，名稱旁標「挑戰」（D3）
  const list = [...CONFIG.achievements.filter((a) => !a.challenge), ...CONFIG.achievements.filter((a) => a.challenge)];
  const rows = list
    .map((a) => {
      const isDone = state.achievements.done.includes(a.id);
      const claimed = state.achievements.claimed.includes(a.id);
      const v = Math.min(a.target, getAchievementValue(a));
      return `<div class="daily-row ${claimed ? 'done' : ''}">
        <span class="ach-icon ${isDone ? 'on' : ''}">${icon('trophy')}</span>
        <div class="daily-main">
          <div class="daily-name">${a.name}${a.challenge ? '<span class="ach-challenge">挑戰</span>' : ''}<small>${getAchievementDesc(a)}</small></div>
          <div class="daily-bar"><div class="daily-fill" style="width:${(v / a.target) * 100}%"></div><span>${fmtNum(v)}/${fmtNum(a.target)}</span></div>
        </div>
        <div class="daily-side"><div class="daily-reward">${rewardSpecHTML(a.reward)}</div>
          ${claimed ? '<span class="daily-done">已領取</span>' : `<button class="daily-claim" data-act="claim" data-arg="${a.id}" ${isDone ? '' : 'disabled'}>領取</button>`}</div>
      </div>`;
    })
    .join('');
  const panel = $('#achieve-panel');
  setHTML(panel, `<div class="card"><div class="sub-title">${icon('trophy')}成就<small class="daily-reset">${done}/${CONFIG.achievements.length}</small></div>${rows}</div>`);
  bindPanel(panel, {
    claim: (id) => {
      const got = claimAchievement(id);
      if (!got) return;
      playSound('reward');
      toast(`成就獎勵 ${rewardGotHTML(got)}`);
      afterShopChange();
    },
  });
}

// 月曆簽到在 ui-daily.js
