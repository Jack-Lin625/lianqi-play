// @ts-check
/* =========================================================
 * ui-tutorial.js — 新手引導（從 ui.js 拆出）
 *   條件觸發的引導：checkTutorialConditions（資源變動時檢查；功能開放的說明在 ui-unlock.js）
 *   第一次進入某個分頁的說明：showPageTutorial（switchTab 時呼叫）
 * ========================================================= */

/**
 * 引導步驟
 *   target   要高亮的元素
 *   pos      提示框位置 'top' | 'bottom'
 *   inModal  提示的對象在彈窗裡，彈窗關閉時一併關閉提示
 */
const TUTORIALS = {
  welcome: {
    icon: 'hero',
    text: '道友請了！修士會自動與妖獸鬥法、逐層精進境界。<br>點「<b>開爐</b>」燒一張爐火符，煉出法寶增強戰力！',
    target: '#btn-open',
    pos: 'bottom',
  },
  compare: {
    icon: 'scroll',
    text: '煉出更好的法寶了！最上方是佩戴後的<b>戰力變化</b>，按「<b>佩戴</b>」換上它。',
    target: '.modal .btn-equip',
    pos: 'top',
    inModal: true,
  },
  keysOut: {
    icon: 'keys',
    text: '爐火符用完了！<b>突破境界</b>會得到爐火符，掛機修煉就會累積，閉關時也有收益。',
    target: null,
    pos: 'bottom',
  },
  firstDefeat: {
    icon: 'lightning',
    text: '打不過了？試試：<br>① 開爐煉出更好的法寶<br>② 到「<b>煉器</b>」分頁用靈石提升煉器爐，煉出高品階的機率會提高',
    target: '.tab-btn[data-tab="forge"]',
    pos: 'bottom',
  },
  retreat: {
    icon: 'cycle',
    text: '連續失敗會<b>退回前一層</b>穩固修為。變強之後，按「<b>衝擊</b>」再試一次！',
    target: '#btn-challenge',
    pos: 'bottom',
  },
  enhancePage: {
    icon: 'iron',
    text: '強化等級屬於<b>部位</b>，換上新法寶也會保留，而且<b>每次必定成功</b>。<br>+6 起需要<b>玄鐵</b>，可從每日任務、上古妖王、坊市取得。',
    target: '#enhance-panel .enh-btn',
    pos: 'bottom',
  },
  shopPage: {
    icon: 'lantern',
    text: '坊市商品每天 00:00 刷新，也可以花仙玉立即刷新。<br>旁邊的「<b>仙玉商店</b>」用仙玉購買高級道具與外觀；有隨機內容的商品都會先公示機率。',
    target: '#market-panel .shop-buy',
    pos: 'bottom',
  },
  codexPage: {
    icon: 'scroll',
    text: '每個境界、每個部位都有專屬法寶，還有 12 件<b>仙品</b>帶有特效。<br>收集越多種，能領的獎勵越多。',
    target: '#codex-panel .daily-claim',
    pos: 'bottom',
  },
  ascendPage: {
    icon: 'lotus',
    text: '<b>飛升</b>：關卡從頭再爬，靈石與爐火符只留一成；<b>法寶、爐階、強化、道途、靈獸等全部保留</b>，所以重爬很快。<br>換得的<b>仙元</b>可以點飛升天賦。下一輪可以選<b>天劫</b>層數：妖獸更強、仙元更多，打不過隨時降層。',
    target: '#btn-ascend',
    pos: 'top',
  },
};

/** 第一次進入某個分頁時顯示的說明 */
const PAGE_TUTORIALS = { enhance: 'enhancePage', market: 'shopPage', codex: 'codexPage', ascend: 'ascendPage' };

/** 第一次進入分頁：顯示該分頁的說明（新玩家看完開場引導之後） */
function showPageTutorial(page) {
  if (!state || !isTutorialSeen('welcome')) return;
  const id = PAGE_TUTORIALS[page];
  if (id) showTutorial(id);
}

let coachActive = null; // 目前顯示中的引導 id
const coachQueue = [];

function isTutorialSeen(id) {
  return state.tutorial.seen.includes(id);
}

/** 顯示引導（看過的不再顯示；同時只顯示一個，其餘排隊） */
function showTutorial(id) {
  if (battleSilent || !TUTORIALS[id] || isTutorialSeen(id)) return;
  if (coachActive === id || coachQueue.includes(id)) return;
  if (coachActive) {
    coachQueue.push(id);
    return;
  }
  const t = TUTORIALS[id];
  coachActive = id;
  const root = $('#coach-root');
  root.innerHTML = `<div class="coach">
    <div class="coach-icon">${icon(t.icon)}</div>
    <div class="coach-body">${t.text}<br><button class="coach-ok">知道了</button></div>
  </div>`;
  root.querySelector('.coach-ok').addEventListener('click', dismissCoach);
  const el = t.target ? document.querySelector(t.target) : null;
  if (el) {
    el.classList.add('coach-target');
    // 畫面外的目標先捲動到可見處（固定在畫面上的分頁列不用捲；彈窗內的只在彈窗內捲動）
    if (el.closest('.modal')) el.scrollIntoView({ block: 'nearest' });
    else if (!el.closest('#tab-bar')) el.scrollIntoView({ block: 'center' });
  }
  positionCoach();
  // 彈窗有展開動畫，播完後位置才準確，再定位一次
  setTimeout(positionCoach, CONFIG.fx.coachRepositionMs);
}

/** 把提示框放在目標的上方或下方，避免擋住要點的按鈕 */
function positionCoach() {
  const root = $('#coach-root');
  if (!coachActive) return;
  root.style.top = '';
  root.style.bottom = '';
  const t = TUTORIALS[coachActive];
  const el = t.target ? document.querySelector(t.target) : null;
  if (!el) {
    root.className = t.pos;
    return;
  }
  root.className = '';
  const rect = el.getBoundingClientRect();
  const boxH = root.offsetHeight;
  const gap = 10;
  const tabbarH = $('#tab-bar').offsetHeight;
  if (rect.bottom + gap + boxH <= window.innerHeight - tabbarH) {
    root.style.top = rect.bottom + gap + 'px'; // 放在目標下方
  } else {
    root.style.bottom = window.innerHeight - rect.top + gap + 'px'; // 放在目標上方
  }
}

/** 關閉目前的引導並記錄為已看過 */
function dismissCoach() {
  if (!coachActive) return;
  if (!isTutorialSeen(coachActive)) state.tutorial.seen.push(coachActive);
  saveGame();
  $$('.coach-target').forEach((el) => el.classList.remove('coach-target'));
  $('#coach-root').innerHTML = '';
  coachActive = null;
  // 下一個還沒看過的引導
  while (coachQueue.length > 0) {
    const next = coachQueue.shift();
    if (!isTutorialSeen(next)) {
      showTutorial(next);
      break;
    }
  }
}

/** 依目前狀態觸發的引導（資源變動時檢查） */
function checkTutorialConditions() {
  if (battleSilent || !isTutorialSeen('welcome')) return;
  if (state.keys < getOpenKeyCost(1) && !autoRun.active) showTutorial('keysOut');
  // 各功能的開放說明改由功能開放表處理（ui-unlock.js：演出 → 說明 → 前往）
}

