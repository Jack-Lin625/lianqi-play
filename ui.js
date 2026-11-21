// @ts-check
/* =========================================================
 * ui.js — 畫面更新、彈窗、提示訊息
 * ========================================================= */

/**
 * 取得頁面元素（找不到時為 null）
 * @param {string} sel
 * @returns {HTMLElement}
 */
const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));
/** @param {string} sel @returns {HTMLInputElement} 輸入框、勾選框、滑桿 */
const $input = (sel) => /** @type {HTMLInputElement} */ (document.querySelector(sel));
/** @param {string} sel @returns {HTMLSelectElement} 下拉選單 */
const $select = (sel) => /** @type {HTMLSelectElement} */ (document.querySelector(sel));
/** @param {string} sel @returns {HTMLTextAreaElement} */
const $textarea = (sel) => /** @type {HTMLTextAreaElement} */ (document.querySelector(sel));
/** @param {string} sel @returns {HTMLButtonElement} */
const $button = (sel) => /** @type {HTMLButtonElement} */ (document.querySelector(sel));
/**
 * 取得符合條件的所有元素（陣列）
 * @param {string} sel
 * @param {ParentNode} [root]
 * @returns {HTMLElement[]}
 */
const $$ = (sel, root = document) => /** @type {HTMLElement[]} */ (Array.from(root.querySelectorAll(sel)));

/** 行內小圖示（文字中的靈石、爐火符、仙玉等） */
const ri = (name) => icon(name, 'ico-inline');

/** 只在內容改變時才更新 innerHTML（每一幀都會呼叫的地方用，避免重建 SVG） */
/** 每個元素上次寫入的 HTML（setHTML 用來避免重建 DOM） */
const lastHTML = new WeakMap();

/**
 * 內容有變才重寫 innerHTML（避免頻繁重繪吃掉點擊）
 * @param {HTMLElement} el
 * @param {string} html
 */
function setHTML(el, html) {
  if (lastHTML.get(el) !== html) {
    el.innerHTML = html;
    lastHTML.set(el, html);
  }
}

/** 已綁定過點擊事件的元素（避免重繪時重複綁定） */
const boundElements = new WeakSet();

/** 舊版存檔裡的法寶名稱（例如「史詩・烈焰之劍」），顯示時依 id 換成仙俠風格的名字；不改存檔 */
const LEGACY_RARITY_NAMES = ['普通', '優良', '稀有', '史詩', '傳說', '神話'];
function itemDisplayName(item) {
  if (!LEGACY_RARITY_NAMES.some((n) => item.name.startsWith(n + '・'))) return item.name;
  let h = 0;
  for (const ch of String(item.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const prefixes = CONFIG.names.prefixes;
  const nouns = CONFIG.names.nouns[item.slot];
  return `${getRarity(item).name}・${prefixes[h % prefixes.length]}之${nouns[(h >>> 8) % nouns.length]}`;
}

/** 解鎖條件用的短境界名：第 1 層只寫境界名（例如「築基期」） */
function shortStage(total) {
  const { chapter, level } = splitTotalStage(total);
  return level === 1 ? getRealmName(chapter) : formatStage(total);
}

// ---------- 數字格式 ----------

/** 大數字縮寫：1.2K、3.4M、5.6B、7.8T、9.1Qa（千兆）、Qi（百京）… */
function fmtNum(n) {
  const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];
  const sign = n < 0 ? '-' : '';
  let v = Math.abs(n);
  if (v < 1000) return sign + Math.floor(v);
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  const text = v >= 100 ? Math.floor(v).toString() : (Math.floor(v * 10) / 10).toString();
  return sign + text + units[i];
}

/** 依屬性種類格式化數值 */
function fmtStat(key, value) {
  const def = CONFIG.statDefs[key];
  if (!def) return String(value);
  if (def.pct) return (value * 100).toFixed(def.decimals) + '%';
  if (def.decimals > 0) return value.toFixed(def.decimals);
  return fmtNum(Math.round(value));
}

function statName(key) {
  return CONFIG.statDefs[key] ? CONFIG.statDefs[key].name : key;
}

/** 屬性顯示排序（依 statDefs 的順序） */
function sortStatKeys(keys) {
  const order = Object.keys(CONFIG.statDefs);
  return keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

// ---------- 整體更新 ----------

function renderAll() {
  renderResources();
  renderBattleHeader();
  renderEquipment();
  renderStats();
  renderChest();
  renderRateTable();
  renderPity();
  renderDungeons();
  renderDao();
  renderDaoNotice();
  renderBeasts();
  renderDaily();
  renderPets();
  renderCosmetic();
  renderAscendBadge();
  renderActivePage();
  renderTabNotices();
}

function renderResources() {
  animateNumber($('#res-gold'), state.gold);
  animateNumber($('#res-keys'), state.keys);
  animateNumber($('#res-stones'), state.upgradeStones);
  renderUpgradeCost();
  checkTutorialConditions();
}

// ---------- 戰鬥區 ----------

/** 背景補算戰鬥時設為 true，不播放飄字等特效 */
let battleSilent = false;

/** 關卡標題、戰力、挑戰按鈕、刷關標記 */
function renderBattleHeader() {
  const inDungeon = dungeonRun.active;
  $('#battle-area').classList.toggle('in-dungeon', inDungeon);
  // 秘境使用各自的水墨場景
  const scene = inDungeon ? CONFIG.dungeons.scenes[dungeonRun.type] : '';
  if ($('#battle-area').dataset.scene !== scene) $('#battle-area').dataset.scene = scene;
  $('#btn-quit-dungeon').classList.toggle('hidden', !inDungeon);
  $button('#btn-stage-select').disabled = inDungeon;
  $('#power-value').textContent = fmtNum(getCurrentPower());
  if (inDungeon) {
    const cfg = CONFIG.dungeons[dungeonRun.type];
    setHTML($('#stage-label'), `${ri(cfg.icon)}${cfg.name}`);
    $('#farm-badge').classList.add('hidden');
    $('#btn-challenge').classList.add('hidden');
    setHTML($('#monster-progress'), getDungeonProgressText());
    return;
  }

  const total = getCurrentTotal();
  const frontier = getFrontierStage();
  setHTML($('#stage-label'), `${formatStage(total)}${tribulationTag()} ▾`);
  $('#power-value').textContent = fmtNum(getCurrentPower());

  const farming = !state.stage.autoAdvance;
  $('#farm-badge').classList.toggle('hidden', !farming);

  // 不在最前線（或已關閉自動推進）時顯示「挑戰」按鈕
  const showChallenge = farming || total < frontier;
  const btn = $('#btn-challenge');
  btn.classList.toggle('hidden', !showChallenge);
  const frontierFury = getBossFury(frontier);
  setHTML(btn, `${ri('sword')}衝擊 ${formatStage(frontier)}${frontierFury ? `<small class="fury-tag">戰意 ${frontierFury}</small>` : ''}`);

  setHTML(
    $('#monster-progress'),
    isBossStage(total)
      ? `${ri('lightning')}瓶頸・妖王鎮守${furyText(total)}`
      : `妖獸 ${Math.min(stageRun.monsterIndex + 1, stageRun.monsterCount)}/${stageRun.monsterCount}`
  );
}

/** 戰意顯示文字（沒有戰意時為空字串） */
function furyText(total) {
  const n = getBossFury(total);
  return n ? `<span class="fury-tag">戰意 ${n} 層・攻擊與氣血 +${Math.round(n * CONFIG.boss.fury.perStack * 100)}%</span>` : '';
}

/** 每一幀更新：血條、Boss 倒數 */
function renderBattleFrame() {
  const { hero, battle } = getBattleView();
  if (!hero || !battle) return;
  const enemy = battle.enemy;

  $('#hero-hp-fill').style.width = (hero.hp / hero.maxHp) * 100 + '%';
  $('#hero-hp-text').textContent = `${fmtNum(hero.hp)} / ${fmtNum(hero.maxHp)}`;
  if (enemy.immortal) {
    $('#enemy-hp-fill').style.width = '100%';
    $('#enemy-hp-text').textContent = '∞';
  } else {
    $('#enemy-hp-fill').style.width = (enemy.hp / enemy.maxHp) * 100 + '%';
    $('#enemy-hp-text').textContent = `${fmtNum(enemy.hp)} / ${fmtNum(enemy.maxHp)}`;
  }
  if (dungeonRun.active) setHTML($('#monster-progress'), getDungeonProgressText());

  renderSkillRing(hero);
  renderBossStatus(battle); // Boss 機制狀態圖示（ui-boss.js）

  const timer = $('#boss-timer');
  if (battle.timeLimit > 0) {
    const left = getBattleTimeLeft(battle);
    timer.classList.remove('hidden');
    timer.classList.toggle('urgent', left <= 10);
    setHTML(timer, `${ri('incense')}${Math.ceil(left)}`);
  } else {
    timer.classList.add('hidden');
  }
}

/** 目前畫面要顯示的戰鬥（副本中顯示副本，否則顯示主線） */
function getBattleView() {
  if (dungeonRun.active && dungeonRun.battle) return { hero: dungeonRun.hero, battle: dungeonRun.battle };
  return { hero: stageRun.hero, battle: stageRun.battle };
}

/** 副本進行中的進度文字 */
function getDungeonProgressText() {
  const run = dungeonRun;
  const cfg = CONFIG.dungeons[run.type];
  const damage = run.battle ? run.battle.totalDamage : 0;
  switch (run.type) {
    case 'gold': {
      const gold = Math.round(damage * cfg.goldPerDamage * getDifficultyConfig('gold', run.difficulty).mult);
      return `難度 ${run.difficulty}・傷害 ${fmtNum(damage)} → ${ri('gold')}${fmtNum(gold)}`;
    }
    case 'key':
      return `難度 ${run.difficulty}・第 ${run.wave}/${cfg.maxWaves} 波（${Math.min(run.monsterIndex + 1, cfg.monstersPerWave)}/${cfg.monstersPerWave}）・${ri('keys')}+${run.earned.keys}`;
    case 'tower':
      return `第 ${run.floor} 層・本次 ${ri('stones')}+${run.earned.stones}`;
    case 'worldBoss': {
      const next = getNextWorldBossTier(damage);
      return `傷害 ${fmtNum(damage)}・最高 ${fmtNum(Math.max(state.dungeons.worldBoss.bestDamage, damage))}` + (next ? `・下一區間 ${fmtNum(next)}` : '');
    }
  }
  return '';
}

function setBattleHint(msg) {
  const el = $('#battle-hint');
  el.textContent = msg || '';
  el.classList.toggle('hidden', !msg);
}

/** 重新播放 CSS 動畫 */
function replayAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** 在某一方頭上飄出文字 */
function spawnFloat(side, html, cls) {
  const layer = document.querySelector(`#${side}-box .float-layer`);
  if (!layer) return;
  // 同時最多 8 個飄字，避免攻速很高時塞爆畫面
  while (layer.children.length >= 8) layer.removeChild(layer.firstChild);
  const el = document.createElement('div');
  el.className = 'float-num ' + (cls || '');
  el.innerHTML = html;
  el.style.left = 35 + Math.random() * 30 + '%';
  el.addEventListener('animationend', () => el.remove());
  layer.appendChild(el);
}

function setEnemyAppearance(enemy) {
  const sprite = $('#enemy-sprite');
  sprite.innerHTML = icon(enemy.emoji);
  sprite.classList.toggle('boss', !!enemy.isBoss);
  sprite.classList.remove('dead');
  sprite.style.color = enemy.color;
  const name = $('#enemy-name');
  name.textContent = enemy.name;
  name.style.color = enemy.color;
  renderBossMechTag(enemy); // 主線 Boss 機制標籤（ui-boss.js）
}

/** 戰鬥單次攻擊的表現 */
function playAttackEvent(ev) {
  const attacker = ev.side;
  const target = ev.side === 'hero' ? 'enemy' : 'hero';
  replayAnim($(`#${attacker}-sprite`), 'lunge');

  if (ev.dodged) {
    spawnFloat(target, '閃避', 'dodge');
    playSound('dodge');
    return;
  }
  replayAnim($(`#${target}-sprite`), 'hit');
  playSound(ev.crit ? 'crit' : attacker === 'hero' ? 'hit' : 'hurt');
  if (ev.proc) spawnFloat(target, `<small>${ev.proc}</small>${fmtNum(ev.damage)}`, 'proc');
  else if (ev.crit) spawnFloat(target, `<small>會心！</small>${fmtNum(ev.damage)}`, 'crit');
  else spawnFloat(target, fmtNum(ev.damage), target === 'hero' ? 'down' : '');
  if (ev.heal > 0) spawnFloat(attacker, '+' + fmtNum(ev.heal), 'heal');
}

/**
 * 遊戲事件入口（stage.js / battle.js 透過這裡通知畫面）
 */
function onGameEvent(name, data) {
  // 副本結算一定要讓玩家看到：先排進佇列，補算中也不會遺失
  if (name === 'dungeonEnd') {
    pendingDungeonResults.push(data);
    if (!battleSilent) afterDungeonEnd();
    return;
  }
  // 補算中：只更新資料，不播放特效（補算結束後會整體 renderAll）
  if (battleSilent) return;

  switch (name) {
    case 'battle':
      if (data.type === 'skill') playSkillEvent(data);
      else if (data.type === 'pet') playPetEvent(data);
      else if (data.type === 'proc') playProcEvent(data);
      else if (data.type === 'mech') playMechEvent(data); // Boss 機制（ui-boss.js）
      else if (data.type === 'talent') playTalentEvent(data); // 道途天賦（ui-dao.js）
      else playAttackEvent(data);
      break;

    case 'stageStart':
      renderPets();
      $('#hero-sprite').classList.remove('dead');
      renderBattleHeader();
      showBossMechHint(data.total); // 第一次挑戰有機制的 Boss：先顯示說明（ui-boss.js）
      break;

    case 'monsterSpawn':
      setEnemyAppearance(data.enemy);
      renderBattleHeader();
      break;

    case 'dungeonStart':
      renderPets();
      switchTab('main');
      setBattleHint('');
      $('#hero-sprite').classList.remove('dead');
      renderBattleHeader();
      renderDungeons();
      break;

    case 'waveCleared':
      toast(`擊退第 ${data.wave} 波妖潮 ${ri('keys')}+${data.keys}` + (data.eggs ? ` ${ri('egg')}靈獸蛋+${data.eggs}` : ''), data.eggs ? CONFIG.fx.toast.long : CONFIG.fx.toast.short);
      renderResources();
      break;

    case 'floorCleared':
      toast(`鎮妖塔第 ${data.floor} 層已破` + (data.stones ? ` ${ri('stones')}+${data.stones}` : ''), CONFIG.fx.toast.short);
      if (data.big) {
        const b = data.big;
        const extra = b.item ? `${ri(CONFIG.slots[b.item.slot].icon)}${b.item.name}` : `${ri('stones')}+${b.stones}`;
        toast(`${ri('seal')} 第 ${data.floor} 層大獎：${ri('egg')}靈獸蛋+${b.eggs}、${extra}`, CONFIG.fx.toast.extra);
        playSound('reward');
      }
      renderResources();
      break;

    case 'dailyReset':
      toast(`${ri('scroll')} 新的一天，秘境次數已重置`);
      renderDungeons();
      break;

    case 'monsterKilled': {
      $('#enemy-sprite').classList.add('dead');
      playSound('kill');
      // 擊殺妖王：畫面震動 + 短暫慢動作
      const view = getBattleView();
      if (view.battle && view.battle.enemy.isBoss && !view.battle.enemy.immortal) {
        screenShake('heavy');
        slowMotion(CONFIG.fx.bossSlowMs, CONFIG.fx.bossSlowScale);
      }
      if (data.gold > 0) spawnFloat('enemy', `+${ri('gold')}${fmtNum(data.gold)}`, 'gold');
      renderResources();
      break;
    }

    case 'dailyDone':
      // 每日任務鎖住期間照常累積進度，只是不跳提示（開放時一次領取）
      if (isFeatureOpen('daily')) showAchievementPop('每日任務完成', `${data.task.name}：到「歷練」領取獎勵`, 'scroll');
      renderTabNotices();
      break;

    case 'stageCleared': {
      const r = data.reward;
      const parts = [];
      if (r.keys) parts.push(`${ri('keys')}+${r.keys}`);
      if (r.gold) parts.push(`${ri('gold')}+${fmtNum(r.gold)}`);
      if (r.stones) parts.push(`${ri('stones')}+${r.stones}`);
      const title = data.firstBoss
        ? `${ri('seal')} 斬殺妖王，${getRealmName(splitTotalStage(data.total).chapter)}圓滿！`
        : `突破 ${formatStage(data.total)}`;
      toast(`${title} ${parts.join(' ')}`, data.firstBoss ? CONFIG.fx.toast.boss : CONFIG.fx.toast.medium);
      // 斬殺境界最後一層的妖王：天劫雷光，突破到下一個境界
      if (data.firstBoss) {
        const ch = splitTotalStage(data.total).chapter;
        const next = ch < CONFIG.realms.length ? `突破・${getRealmName(ch + 1)}` : '羽化登仙';
        setTimeout(() => playCeremony({ kind: 'tribulation', title: next, subtitle: `渡過${getRealmName(ch)}天劫` }), CONFIG.fx.tribulationDelayMs);
      }
      if (data.chapterReward) queueChapterClear(data.chapterReward); // 章節首殺獎勵（ui-boss.js）
      for (const m of data.tierRewards || []) {
        // 天劫里程碑（B2）：和章節通關用同一個視窗
        queueChapterClear({ chapter: 0, got: m.got, title: `天劫里程碑・${m.tier} 重`, hint: `第一次在天劫 ${m.tier} 重以上打倒最終 Boss，獲得里程碑獎勵：` });
      }
      // 道途、二轉等的開放提示改由功能開放表處理（features.js、ui-unlock.js）
      if (data.firstClear) checkUnlocks();
      renderDaoNotice();
      playSound(data.firstBoss ? 'bossClear' : 'stageClear');
      setBattleHint('');
      renderResources();
      renderChest();
      break;
    }

    case 'chestOpened':
      handleChestOpened(data);
      break;

    case 'autoChanged':
      if (!data.active && data.reason === 'noKeys') toast('爐火符用完，自動開爐已停止');
      if (!data.active && data.reason === 'rarity') toast(`${ri('star')} 煉出符合目標的法寶，自動開爐已停止`, CONFIG.fx.toast.long);
      renderChest();
      break;

    case 'stageFailed': {
      $('#hero-sprite').classList.add('dead');
      playSound('defeat');
      if (data.retreated) showTutorial('retreat');
      else showTutorial('firstDefeat');
      const why = data.reason === 'timeout' ? '一炷香已盡！' : '敗退！';
      if (data.death) {
        // 輸給主線 Boss：死因與建議（ui-boss.js）
        setBattleHint(getBossFailHint(data) + (data.retreated ? `。已退回 ${formatStage(getCurrentTotal())}，變強後按「衝擊」再試` : ''));
      } else if (data.retreated) {
        setBattleHint(`連續失敗 ${CONFIG.stage.retreatAfterFails} 次，已退回 ${formatStage(getCurrentTotal())} 穩固修為。變強後按「衝擊」再試${data.fury ? `（戰意 ${data.fury} 層會保留）` : ''}`);
      } else {
        setBattleHint(
          data.fury
            ? `${why}戰意 +1（${data.fury} 層，攻擊與氣血 +${Math.round(data.fury * CONFIG.boss.fury.perStack * 100)}%），再戰必有進境`
            : `${why}戰力不足，試試開爐煉器或提升煉器爐`
        );
      }
      renderBattleHeader();
      break;
    }
  }
}

/** 選擇關卡視窗 */
function showStageSelect() {
  const frontier = getFrontierStage();
  const current = getCurrentTotal();
  const maxChapter = splitTotalStage(frontier).chapter;
  const per = CONFIG.stage.levelsPerChapter;

  let html = '<div class="modal-title">選擇境界</div>';
  for (let ch = maxChapter; ch >= 1; ch--) {
    const info = getChapterMonsterInfo(ch);
    html += `<div class="chapter-block"><div class="chapter-title"><span>${getRealmName(ch)}</span><small style="color:${info.color}">${info.name}出沒</small></div><div class="stage-grid">`;
    for (let lv = 1; lv <= per; lv++) {
      const t = getTotalStage(ch, lv);
      const cls = ['stage-cell'];
      if (t <= state.stage.highest) cls.push('cleared');
      if (t === frontier) cls.push('frontier');
      if (t === current) cls.push('current');
      if (isBossStage(t)) cls.push('boss');
      const mech = isBossStage(t) ? getBossMechanic(ch) : null; // Boss 機制圖示
      const label = isBossStage(t) ? `${ri(mech ? mech.icon : 'lightning')}${toCN(lv)}層${mech ? `<small class="cell-mech">${mech.name}</small>` : ''}` : `${toCN(lv)}層`;
      html += `<button class="${cls.join(' ')}" data-stage="${t}" ${t > frontier ? 'disabled' : ''}>${label}</button>`;
    }
    html += '</div></div>';
  }
  html += `<div class="queue-hint">選已突破的層數可重複修煉；選最前線會自動精進</div>
    <div class="modal-buttons"><button class="btn-close">關閉</button></div>`;

  const modal = openModal(html, { closeOnOverlay: true });
  modal.querySelector('.btn-close').addEventListener('click', closeModal);
  $$('[data-stage]', modal).forEach((b) =>
    b.addEventListener('click', () => {
      selectStage(Number(b.dataset.stage));
      setBattleHint('');
      closeModal();
      saveGame();
      renderAll();
    })
  );
}

function renderEquipment() {
  const grid = $('#equip-grid');
  grid.innerHTML = '';
  for (const slot of CONFIG.slotOrder) {
    const info = CONFIG.slots[slot];
    const item = state.equipped[slot];
    const btn = document.createElement('button');
    btn.className = 'equip-slot' + (item ? '' : ' empty');
    if (item) {
      const rarity = getRarity(item);
      btn.style.borderColor = rarity.color;
      btn.style.color = rarity.color;
      btn.innerHTML = `
        <div class="slot-icon">${icon(info.icon)}</div>
        <div class="slot-name">${item.tpl && GEAR_INDEX[item.tpl] ? GEAR_INDEX[item.tpl].name : rarity.name + info.name}</div>
        <div class="slot-level">${item.level} 級${getEnhanceLevel(slot) ? `<b class="enh">+${getEnhanceLevel(slot)}</b>` : ''}</div>`;
    } else {
      btn.style.color = '';
      btn.innerHTML = `
        <div class="slot-icon">${icon(info.icon)}</div>
        <div class="slot-name">${info.name}</div>
        <div class="slot-level">未佩戴</div>`;
    }
    btn.addEventListener('click', () => showItemDetail(slot));
    grid.appendChild(btn);
  }
}

function renderStats() {
  const s = getCurrentStats();
  const keys = ['atk', 'hp', 'def', 'spd', 'critRate', 'critDmg', 'lifesteal', 'dodge'];
  const dao = state.dao.path ? getDaoName() : isDaoUnlocked() ? '尚未選擇' : '未開啟';
  $('#stats-list').innerHTML =
    `<div class="stat-row stat-dao"><span class="stat-name">道途</span><span>${dao}</span></div>` +
    keys.map((k) => `<div class="stat-row"><span class="stat-name">${statName(k)}</span><span>${fmtStat(k, s[k])}</span></div>`).join('') +
    (s.goldPct > 0 ? `<div class="stat-row"><span class="stat-name">${statName('goldPct')}</span><span>+${fmtStat('goldPct', s.goldPct)}</span></div>` : '') +
    (s.cdr > 0 ? `<div class="stat-row"><span class="stat-name">${statName('cdr')}</span><span>-${fmtStat('cdr', s.cdr)}</span></div>` : '') +
    Object.entries(getEquippedSetCounts())
      .filter(([, n]) => n >= 2)
      .map(([id, n]) => `<div class="stat-row stat-dao"><span class="stat-name">${GEAR_DATA.sets[id].name}</span><span>${n} 件生效</span></div>`)
      .join('');
}

// ---------- 煉器爐（開爐、件數、升爐、自動開爐、開爐結果）：在 ui-chest.js ----------

// ---------- 彈窗 ----------

function openModal(html, { closeOnOverlay = false } = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-overlay"><div class="modal">${html}</div></div>`;
  const overlay = root.querySelector('.modal-overlay');
  if (closeOnOverlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }
  return overlay.querySelector('.modal');
}

function closeModal() {
  $('#modal-root').innerHTML = '';
  if (coachActive && TUTORIALS[coachActive].inModal) dismissCoach();
  // 其他視窗開著時可能有新的結算 / 新裝備在排隊，關閉後接著顯示
  showNextQueuedModal();
}

/** 依序顯示排隊中的視窗：離線收益 → 副本結算 → 新裝備比較 */
function showNextQueuedModal() {
  if (isModalOpen() || chestRevealing) return;
  if (showNextFeatureUnlock()) return; // 功能開放演出優先（演出中不跳其他視窗）
  if (showNextChapterClear()) return; // 章節通關獎勵（ui-boss.js），之後才比較獎勵的法寶
  if (state.offlineReward) showOfflineReward();
  else if (welfareQueue.length > 0) showWelfareSummary(welfareQueue.shift());
  else if (showAutoClaimNotice()) return; // 重置時自動發放的每日／每週獎勵（ui-daily.js）
  else if (pendingDungeonResults.length > 0) showDungeonResult(pendingDungeonResults.shift());
  else if (!showDaoTalentPrompt()) showNextPending(); // 道途分頁上有還沒選的天賦（ui-dao.js）
}

function isModalOpen() {
  return $('#modal-root').children.length > 0;
}

/** 裝備卡片 HTML（比較視窗與詳細視窗共用） */
function itemCardHTML(item, tag) {
  const slotInfo = item ? CONFIG.slots[item.slot] : null;
  if (!item) {
    return `<div class="item-card">
      <div class="item-tag">${tag}</div>
      <div class="item-empty">尚未佩戴</div>
    </div>`;
  }
  const rarity = getRarity(item);
  const mains = sortStatKeys(Object.keys(item.mainStats))
    .map((k) => `<div class="item-stat"><span class="stat-name">${statName(k)}</span><span>${fmtStat(k, item.mainStats[k])}</span></div>`)
    .join('');
  const subs = item.subStats
    .map((s) => `<div class="item-stat sub"><span class="stat-name">${statName(s.type)}</span><span>+${fmtStat(s.type, s.value)}</span></div>`)
    .join('');
  return `<div class="item-card" style="border-color:${rarity.color}">
    <div class="item-tag">${tag}</div>
    <div class="item-name" style="color:${rarity.color}">${ri(slotInfo.icon)}${itemDisplayName(item)}</div>
    <div class="item-meta">${item.level} 級・${slotInfo.name}・戰力 ${fmtNum(item.power)}</div>
    ${mains}${subs}
    ${itemExtraHTML(item)}
  </div>`;
}

/** 法寶卡片下方：套裝、仙品特效與介紹 */
function itemExtraHTML(item) {
  let html = '';
  if (item.set && GEAR_DATA && GEAR_DATA.sets[item.set]) {
    const set = GEAR_DATA.sets[item.set];
    const have = getEquippedSetCounts()[item.set] || 0;
    const lines = Object.entries(set.bonus)
      .map(([n, b]) => `<div class="set-line ${have >= Number(n) ? 'on' : ''}">${n} 件：${bonusText(b)}</div>`)
      .join('');
    html += `<div class="item-set"><div class="set-name">${set.name}<small>身上 ${have}/6</small></div>${lines}</div>`;
  }
  if (item.mythic && GEAR_INDEX[item.mythic]) {
    const m = GEAR_INDEX[item.mythic];
    html += `<div class="item-mythic"><div class="mythic-effect">${m.effect.name}：${effectText(m.effect)}</div><div class="mythic-desc">${m.desc}</div></div>`;
  }
  return html;
}

/** 加成物件 → 文字（攻擊 +5%、會心率 +4% …） */
function bonusText(b) {
  const label = { atkPct: '攻擊', hpPct: '氣血', defPct: '護體', critRate: '會心率', critDmg: '會心傷害', lifesteal: '吸血', goldPct: '靈石加成', cdr: '技能冷卻 -', spd: '身法' };
  return Object.entries(b)
    .map(([k, v]) => (k === 'cdr' ? `技能冷卻 -${Math.round(v * 100)}%` : k === 'spd' ? `身法 +${v.toFixed(2)}` : `${label[k] || statName(k)} +${Math.round(v * 1000) / 10}%`))
    .join('、');
}

/** 仙品特效說明 */
function effectText(e) {
  const pct = (v) => `${Math.round(v * 100)}%`;
  switch (e.type) {
    case 'thunder':
      return `攻擊時 ${pct(e.chance)} 機率額外造成 ${e.mult} 倍攻擊傷害`;
    case 'execute':
      return `敵人氣血低於 ${pct(e.threshold)} 時，傷害 +${pct(e.bonus)}`;
    case 'echo':
      return `攻擊時 ${pct(e.chance)} 機率再攻擊一次`;
    case 'heal':
      return `攻擊時 ${pct(e.chance)} 機率回復 ${pct(e.pct)} 氣血`;
    case 'guard':
      return `受擊時 ${pct(e.chance)} 機率減傷 ${pct(e.reduction)}`;
  }
  return '';
}

/** 數值差異 HTML：上升綠色 ▲、下降紅色 ▼ */
function diffHTML(key, diff) {
  if (Math.abs(diff) < 1e-9) return `<span>-</span>`;
  const cls = diff > 0 ? 'up' : 'down';
  const arrow = diff > 0 ? '▲' : '▼';
  return `<span class="${cls}">${arrow}${fmtStat(key, Math.abs(diff))}</span>`;
}

/** 比較視窗 */
function showCompare(item) {
  const old = state.equipped[item.slot];
  const delta = calcPowerDelta(item);
  const oldTotals = getItemStatTotals(old);
  const newTotals = getItemStatTotals(item);
  const keys = sortStatKeys([...new Set([...Object.keys(oldTotals), ...Object.keys(newTotals)])]);

  const diffRows = keys
    .map((k) => {
      const a = oldTotals[k] || 0;
      const b = newTotals[k] || 0;
      return `<div class="diff-row"><span>${statName(k)}</span><span>${fmtStat(k, a)}</span><span>${fmtStat(k, b)}</span>${diffHTML(k, b - a)}</div>`;
    })
    .join('');

  const deltaCls = delta >= 0 ? 'up' : 'down';
  const deltaText = (delta >= 0 ? '+' : '') + fmtNum(delta);
  const remaining = state.pendingItems.length - 1;
  const setNote = setChangeHTML(item, delta);

  const modal = openModal(`
    <div class="modal-title">煉成新法寶！</div>
    <div class="power-delta ${deltaCls}">戰力 ${deltaText}</div>
    ${setNote}
    <div class="compare-cols">
      ${itemCardHTML(old, '目前佩戴')}
      ${itemCardHTML(item, '新法寶')}
    </div>
    <div class="diff-table">
      <div class="diff-row head"><span>屬性</span><span>目前</span><span>新</span><span>變化</span></div>
      ${diffRows}
    </div>
    <div class="modal-buttons">
      <button class="btn-salvage">熔煉 ${ri('gold')}${fmtNum(getSalvageGold(item))}</button>
      <button class="btn-equip">佩戴</button>
    </div>
    ${remaining > 0 ? `<div class="queue-hint">還有 ${remaining} 件待決定</div>` : ''}
  `);
  showTutorial('compare');

  modal.querySelector('.btn-equip').addEventListener('click', () => {
    const gold = equipItem(item);
    playSound('equip');
    toast(gold > 0 ? `已佩戴 ${itemDisplayName(item)}，舊法寶熔煉 ${ri('gold')}+${fmtNum(gold)}` : `已佩戴 ${itemDisplayName(item)}`);
    afterPendingDecision();
  });
  modal.querySelector('.btn-salvage').addEventListener('click', () => {
    const gold = salvageItem(item);
    playSound('salvage');
    toast(`熔煉 ${itemDisplayName(item)}，${ri('gold')}+${fmtNum(gold)}`);
    afterPendingDecision();
  });
}

/**
 * 比較視窗的套裝提示：會拆散哪一套、會加入哪一套
 * 實際戰力下降但仍值得換（舊境界套裝）時，說明原因
 */
function setChangeHTML(item, delta) {
  const c = getSetChange(item);
  const lines = [];
  for (const s of c.lost) {
    lines.push(`<div class="set-change lost">拆散「${s.name}」${s.from}→${s.to} 件${s.tiers.length ? `，失去 ${s.tiers.join('、')} 件效果` : ''}</div>`);
  }
  for (const s of c.gained) {
    lines.push(`<div class="set-change gained">加入「${s.name}」${s.from}→${s.to} 件${s.tiers.length ? `，觸發 ${s.tiers.join('、')} 件效果` : ''}</div>`);
  }
  if (delta < 0 && isBetterItem(item)) {
    lines.push('<div class="set-change note">舊境界套裝的效果不列入比較：換上同境界的新法寶、湊齊新套裝後會更強</div>');
  }
  return lines.length ? `<div class="set-changes">${lines.join('')}</div>` : '';
}

/** 處理完一件待決定裝備後：存檔、更新畫面、顯示下一件 */
function afterPendingDecision() {
  closeModal();
  saveGame();
  renderAll();
  showNextPending();
}

/** 若有待決定裝備，跳出下一個比較視窗 */
function showNextPending() {
  if (hasPendingItems() && !isModalOpen()) showCompare(state.pendingItems[0]);
}

/** 裝備欄點擊：查看詳細 */
function showItemDetail(slot) {
  const item = state.equipped[slot];
  const title = `${ri(CONFIG.slots[slot].icon)}${CONFIG.slots[slot].name}`;
  const extra = item ? `<div class="queue-hint">熔煉可得 ${ri('gold')}${fmtNum(getSalvageGold(item))}</div>` : '';
  const modal = openModal(
    `<div class="modal-title">${title}</div>
     ${itemCardHTML(item, '目前佩戴')}
     ${extra}
     <div class="modal-buttons"><button class="btn-close">關閉</button></div>`,
    { closeOnOverlay: true }
  );
  modal.querySelector('.btn-close').addEventListener('click', closeModal);
}

// ---------- 確認視窗 ----------

/**
 * 遊戲內的確認視窗（取代瀏覽器的 confirm()，部分環境會封鎖原生對話框）
 * @returns {Promise<boolean>}
 */
function askConfirm(message, { okText = '確定', danger = false } = {}) {
  return new Promise((resolve) => {
    const root = $('#confirm-root');
    root.innerHTML = `<div class="modal-overlay confirm-overlay"><div class="modal">
      <div class="confirm-text">${message}</div>
      <div class="modal-buttons">
        <button class="btn-close" id="confirm-cancel">取消</button>
        <button class="${danger ? 'btn-danger-solid' : 'btn-equip'}" id="confirm-ok">${okText}</button>
      </div>
    </div></div>`;
    const done = (v) => {
      root.innerHTML = '';
      resolve(v);
    };
    $('#confirm-cancel').addEventListener('click', () => done(false));
    $('#confirm-ok').addEventListener('click', () => done(true));
  });
}

// ---------- 提示訊息 ----------

function toast(msg, ms = CONFIG.fx.toast.normal) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = msg; // 訊息都是遊戲內部產生的文字與圖示
  const root = $('#toast-root');
  root.appendChild(el);
  // 最多同時顯示 3 則
  while (root.children.length > 3) root.removeChild(root.firstChild);
  setTimeout(() => el.classList.add('fade'), ms);
  setTimeout(() => el.remove(), ms + CONFIG.fx.toastFadeMs);
}

// ---------- 分頁切換、鎖住的分頁、分頁提示點：在 ui-nav.js ----------

// ---------- 副本：分頁與結算視窗在 ui-dungeon.js ----------

// ---------- 離線收益：「閉關歸來」視窗在 ui-offline.js ----------

// ---------- 設定頁 ----------

// 設定頁（聲音、存檔、存檔保護）在 ui-settings.js

// ---------- 新手引導：在 ui-tutorial.js ----------

// ---------- 道途 ----------

/** 技能冷卻圈（每一幀更新）＋護體光暈 */
const RING_LEN = 2 * Math.PI * 17;
function renderSkillRing(hero) {
  const ring = $('#skill-ring');
  const sk = hero.skill;
  ring.classList.toggle('hidden', !sk);
  $('#hero-sprite').classList.toggle('shielded', hero.shieldLeft > 0);
  if (!sk) return;
  const frac = Math.min(1, sk.timer / sk.cooldown);
  const fg = $('#skill-ring-fg');
  fg.style.strokeDasharray = String(RING_LEN);
  fg.style.strokeDashoffset = String(RING_LEN * (1 - frac));
  ring.classList.toggle('ready', frac > 0.92);
  setHTML($('#skill-ring-icon'), icon(CONFIG.dao.paths[state.dao.path] ? CONFIG.dao.paths[state.dao.path].icon : 'taiji'));
  ring.title = `${sk.name}（冷卻 ${sk.cooldown} 秒）`;
}

/** 技能施放的表現：技能名稱橫幅 + 傷害數字 / 護體光暈 */
function playSkillEvent(ev) {
  const banner = $('#skill-banner');
  banner.textContent = `${ev.name}！`;
  banner.classList.toggle('shield', ev.kind === 'shield');
  replayAnim(banner, 'show');
  if (ev.kind === 'damage') {
    const target = ev.side === 'hero' ? 'enemy' : 'hero';
    replayAnim($(`#${ev.side}-sprite`), 'lunge');
    replayAnim($(`#${target}-sprite`), 'hit');
    const label = `${ev.recast ? '再施放・' : ''}${ev.name}${ev.crit ? '・會心' : ''}`;
    spawnFloat(target, `<small>${label}</small>${fmtNum(ev.damage)}`, ev.crit ? 'crit' : 'skill');
    playSound('skill');
  } else {
    spawnFloat(ev.side, `<small>${ev.name}</small>減傷`, 'shield');
    playSound('shield');
  }
}

// 道途分頁（屬性加成、技能、天賦、改修、突破）在 ui-dao.js

// ---------- 戰鬥中的靈獸 ----------

/** 主角旁邊顯示上陣的靈獸 */
function renderPets() {
  const box = $('#pets');
  if (!box) return;
  const html = state.beasts.deployed
    .map((key, i) => {
      const sp = CONFIG.beasts.species[key];
      const owned = state.beasts.owned[key];
      return `<span class="pet pet-${i}${owned.awakened ? ' awakened' : ''}" style="color:${CONFIG.rarities[owned.rarity].color}" title="${sp.name}${owned.awakened ? '（已覺醒）' : ''}">${icon(sp.icon)}</span>`;
    })
    .join('');
  setHTML(box, html);
}

/** 靈獸出手的表現 */
function playPetEvent(ev) {
  const pet = document.querySelector(`#pets .pet-${ev.index}`);
  if (pet) replayAnim(pet, 'pounce');
  replayAnim($('#enemy-sprite'), 'hit');
  spawnFloat('enemy', `<small>${ev.opener ? '先手・' : ''}${ev.name}</small>${fmtNum(ev.damage)}`, 'pet'); // 先手：靈獸覺醒（B3）
  playSound('hit');
}

// 每日任務、每週任務、活躍度寶箱、月曆簽到在 ui-daily.js

// 靈獸分頁（孵化、上陣、羈絆、升星技能）在 ui-beast.js

// ---------- 仙品特效、外觀 ----------

/** 仙品特效觸發：特效名稱 + 傷害／回血／減傷 */
function playProcEvent(ev) {
  const target = ev.side === 'hero' ? 'enemy' : 'hero';
  if (ev.damage) {
    replayAnim($(`#${target}-sprite`), 'hit');
    spawnFloat(target, `<small>${ev.name}</small>${fmtNum(ev.damage)}`, 'proc');
    if (ev.kind === 'thunder') replayAnim($('#battle-area'), 'thunder-flash');
  } else if (ev.heal) {
    spawnFloat(ev.side, `<small>${ev.name}</small>+${fmtNum(ev.heal)}`, 'heal');
  } else {
    spawnFloat(ev.side, `<small>${ev.name}</small>`, 'proc');
  }
  playSound('proc');
}

/** 主角外觀（顏色與光暈，只影響畫面） */
function renderCosmetic() {
  const c = CONFIG.shop.cosmetics[state.shop.cosmetics.equipped] || CONFIG.shop.cosmetics.default;
  const sprite = $('#hero-sprite');
  sprite.style.color = c.color || '';
  sprite.style.setProperty('--aura', c.aura || 'transparent');
  sprite.classList.toggle('has-aura', !!c.aura);
}

/** 重繪目前顯示中的新分頁（資源變動時，例如商店的「靈石不足」狀態） */
function renderActivePage() {
  const page = $('.tab-page.active');
  if (!page) return;
  const fn = { enhance: renderEnhance, codex: renderCodex, market: renderMarket, gemshop: renderGemshop, recharge: renderRecharge, achieve: renderAchieve, signin: renderSignin, mail: renderMail, ascend: renderAscend, settings: renderAscendBackupButton }[page.dataset.page];
  if (fn) fn(true);
}
