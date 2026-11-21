// @ts-check
/* =========================================================
 * ui-recharge.js — 儲值分頁（測試模式）
 *   從 ui-pages.js 拆出：仙玉方案、首儲專屬、月卡、新手禮包、累計儲值、修仙戰令（賽季）、模擬訂單
 *   每個付費商品都標示「價值 X 倍」（換算方式見 CONFIG.valuation）
 * ========================================================= */

/** 「價值 X 倍」標籤 */
function valueBadgeHTML(id) {
  const x = getProductValueMultiple(id);
  if (!x) return '';
  return `<span class="value-badge">價值 ${x >= 10 ? Math.round(x) : x.toFixed(1)} 倍</span>`;
}

function renderRecharge(force = false) {
  if (!pageActive('recharge', force)) return;
  const r = CONFIG.shop.recharge;
  const cur = r.currency;

  // 首儲專屬
  const exclusive = state.shop.firstExclusiveDone
    ? ''
    : `<div class="rc-exclusive">${ri('star')}首次儲值任一方案，加送 <b>${r.firstExclusive.name.replace(/^.*：/, '')}</b>（隨機種類）
        <button class="odds-link" data-act="odds" data-arg="${r.firstExclusive.reward.loot}">查看機率</button></div>`;

  // 仙玉方案
  const gems = r.gems
    .map((g) => {
      const first = r.firstDouble && !state.shop.firstDone.includes(g.id);
      const amount = g.gems + g.bonus;
      const bonusPct = Math.round((g.bonus / g.gems) * 100);
      return `<button class="rc-gem" data-act="pay" data-arg="${g.id}">
        ${first ? '<span class="rc-badge">首儲雙倍</span>' : ''}
        <span class="rc-amount">${icon('stones')}${first ? `<s>${amount}</s> ${amount * r.firstMult}` : amount}</span>
        <span class="rc-bonus">含贈送 ${bonusPct}%</span>
        ${valueBadgeHTML(g.id)}
        <span class="rc-price">${cur} ${g.price}</span>
      </button>`;
    })
    .join('');

  // 月卡
  const m = r.monthCard;
  const mActive = isMonthCardActive();
  const left = getMonthCardDaysLeft();
  const month = `<div class="rc-card">
    <div class="rc-head"><b>${m.name}</b>${valueBadgeHTML(m.id)}<span>${cur} ${m.price}</span></div>
    <div class="rc-desc">購買立即獲得 ${ri('stones')}${m.instant}，之後 ${m.days} 天<b>每天第一次上線自動發放</b> ${ri('stones')}${m.daily}（共 ${m.instant + m.daily * m.days}）</div>
    ${mActive ? `<div class="buff-on ${left <= m.remindDays ? 'warn' : ''}">生效中，剩 ${left} 天${left <= m.remindDays ? '，即將到期' : ''}</div>` : ''}
    <button class="btn-secondary" data-act="pay" data-arg="${m.id}">${mActive ? '續購' : '購買'} ${cur} ${m.price}</button>
  </div>`;

  // 新手禮包
  const st = r.starter;
  const starterBought = (state.shop.purchases[st.id] || 0) >= st.limit;
  const starter = `<div class="rc-card">
    <div class="rc-head"><b>${st.name}</b>${valueBadgeHTML(st.id)}<span>${cur} ${st.price}・限購 ${st.limit} 次</span></div>
    <div class="rc-desc">${rewardSpecHTML(st.reward)}</div>
    ${oddsTableHTML(st.reward.loot)}
    <button class="btn-dg" data-act="pay" data-arg="${st.id}" ${starterBought ? 'disabled' : ''}>${starterBought ? '已購買' : `購買 ${cur} ${st.price}`}</button>
  </div>`;

  // 累計儲值
  const spendRows = r.spendRewards
    .map((t, i) => {
      const done = state.shop.spendClaimed.includes(i);
      const ready = canClaimSpendReward(i);
      const odds = t.reward.loot ? `<button class="odds-link" data-act="odds" data-arg="${t.reward.loot}">查看機率</button>` : '';
      return `<div class="daily-row ${done ? 'done' : ''}">
        <div class="daily-main"><div class="daily-name">累計 ${cur} ${t.amount}</div><div class="daily-desc">${rewardSpecHTML(t.reward)} ${odds}</div></div>
        <div class="daily-side">${done ? '<span class="daily-done">已領取</span>' : `<button class="daily-claim" data-act="spend" data-arg="${i}" ${ready ? '' : 'disabled'}>領取</button>`}</div>
      </div>`;
    })
    .join('');
  const spend = `<div class="sub-title">${icon('trophy')}累計儲值獎勵<small class="daily-reset">目前累計 ${cur} ${state.shop.totalSpent}</small></div>${spendRows}`;

  setHTML($('#recharge-panel'), `<div class="test-banner">測試模式：按下購買只會模擬付款，不會實際扣款</div>
    <div class="card"><div class="sub-title">${icon('stones')}仙玉</div>${exclusive}<div class="rc-gems">${gems}</div></div>
    <div class="card">${month}${starter}</div>
    <div class="card">${renderPassCard()}</div>
    <div class="card">${spend}</div>
    ${rechargeOrdersHTML()}`);
  bindRechargePanel();
}

/** 修仙戰令（賽季）卡片 */
function renderPassCard() {
  if (!isFeatureOpen('pass')) {
    return `<div class="sub-title">${icon('scroll')}修仙戰令</div>
      <div class="locked-note">${ri('lock')}${getFeatureLockText('pass')}<small>鎖住期間戰令經驗照常累積（目前 ${Math.floor(state.shop.pass.exp)}），開放時可以一次領取</small></div>`;
  }
  const r = CONFIG.shop.recharge;
  const cfg = CONFIG.pass;
  const p = state.shop.pass;
  const level = getPassLevel();
  const max = cfg.tiers.length;
  const expInLevel = level >= max ? cfg.expPerTier : Math.floor(p.exp - level * cfg.expPerTier);
  const rows = cfg.tiers
    .map((t, i) => {
      const cell = (line, reward) => {
        const claimed = p[line].includes(i);
        const can = canClaimPass(i, line);
        const locked = line === 'premium' && !p.paid;
        return `<button class="pass-cell ${claimed ? 'claimed' : ''} ${line}" data-act="pass" data-arg="${i}:${line}" ${can ? '' : 'disabled'}>
          ${rewardSpecHTML(reward)}${claimed ? '<i>已領</i>' : locked ? `<i>${ri('lock')}</i>` : ''}</button>`;
      };
      return `<div class="pass-row ${i < level ? 'reached' : ''}"><span class="pass-lv">${i + 1} 級</span>${cell('free', t.free)}${cell('premium', t.premium)}</div>`;
    })
    .join('');
  const claimable = countClaimablePass();
  return `<div class="rc-head"><b>${r.pass.name}・第 ${p.season} 季</b>${p.paid ? '' : valueBadgeHTML(r.pass.id)}<span>剩 ${getSeasonDaysLeft()} 天</span></div>
    <div class="rc-desc">開爐、修煉擊殺、每日任務、每天上線都會累積戰令經驗。免費線人人可領；付費線購買後<b>立即補發所有已達成等級</b>。
      賽季結束時，已達成但未領取的獎勵會<b>自動寄到信箱</b>，不會消失。</div>
    <div class="pass-progress"><span>等級 ${level} / ${max}</span>
      <div class="bar"><div class="bar-fill" style="width:${level >= max ? 100 : (expInLevel / cfg.expPerTier) * 100}%"></div></div>
      <span>${level >= max ? '已滿級' : `${expInLevel} / ${cfg.expPerTier}`}</span></div>
    <div class="rc-btns">
      ${p.paid ? '<div class="buff-on">本季付費線已解鎖</div>' : `<button class="btn-dg" data-act="pay" data-arg="${r.pass.id}">解鎖付費線 ${r.currency} ${r.pass.price}</button>`}
      <button class="btn-secondary" data-act="passAll" ${claimable ? '' : 'disabled'}>一鍵領取${claimable ? `（${claimable}）` : ''}</button>
    </div>
    <div class="pass-head"><span>等級</span><span>免費線</span><span>付費線</span></div>
    <div class="pass-list">${rows}</div>`;
}

function rechargeOrdersHTML() {
  const cur = CONFIG.shop.recharge.currency;
  const orders = state.shop.orders
    .slice(0, CONFIG.shop.orderLogShown)
    .map((o) => `<div class="order-row"><span>${new Date(o.time).toLocaleString()}</span><span>${(getRechargeProduct(o.id) || { name: o.id }).name}</span><span>${cur} ${o.price}</span></div>`)
    .join('');
  return orders ? `<div class="card"><div class="sub-title">${icon('scroll')}最近的模擬訂單</div>${orders}</div>` : '';
}

function bindRechargePanel() {
  const r = CONFIG.shop.recharge;
  bindPanel($('#recharge-panel'), {
    odds: (id) => showOdds(id),
    pay: async (id) => {
      const product = getRechargeProduct(id);
      const block = getProductBlockReason(id);
      if (block) return toast(block);
      const notes = [];
      if (id === r.monthCard.id) notes.push(`之後 ${r.monthCard.days} 天每天第一次上線自動發放 ${r.monthCard.daily} 仙玉（今天的份購買後立即發放）`);
      if (id === r.pass.id) notes.push(`立即補發目前已達成的 ${getPassLevel()} 級付費線獎勵；本季剩 ${getSeasonDaysLeft()} 天`);
      if (product.firstDouble) notes.push('首次購買此方案，仙玉加倍');
      if (product.firstExclusive) notes.push(`首次儲值加送：${r.firstExclusive.name}`);
      const x = getProductValueMultiple(id);
      if (x) notes.push(`價值約為售價的 ${x >= 10 ? Math.round(x) : x.toFixed(1)} 倍`);
      if (!(await confirmPurchase({ title: product.name, priceHTML: `${r.currency} ${product.price}`, reward: product.reward, note: notes.join('<br>') }))) return;
      const res = await purchaseProduct(id);
      if (!res.ok) return toast(res.error);
      showPurchaseResult(res.got, { title: product.name, test: PaymentProvider.mode === 'test' });
      afterShopChange();
    },
    pass: (arg) => {
      const [i, line] = arg.split(':');
      const got = claimPass(Number(i), line);
      if (!got) return;
      showRewardToastOrModal(got, '修仙戰令');
      afterShopChange();
    },
    passAll: () => {
      const got = claimAllPass();
      if (!got) return;
      showRewardToastOrModal(got, '修仙戰令');
      afterShopChange();
    },
    spend: (i) => {
      const got = claimSpendReward(Number(i));
      if (!got) return;
      showPurchaseResult(got, { title: '累計儲值獎勵' });
      afterShopChange();
    },
  });
}

/** 只有資源時用提示訊息；有法寶、靈獸或隨機結果時跳視窗 */
function showRewardToastOrModal(got, title) {
  if (got.items.length || got.beasts.length || got.rolled.length) showPurchaseResult(got, { title });
  else {
    playSound('reward');
    toast(`${title} ${rewardGotHTML(got)}`);
  }
}
