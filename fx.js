// @ts-check
/* =========================================================
 * fx.js — 遊戲回饋演出（不影響數值與存檔）
 *   按鈕點擊回饋、貨幣數字滾動、畫面震動、慢動作、
 *   全螢幕儀式（天劫雷光、煉器爐升階、道途入道）、開爐符文陣、成就提示
 * ========================================================= */

const fx = {
  timeScale: 1, // 慢動作時 < 1（main.js 的邏輯更新會乘上）
  slowUntil: 0,
};

// ---------- 按鈕點擊回饋 ----------

/** 所有按鈕：按下時輕微縮放 + 點擊音 */
function installButtonFeedback() {
  let last = 0;
  document.addEventListener('pointerdown', (e) => {
    const btn = /** @type {HTMLButtonElement|null} */ (/** @type {Element} */ (e.target).closest('button'));
    if (!btn || btn.disabled) return;
    replayAnim(btn, 'pressed');
    const now = performance.now();
    if (now - last > 60) playSound('click');
    last = now;
  });
}

// ---------- 數字滾動 ----------

/**
 * 數字從目前顯示值滾動到新值；增加時閃一下
 * @param {HTMLElement} el
 * @param {number} value
 * @param {(n:number)=>string} format
 */
/** 每個數字元素目前顯示的值與動畫 { value, raf } */
const numberAnim = new WeakMap();

function animateNumber(el, value, format = fmtNum) {
  const anim = numberAnim.get(el) || { value: undefined, raf: 0 };
  numberAnim.set(el, anim);
  const from = anim.value === undefined ? value : anim.value;
  anim.value = value;
  if (anim.raf) cancelAnimationFrame(anim.raf);
  if (from === value || battleSilent) {
    el.textContent = format(value);
    return;
  }
  if (value > from) replayAnim(el, 'gain');
  const start = performance.now();
  const dur = CONFIG.fx.numberRollMs;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(from + (value - from) * eased);
    if (t < 1) anim.raf = requestAnimationFrame(tick);
  };
  anim.raf = requestAnimationFrame(tick);
}

// ---------- 震動、慢動作 ----------

/** 畫面震動（strength：'light' | 'heavy'） */
function screenShake(strength = 'light') {
  replayAnim($('#app'), strength === 'heavy' ? 'shake-heavy' : 'shake-light');
}

/** 慢動作：在 ms 毫秒內，戰鬥時間以 scale 倍速進行 */
function slowMotion(ms = CONFIG.fx.bossSlowMs, scale = CONFIG.fx.bossSlowScale) {
  fx.timeScale = scale;
  fx.slowUntil = performance.now() + ms;
  document.body.classList.add('slowmo');
}

/** 每一幀呼叫：慢動作結束就恢復 */
function updateFx(now) {
  if (fx.timeScale < 1 && now >= fx.slowUntil) {
    fx.timeScale = 1;
    document.body.classList.remove('slowmo');
  }
}

// ---------- 全螢幕儀式 ----------

/**
 * 全螢幕演出（點一下可提前結束）
 * @param {{kind: 'tribulation'|'furnace'|'dao'|'unlock'|'ascend', title: string, subtitle?: string, ms?: number}} o
 */
function playCeremony(o) {
  if (battleSilent) return;
  const root = $('#ceremony-root');
  const art = {
    // 天劫：數道雷光劈下
    tribulation: `<svg class="cer-bolts" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
        <path d="M120 0 100 90 130 95 90 200 150 80 118 76 140 0Z"/>
        <path d="M280 0 262 70 290 74 250 170 310 60 280 58 300 0Z"/>
        <path d="M205 0 190 120 215 124 180 260 240 100 212 96 225 0Z"/>
      </svg>`,
    furnace: `<div class="cer-icon">${icon('furnace')}</div>`,
    dao: `<div class="cer-icon cer-spin">${icon('taiji')}</div>`,
    unlock: `<div class="cer-icon cer-spin">${icon('seal')}</div>`, // 功能開放
    ascend: `<div class="cer-icon cer-spin">${icon('lotus')}</div>`, // 飛升
  }[o.kind];
  root.innerHTML = `<div class="ceremony ceremony-${o.kind}">
    ${art}
    <div class="cer-text">
      <div class="cer-title">${o.title}</div>
      ${o.subtitle ? `<div class="cer-sub">${o.subtitle}</div>` : ''}
    </div>
  </div>`;
  const el = root.firstElementChild;
  playSound(o.kind === 'tribulation' ? 'thunder' : o.kind === 'dao' || o.kind === 'ascend' ? 'mythic' : o.kind === 'unlock' ? 'unlock' : 'upgrade');
  if (o.kind === 'tribulation') screenShake('heavy');
  const close = () => {
    if (!el.isConnected) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), CONFIG.fx.ceremonyFadeMs);
  };
  el.addEventListener('click', close);
  setTimeout(close, o.ms || CONFIG.fx.ceremonyMs);
}

// ---------- 開爐演出（依品階） ----------

/** 依最高品階決定開爐後多久揭曉 */
function getRevealDelay(maxRarity) {
  const a = CONFIG.chestAnim;
  if (maxRarity >= a.mythicRarity) return a.revealDelayMs + a.runeMs + a.mythicHoldMs;
  if (maxRarity >= a.runeFromRarity) return a.revealDelayMs + a.runeMs;
  if (maxRarity >= a.goldLightFromRarity) return a.revealDelayMs + a.goldLightHoldMs;
  return a.revealDelayMs;
}

/**
 * 天品以上：全螢幕金光 + 八卦符文陣展開 + 停頓再揭曉；仙品再加震動、專屬音效與名稱介紹
 * @param {Object} best 開出的最高品階法寶
 */
function playRuneReveal(best, rarityIndex) {
  const ov = $('#rune-overlay');
  const color = CONFIG.rarities[rarityIndex].color;
  const glyphs = ['乾', '兌', '離', '震', '巽', '坎', '艮', '坤'];
  const ring = glyphs
    .map((g, i) => {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      return `<text x="${100 + Math.cos(a) * 74}" y="${100 + Math.sin(a) * 74 + 7}">${g}</text>`;
    })
    .join('');
  const tpl = best && best.mythic ? GEAR_INDEX[best.mythic] : null;
  ov.innerHTML = `<div class="rune-flash"></div>
    <svg class="rune-circle" viewBox="0 0 200 200" aria-hidden="true" style="--rune:${color}">
      <circle cx="100" cy="100" r="92" class="rc1"/><circle cx="100" cy="100" r="56" class="rc2"/>
      <path class="rc3" d="M100 20 169 140H31Z M100 180 31 60H169Z"/>
      <g class="rune-glyphs">${ring}</g>
    </svg>
    ${tpl ? `<div class="rune-name"><div class="rn-title">${tpl.name}</div><div class="rn-desc">${tpl.desc}</div></div>` : ''}`;
  ov.className = rarityIndex >= CONFIG.divineRarity ? 'mythic divine' : rarityIndex >= CONFIG.chestAnim.mythicRarity ? 'mythic' : 'heaven';
  playSound('rune');
  if (rarityIndex >= CONFIG.chestAnim.mythicRarity) {
    setTimeout(() => {
      screenShake('heavy');
      playSound('mythic');
    }, CONFIG.chestAnim.runeMs * CONFIG.chestAnim.runeShakeAt);
  }
  setTimeout(() => {
    ov.className = 'hidden';
    ov.innerHTML = '';
  }, getRevealDelay(rarityIndex) - CONFIG.chestAnim.revealDelayMs + CONFIG.chestAnim.runeFadeMs);
}

// ---------- 成就提示 ----------

const achievePopQueue = [];
let achievePopBusy = false;

/** 顯示「成就達成」提示條（排隊一個一個顯示） */
function showAchievementPop(title, subtitle, iconName = 'trophy') {
  achievePopQueue.push({ title, subtitle, iconName });
  if (!achievePopBusy) nextAchievementPop();
}

function nextAchievementPop() {
  const item = achievePopQueue.shift();
  if (!item) {
    achievePopBusy = false;
    return;
  }
  achievePopBusy = true;
  const root = $('#achieve-pop-root');
  root.innerHTML = `<div class="achieve-pop">
    <span class="ap-icon">${icon(item.iconName)}</span>
    <div><div class="ap-title">${item.title}</div><div class="ap-sub">${item.subtitle}</div></div>
  </div>`;
  playSound('achievement');
  setTimeout(() => {
    const el = root.firstElementChild;
    if (el) el.classList.add('out');
    setTimeout(nextAchievementPop, CONFIG.fx.achievePopGapMs);
  }, CONFIG.fx.achievePopMs);
}
