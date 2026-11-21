// @ts-check
/* =========================================================
 * ui-nav.js — 底部分頁、子分頁、鎖住的分頁（功能開放表）、分頁提示點（從 ui.js 拆出）
 * ========================================================= */

// ---------- 分頁 ----------

/** 底部主分頁 → 子分頁（第一個為預設） */
const TAB_GROUPS = {
  main: [{ page: 'main' }],
  dungeon: [{ page: 'dungeon' }],
  hero: [{ page: 'dao', label: '道途' }, { page: 'beast', label: '靈獸' }, { page: 'enhance', label: '強化' }, { page: 'ascend', label: '飛升' }],
  forge: [{ page: 'chest', label: '煉器爐' }, { page: 'codex', label: '圖鑑' }],
  shop: [{ page: 'market', label: '坊市' }, { page: 'gemshop', label: '仙玉商店' }, { page: 'recharge', label: '儲值' }],
  more: [{ page: 'achieve', label: '成就' }, { page: 'signin', label: '簽到' }, { page: 'mail', label: '信箱' }, { page: 'settings', label: '設定' }],
};
const lastSubPage = {}; // 每組上次停留的子分頁

/** 子分頁 → 功能開放表的功能 id（沒列出的一開始就能用：修煉、設定） */
const PAGE_FEATURES = {
  dungeon: 'dungeon',
  dao: 'dao',
  beast: 'beast',
  enhance: 'enhance',
  ascend: 'ascension',
  chest: 'chestUpgrade',
  codex: 'codex',
  market: 'market',
  gemshop: 'shop',
  recharge: 'shop',
  achieve: 'achieve',
  signin: 'signin',
  mail: 'pass',
};

/** 子分頁是否已開放 */
function isPageOpen(page) {
  return !PAGE_FEATURES[page] || isFeatureOpen(PAGE_FEATURES[page]);
}

/** 主分頁是否已開放（任一子分頁開放就算） */
function isGroupOpen(group) {
  return TAB_GROUPS[group].some((x) => isPageOpen(x.page));
}

/** 點到鎖住的分頁：說明解鎖條件 */
function showLockedInfo(pages) {
  const lines = [...new Set(pages.map((p) => PAGE_FEATURES[p]).filter(Boolean))].map((id) => getFeatureLockText(id)).filter(Boolean);
  playSound('click');
  toast(`${ri('lock')} ${lines.join('<br>')}`, CONFIG.fx.toast.long);
}

function getGroupOfPage(page) {
  return Object.keys(TAB_GROUPS).find((g) => TAB_GROUPS[g].some((x) => x.page === page));
}

/** 各分頁目前的渲染函式（切換過去時強制重繪） */
const PAGE_RENDERERS = {
  dungeon: () => (renderDungeons(true), renderDaily(true)),
  dao: () => renderDao(true),
  beast: () => renderBeasts(true),
  enhance: () => renderEnhance(true),
  ascend: () => renderAscend(true),
  codex: () => renderCodex(true),
  market: () => renderMarket(true),
  gemshop: () => renderGemshop(true),
  recharge: () => renderRecharge(true),
  achieve: () => renderAchieve(true),
  signin: () => renderSignin(true),
  mail: () => renderMail(true),
  settings: () => {
    renderAscendBackupButton();
    renderSaveSettings();
    renderAppSettings();
  },
};

/**
 * 切換分頁：可以給主分頁（hero）或子分頁（beast）
 */
function switchTab(name) {
  let group = TAB_GROUPS[name] ? name : getGroupOfPage(name);
  if (!group) return;
  // 鎖住的分頁不能進入：說明解鎖條件
  if (!isGroupOpen(group)) return showLockedInfo(TAB_GROUPS[group].map((x) => x.page));
  if (!TAB_GROUPS[name] && !isPageOpen(name)) return showLockedInfo([name]);
  const firstOpen = TAB_GROUPS[group].find((x) => isPageOpen(x.page)).page;
  const remembered = lastSubPage[group] && isPageOpen(lastSubPage[group]) ? lastSubPage[group] : firstOpen;
  const page = TAB_GROUPS[name] ? remembered : name;
  lastSubPage[group] = page;
  $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === group));
  $$('.tab-page').forEach((p) => p.classList.toggle('active', p.dataset.page === page));
  // 子分頁列
  const subs = TAB_GROUPS[group];
  const nav = $('#subnav');
  nav.classList.toggle('hidden', subs.length < 2);
  nav.innerHTML = subs
    .map((x) => {
      const open = isPageOpen(x.page);
      return `<button class="sub-btn ${x.page === page ? 'active' : ''} ${open ? '' : 'locked'}" data-sub="${x.page}">${open ? '' : ri('lock')}${x.label}</button>`;
    })
    .join('');
  $$('[data-sub]', nav).forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.sub)));
  if (PAGE_RENDERERS[page]) PAGE_RENDERERS[page]();
  renderTabNotices();
  window.scrollTo(0, 0);
  showPageTutorial(page);
}

// ---------- 分頁提示點 ----------

/** 各子分頁是否有可領取／待處理的東西 → 子分頁與主分頁都亮提示點 */
function getPageNotices() {
  const n = {
    dungeon: countClaimableDaily() > 0 || !getTowerSweepBlockReason(), // 每日塔俸還沒領（D2）
    dao: (isDaoUnlocked() && !state.dao.path) || canAscendDao() || getPendingTalentTier() > 0,
    beast: state.beasts.eggs > 0,
    codex: countClaimableCodex() > 0,
    achieve: countClaimableAchievements() > 0,
    signin: canSignIn(),
    recharge: countClaimablePass() > 0 || countClaimableSpendRewards() > 0,
    mail: countMail() > 0,
    ascend: hasAscendNotice(),
  };
  // 鎖住的分頁不亮提示點（進度照常在背後累積，開放時一次領取）
  for (const page of Object.keys(n)) if (!isPageOpen(page)) n[page] = false;
  return n;
}

/** 底部主分頁的鎖頭（全部子分頁都鎖住時） */
function renderTabLocks() {
  for (const group of Object.keys(TAB_GROUPS)) {
    const btn = document.querySelector(`.tab-btn[data-tab="${group}"]`);
    if (btn) btn.classList.toggle('locked', !isGroupOpen(group));
  }
}

function renderTabNotices() {
  renderTabLocks();
  const n = getPageNotices();
  for (const [group, subs] of Object.entries(TAB_GROUPS)) {
    const btn = document.querySelector(`.tab-btn[data-tab="${group}"]`);
    if (btn) btn.classList.toggle('notice', subs.some((x) => n[x.page]));
  }
  $$('#subnav [data-sub]').forEach((b) => b.classList.toggle('notice', !!n[b.dataset.sub]));
}

