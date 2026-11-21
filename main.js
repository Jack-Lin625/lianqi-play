// @ts-check
/* =========================================================
 * main.js — 初始化與遊戲主迴圈
 * ========================================================= */

/** 按下開箱（自動開箱中則為「停止」） */
function onOpenChest() {
  if (autoRun.active) {
    stopAutoOpen('user');
    saveGame();
    return;
  }
  if (chestRevealing) return; // 上一次開爐動畫還在播
  const result = openChest();
  if (!result) {
    if (hasPendingItems()) showNextPending();
    else toast('爐火符不足');
    return;
  }
  handleChestOpened(result);
  saveGame();
}

/** 按下「自動」 */
function onToggleAuto() {
  if (autoRun.active) stopAutoOpen('user');
  else if (!startAutoOpen()) toast('爐火符不足');
  saveGame();
}

/** 按下「強化／升階」：強化條沒滿時強化一格，滿了就升階 */
function onUpgradeChest() {
  if (!isChestProgressFull()) {
    if (!fillChestSegment()) {
      toast('靈石不足');
      return;
    }
    playSound('upgrade');
    replayAnim($('#chest-icon-2'), 'chest-up');
    saveGame();
    renderAll();
    return;
  }
  if (!upgradeChest()) {
    toast('仙玉不足');
    return;
  }
  playChestUpgradeEffect();
  playCeremony({ kind: 'furnace', title: `煉器爐・${toCN(state.chestLevel)}階`, subtitle: '煉出高品階法寶的機率提升' });
  saveGame();
  renderAll();
}

/** 測試按鈕 */
function onDevAction(type) {
  const dev = CONFIG.dev;
  switch (type) {
    case 'keys':
      state.keys += dev.addKeys;
      break;
    case 'gold':
      state.gold += dev.addGold;
      break;
    case 'stage':
      state.stage.highest += dev.addStages;
      toast(`最高境界 ${formatStage(state.stage.highest)}，法寶等級 ${getEquipLevel()} 級`);
      break;
    case 'stones':
      state.upgradeStones += dev.addStones;
      break;
    case 'dungeonReset':
      state.dungeons.lastResetDate = '';
      checkDailyReset();
      break;
    case 'offline':
      addOfflineTime(CONFIG.dev.offlineMinutes);
      showNextQueuedModal();
      break;
    case 'chestUp':
      state.chestLevel = Math.min(getChestMaxLevel(), state.chestLevel + 1);
      state.chestProgress = 0;
      break;
    case 'chestDown':
      state.chestLevel = Math.max(CONFIG.chest.minLevel, state.chestLevel - 1);
      state.chestProgress = 0;
      break;
  }
  saveGame();
  renderAll();
}

/** 重置存檔（二次確認） */
async function onResetSave() {
  if (!(await askConfirm('確定要重置存檔嗎？所有修為都會消失。', { okText: '重置', danger: true }))) return;
  if (!(await askConfirm('再次確認：真的要散去所有修為嗎？<br>此動作無法復原。', { okText: '散功重修', danger: true }))) return;
  resetGame();
  onStateReplaced();
  toast('存檔已重置');
}

/** 存檔被整個換掉（重置 / 匯入）後，重設所有執行中的狀態與畫面 */
function onStateReplaced() {
  stopAutoOpen('user');
  dungeonRun.active = false;
  stageRun.paused = false;
  pendingDungeonResults.length = 0;
  $('#modal-root').innerHTML = '';
  $('#open-result').classList.add('hidden');
  setBattleHint('');
  initStage();
  syncAutoSettingsUI();
  syncSettingsUI();
  renderAll();
  switchTab('main');
  if (getBestStage() === 0) showTutorial('welcome');
  showNextQueuedModal();
}

function bindEvents() {
  $('#btn-open').addEventListener('click', onOpenChest);
  $('#btn-reset').addEventListener('click', onResetSave);
  $('#btn-asc-restore').addEventListener('click', onRestoreAscendBackup);
  $('#ascend-badge').addEventListener('click', () => switchTab('ascend'));
  $('#btn-stage-select').addEventListener('click', showStageSelect);
  $('#btn-auto').addEventListener('click', onToggleAuto);
  $('#btn-batch').addEventListener('click', showBatchMenu);
  $('#boss-mech').addEventListener('click', showBossMechInfo);
  $('#btn-quit-dungeon').addEventListener('click', quitDungeon);
  $('#btn-upgrade').addEventListener('click', onUpgradeChest);
  $('#btn-challenge').addEventListener('click', () => {
    challengeFrontier();
    setBattleHint('');
    saveGame();
    renderAll();
  });
  $$('.tab-btn').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $$('[data-dev]').forEach((b) => b.addEventListener('click', () => onDevAction(b.dataset.dev)));
  if (!CONFIG.dev.enabled) $('#dev-panel').classList.add('hidden');

  // 自動存檔：定時、關閉頁面、切到背景（測試的手動推進模式不啟動計時器，見 manualTick）
  if (!isManualTick()) {
    setInterval(saveGame, CONFIG.save.autoSaveIntervalMs);
    // 分頁在背景時 requestAnimationFrame 會停止，用計時器繼續推進戰鬥
    setInterval(updateLogic, CONFIG.timing.backgroundTickMs);
    // 副本每日重置（跨過午夜時）
    setInterval(dailyTick, CONFIG.timing.dailyCheckMs);
  }
  window.addEventListener('beforeunload', saveGame);
  window.addEventListener('resize', positionCoach);
  window.addEventListener('scroll', positionCoach, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveGame();
    else dailyTick();
  });
}

// ---------- 遊戲主迴圈 ----------
// 邏輯以固定步長推進：用真實經過時間換算要跑幾步，
// 所以分頁在背景被節流、或 requestAnimationFrame 暫停時，回來也能補算正確。

let lastUpdateTime = 0;
let logicAccumulator = 0;

function updateLogic() {
  const now = performance.now();
  if (!lastUpdateTime) lastUpdateTime = now;
  let elapsed = (now - lastUpdateTime) / 1000;
  lastUpdateTime = now;
  // 超過補算上限的時間改成離線收益
  if (elapsed > CONFIG.battle.maxCatchupSec) {
    if (addOfflineTime((elapsed - CONFIG.battle.maxCatchupSec) / 60)) showNextQueuedModal();
    elapsed = CONFIG.battle.maxCatchupSec;
  }

  const step = CONFIG.battle.tickSec;
  // 慢動作（擊殺妖王時）：這段時間戰鬥進行得比較慢
  updateFx(now);
  logicAccumulator += elapsed * fx.timeScale;
  const steps = Math.floor(logicAccumulator / step);
  if (steps <= 0) return;
  logicAccumulator -= steps * step;
  advanceLogic(steps);
}

/** 推進 steps 個固定步長（主迴圈與測試的 manualTick 共用） */
function advanceLogic(steps) {
  const step = CONFIG.battle.tickSec;
  // 一次要補很多步（背景回來）時，不播放特效，結束後整體重繪
  const catchingUp = steps > CONFIG.battle.maxVisualSteps;
  const highestBefore = state.stage.highest;
  if (catchingUp) battleSilent = true;
  for (let i = 0; i < steps; i++) {
    if (dungeonRun.active) updateDungeon(step);
    else updateStage(step);
    updateAutoOpen(step);
    addPlayTime(step); // 累計在線時間（功能開放條件用；閉關時間不算）
  }
  if (catchingUp) {
    battleSilent = false;
    const view = getBattleView();
    if (view.battle) setEnemyAppearance(view.battle.enemy);
    $('#hero-sprite').classList.toggle('dead', view.hero.hp <= 0);
    if (state.stage.highest > highestBefore) toast(`背景修煉期間突破至 ${formatStage(state.stage.highest)}`);
    renderAll();
    showNextQueuedModal();
  }
}

// ---------- 測試用：手動推進 ----------
// 頁面載入前設定 window.__MANUAL_TICK__ = true（tests/helpers.js 預設會設），遊戲就不啟動任何計時迴圈
// （戰鬥推進、每秒的成就／功能開放檢查、跨日檢查、自動存檔），改由測試呼叫 manualTick(秒) 以固定步長推進。
// 避免 CPU 忙的時候，計時器在測試的兩個步驟之間搶先執行（例如先把成就標成達成），讓結果不穩定。

/** 是否為手動推進模式（只有測試會開） */
function isManualTick() {
  return typeof window !== 'undefined' && !!(/** @type {any} */ (window).__MANUAL_TICK__);
}

/**
 * 手動推進 sec 秒：戰鬥與自動開爐每 tickSec 一步；每滿 1 秒執行一次每秒檢查（slowTick）
 * @param {number} [sec]
 */
function manualTick(sec = 1) {
  const perSec = Math.round(1 / CONFIG.battle.tickSec);
  for (let s = 0; s < sec; s++) {
    advanceLogic(perSec);
    slowTick();
  }
}

function gameLoop() {
  if (!isManualTick()) updateLogic();
  renderBattleFrame();
  requestAnimationFrame(gameLoop);
}

/** 定時檢查跨日（玩家整晚開著遊戲時也會重置每日內容、發放當天福利） */
function dailyTick() {
  checkDailyReset();
  renderExportReminder(); // 跨日後可能要提醒匯出
  const newSeason = ensurePassSeason();
  if (checkDailyWelfare() || newSeason) {
    saveGame();
    renderAll();
    showNextQueuedModal();
  }
}

/** 每秒一次：成就檢查、背景音樂跟著畫面切換 */
function slowTick() {
  if (battleSilent) return;
  const done = checkAchievements(); // 成就鎖住期間也照常累積，只是不跳提示（開放時一次領取）
  if (isFeatureOpen('achieve')) {
    // 一次達成很多項（例如舊存檔第一次載入）時合併成一則，避免提示排隊太久
    if (done.length > 2) showAchievementPop('成就達成', `一舉達成 ${done.length} 項成就：到「更多 → 成就」領取獎勵`);
    else for (const a of done) showAchievementPop('成就達成', `${a.name}：${getAchievementDesc(a)}`);
  }
  if (done.length) renderTabNotices();
  tickAscendCountdown(); // 飛升冷卻倒數
  if (checkAutoBackup()) saveGame(); // 自動備份：每 CONFIG.backup.intervalMinutes 分鐘在線、每天第一次上線
  renderAscendBadge();
  checkUnlocks();
  updateMusic();
}

/** 功能開放、開爐件數解鎖：有新的就播放演出／跳提示 */
function checkUnlocks() {
  const opened = checkFeatureUnlocks();
  const tiers = checkTierUnlocks();
  for (const c of tiers) showUpgradeNotice(`${ri('star')} 開爐 ×${c} 解鎖！`);
  if (opened.length || tiers.length) {
    saveGame();
    renderAll();
    showNextQueuedModal();
  }
}

/** 讀不到裝備資料（通常是直接雙擊 index.html）時的說明畫面 */
function showLoadError(err) {
  document.body.innerHTML = `<div class="load-error">
    <h1>無法讀取裝備資料</h1>
    <p>瀏覽器不允許直接開啟的網頁（file://）讀取 <code>data/equipment.json</code>。</p>
    <p>請在遊戲資料夾開一個本機伺服器，例如：</p>
    <pre>python -m http.server 8000</pre>
    <p>再用瀏覽器開啟 <code>http://localhost:8000</code>。</p>
    <p class="load-error-detail">${String(err && err.message ? err.message : err)}</p>
  </div>`;
}

async function init() {
  try {
    await loadGearData(); // 裝備外觀資料（data/equipment.json）；讀檔遷移會用到，必須最先載入
  } catch (err) {
    showLoadError(err);
    return;
  }
  installIconSprite(); // 水墨圖示（icons.js）
  fillStaticIcons();
  loadGame();
  checkOfflineOnLoad(); // 必須在第一次存檔前計算，否則最後在線時間會被覆蓋
  ensurePassSeason(); // 換季：未領的戰令獎勵寄到信箱
  checkDailyWelfare(); // 每天第一次上線：每日仙玉、新手七日禮、月卡
  if (!state.features.tiersSeen.length) checkTierUnlocks(); // 新玩家：目前可用的開爐件數不跳提示
  saveGame();
  if (loadResult.status === 'ok') checkAutoBackup(); // 每天第一次上線的自動備份（存檔保護，backup.js）
  bindEvents();
  initAutoSettingsUI();
  initSettingsUI();
  checkDailyReset();
  initStage();
  renderAll();
  showNextQueuedModal(); // 閉關收益、今日福利、上次沒處理完的法寶
  showLoadResultNotice(); // 主存檔讀不出來、從自動備份還原時的說明
  renderExportReminder(); // 太久沒匯出存檔的提醒（第一次飛升後）
  if (isStandaloneApp()) requestPersist(); // 從主畫面開啟（PWA）時請瀏覽器保留資料
  registerServiceWorker(); // 離線快取與新版本提示（pwa.js、sw.js）
  // 新玩家顯示引導（有視窗時等視窗關閉後再顯示，見 ui-welfare.js）；舊存檔直接視為看過開場引導
  if (getBestStage() === 0 && !isModalOpen()) showTutorial('welcome');
  else if (!isTutorialSeen('welcome')) state.tutorial.seen.push('welcome');
  // 瀏覽器規定要在使用者操作後才能播放聲音：第一次點擊時啟動音效與背景音樂
  document.addEventListener(
    'pointerdown',
    () => {
      if (state.settings.sound || state.settings.music) getAudioCtx();
      applyVolumes();
      if (state.settings.music) playMusic(getDesiredMusic());
    },
    { once: true }
  );
  installButtonFeedback();
  ensureMarketFresh();
  if (!isManualTick()) setInterval(slowTick, CONFIG.timing.slowTickMs);
  requestAnimationFrame(gameLoop);
}

document.addEventListener('DOMContentLoaded', init);
