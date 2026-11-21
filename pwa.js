// @ts-check
/* =========================================================
 * pwa.js — 加到主畫面、離線（路線圖 C4，PLAN.md 2.26）
 *   註冊 service worker（sw.js）、有新版本時的「更新」橫幅、Chrome 的「安裝」按鈕、設定頁的版本與安裝說明
 *   只在 https 或 localhost 註冊；單一檔案版（dist/index.html、試玩頁）與測試的手動推進模式不註冊
 * ========================================================= */

/** @type {ServiceWorkerRegistration|null} */
let swRegistration = null;
/** Chrome／Edge 的安裝提示（beforeinstallprompt），按「安裝」時才跳出 */
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (typeof renderAppSettings === 'function' && state) renderAppSettings();
});

/** 這個環境能不能用 service worker */
function canUseServiceWorker() {
  if (!('serviceWorker' in navigator)) return false;
  if (/** @type {any} */ (window).EQUIPMENT_DATA) return false; // 單一檔案版（裝備資料內嵌）：沒有 sw.js 可以註冊
  if (isManualTick() && !(/** @type {any} */ (window).__ENABLE_SW__)) return false; // 測試的手動推進模式
  const h = location.hostname;
  return location.protocol === 'https:' || h === 'localhost' || h === '127.0.0.1';
}

/** 註冊 service worker；新版下載好時顯示「更新」橫幅 */
async function registerServiceWorker() {
  if (!canUseServiceWorker()) return null;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    swRegistration = reg;
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner();
      });
    });
    return reg;
  } catch (e) {
    console.warn('service worker 註冊失敗', e);
    return null;
  }
}

/** 主畫面的「有新版本」橫幅 */
function showUpdateBanner() {
  const el = $('#update-banner');
  if (!el) return;
  el.classList.remove('hidden');
  setHTML(el, `<span>${ri('star')}有新版本了</span><button class="btn-secondary" id="btn-apply-update">更新</button>`);
  $('#btn-apply-update').addEventListener('click', applyUpdate);
}

/** 換成新版：先存檔，新的 service worker 接手後重新載入 */
function applyUpdate() {
  const waiting = swRegistration && swRegistration.waiting;
  if (!waiting) return;
  saveGame();
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

/** 設定頁：版本、是否從主畫面開啟、安裝按鈕與說明 */
function renderAppSettings() {
  const box = $('#app-settings');
  if (!box) return;
  const standalone = isStandaloneApp();
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let how;
  if (standalone) how = '已經從主畫面開啟，可以離線遊玩。';
  else if (!canUseServiceWorker()) how = '這個網址不能加到主畫面（例如試玩頁、直接開啟的檔案）。請使用正式版網址。';
  else if (ios) how = 'iPhone／iPad：在 Safari 按「分享」→「加入主畫面」。';
  else if (deferredInstallPrompt) how = '可以安裝到主畫面，之後離線也能玩。';
  else how = 'Android：在 Chrome 的選單按「安裝應用程式」或「加到主畫面」。電腦：網址列右邊的安裝圖示。';
  setHTML(
    box,
    `<div class="queue-hint">版本 ${CONFIG.app.version}${navigator.serviceWorker && navigator.serviceWorker.controller ? '・可離線' : ''}</div>
    <div class="app-how">${how}</div>
    ${deferredInstallPrompt && !standalone ? '<button class="btn-secondary" id="btn-install-app">安裝到主畫面</button>' : ''}`
  );
  const btn = $('#btn-install-app');
  if (btn)
    btn.addEventListener('click', async () => {
      const p = deferredInstallPrompt;
      deferredInstallPrompt = null;
      if (!p) return;
      p.prompt();
      await p.userChoice.catch(() => null);
      renderAppSettings();
    });
}
