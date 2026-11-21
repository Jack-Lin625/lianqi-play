// @ts-check
/* =========================================================
 * backup.js — 存檔保護（路線圖 C1，PLAN.md 2.26；存檔 v16）
 *
 * - 自動備份：localStorage 的 CONFIG.backup.autoKey 存一個陣列（新的在前），最多 CONFIG.backup.slots 份。
 *   每累計在線 intervalMinutes 分鐘一份、每天第一次上線一份；還原或匯入前也先備份目前的進度。
 * - 主存檔讀不出來時（state.js 的 loadGame）從最新一份可用的備份還原。
 * - 匯出：下載存檔檔案或複製文字；記錄上次匯出時間，太久沒匯出就提醒（第一次飛升後，每 remindDays 天）。
 * - navigator.storage.persist()：請瀏覽器不要自動清除這個網站的資料。
 * 數值都在 CONFIG.backup。
 * ========================================================= */

/**
 * 讀出全部自動備份（新的在前；讀不到回傳空陣列）
 * @returns {AutoBackup[]}
 */
function getAutoBackups() {
  try {
    const raw = localStorage.getItem(CONFIG.backup.autoKey);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((b) => b && typeof b.data === 'string' && typeof b.at === 'number') : [];
  } catch (e) {
    return [];
  }
}

/**
 * 寫入備份清單；空間不足時從最舊的開始丟，直到寫得進去
 * @param {AutoBackup[]} list
 */
function writeAutoBackups(list) {
  const arr = list.slice(0, CONFIG.backup.slots);
  while (arr.length) {
    try {
      localStorage.setItem(CONFIG.backup.autoKey, JSON.stringify(arr));
      return true;
    } catch (e) {
      arr.pop();
    }
  }
  return false;
}

/**
 * 上一次「主存檔寫不進去、清出空間」的紀錄（測試與除錯用）
 * @type {{versionBackups: number[], autoBefore: number, autoAfter: number, ok: boolean} | null}
 */
let lastSpaceCleanup = null;

/**
 * 主存檔寫不進去時，清出空間給主存檔（state.js 的 saveGame 呼叫）
 * 1. 刪舊版的遷移備份（CONFIG.save.key + '_v{N}_backup'），從最舊的版本開始；最新的一份（升到目前版本前的那份）保留
 * 2. 從最舊的開始減少自動備份，最後全部刪掉
 * 每清一次就重試 tryWrite，寫進去就停。飛升前備份、讀檔失敗時保存的原始內容不刪。
 * @param {() => void} tryWrite 寫入主存檔（失敗時丟出錯誤）
 * @returns {boolean} 主存檔有沒有寫進去
 */
function freeSpaceForMainSave(tryWrite) {
  const report = { versionBackups: [], autoBefore: 0, autoAfter: 0, ok: false };
  lastSpaceCleanup = report;
  const attempt = () => {
    try {
      tryWrite();
      report.ok = true;
      return true;
    } catch (e) {
      return false;
    }
  };
  // 1. 舊版的遷移備份
  const re = new RegExp('^' + CONFIG.save.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '_v(\\d+)_backup$');
  /** @type {number[]} */
  const versions = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const m = re.exec(localStorage.key(i) || '');
      if (m) versions.push(Number(m[1]));
    }
  } catch (e) {
    /* 讀不到清單：跳過這一步 */
  }
  versions.sort((a, b) => a - b);
  for (const v of versions.slice(0, -1)) {
    try {
      localStorage.removeItem(`${CONFIG.save.key}_v${v}_backup`);
    } catch (e) {
      continue;
    }
    report.versionBackups.push(v);
    if (attempt()) return true;
  }
  // 2. 自動備份：從最舊的開始一份一份減少
  let list = getAutoBackups();
  report.autoBefore = list.length;
  report.autoAfter = list.length;
  while (list.length) {
    list = list.slice(0, -1);
    try {
      if (list.length) localStorage.setItem(CONFIG.backup.autoKey, JSON.stringify(list));
      else localStorage.removeItem(CONFIG.backup.autoKey);
    } catch (e) {
      continue; // 連縮小後的清單都寫不進去：再少一份
    }
    report.autoAfter = list.length;
    if (attempt()) return true;
  }
  return false;
}

/**
 * 備份目前的進度
 * @param {string} reason interval／daily／restore／import
 * @param {string} [data] 存檔文字（預設為目前的 state）
 */
function makeAutoBackup(reason, data) {
  if (!state) return false;
  const text = data || JSON.stringify(state);
  /** @type {AutoBackup} */
  const entry = {
    at: Date.now(),
    reason,
    version: state.version,
    stage: state.stage.highest,
    best: getBestStage(),
    asc: state.ascension.count,
    data: text,
  };
  return writeAutoBackups([entry, ...getAutoBackups()]);
}

/**
 * 主存檔讀不出來時：從最新一份讀得出來的備份還原（state.js 的 loadGame 呼叫）
 * @returns {{state: GameState, at: number} | null}
 */
function restoreLatestAutoBackup() {
  for (const b of getAutoBackups()) {
    try {
      return { state: parseSaveText(b.data), at: b.at };
    } catch (e) {
      /* 這份也壞了：試下一份 */
    }
  }
  return null;
}

/**
 * 定時檢查要不要自動備份（每秒的 slowTick 與跨日檢查呼叫）
 * @returns {string|null} 這次備份的原因
 */
function checkAutoBackup() {
  const b = state.backup;
  const play = state.features.playSeconds || 0;
  const today = todayString();
  let reason = null;
  if (b.autoDate !== today) reason = 'daily';
  else if (play - b.autoPlaySec >= CONFIG.backup.intervalMinutes * 60) reason = 'interval';
  if (!reason) return null;
  b.autoDate = today;
  b.autoPlaySec = play;
  makeAutoBackup(reason);
  return reason;
}

/**
 * 還原第 i 份自動備份（還原前先把目前的進度也存成一份備份）
 * @returns {{ok: boolean, error?: string}}
 */
function restoreAutoBackup(i) {
  const b = getAutoBackups()[i];
  if (!b) return { ok: false, error: '找不到這份備份' };
  makeAutoBackup('restore');
  return importSave(b.data);
}

// ---------- 匯出、匯入 ----------

/** 下載用的存檔檔名（例如 煉器修仙錄_存檔_2026-11-19.json） */
function getSaveFileName() {
  return CONFIG.backup.fileName.replace('{date}', todayString());
}

/** 記錄「已經匯出」（下載檔案、複製文字都算） */
function markExported() {
  state.backup.lastExportAt = Date.now();
  saveGame();
}

/**
 * 下載存檔檔案
 * @returns {boolean} 瀏覽器有沒有開始下載（試玩頁的框架可能擋下載，這時改用複製文字）
 */
function downloadSaveFile() {
  try {
    const prev = state.backup.lastExportAt;
    state.backup.lastExportAt = Date.now(); // 檔案裡也記錄這次匯出（之後從這個檔案匯入時不會提醒）
    let text;
    try {
      text = exportSave();
    } finally {
      state.backup.lastExportAt = prev;
    }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getSaveFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    markExported();
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 匯入存檔（文字或檔案內容）；匯入前先把目前的進度存成一份備份
 * @returns {{ok: boolean, error?: string}}
 */
function importSaveWithBackup(text) {
  makeAutoBackup('import');
  const lastExport = state.backup.lastExportAt;
  const res = importSave(text);
  if (res.ok) {
    // 匯入的存檔可能是更早的檔案：「上次匯出」取較新的那個
    state.backup.lastExportAt = Math.max(state.backup.lastExportAt || 0, lastExport || 0);
    saveGame();
  }
  return res;
}

// ---------- 提醒匯出 ----------

/** 從哪個時間開始算「多久沒匯出」：上次匯出，沒匯出過就從第一次飛升算 */
function getExportBaseTime() {
  if (state.backup.lastExportAt) return state.backup.lastExportAt;
  const h = state.ascension.history || [];
  const first = h.length ? Math.min(...h.map((x) => x.at || Infinity)) : Infinity;
  return isFinite(first) ? first : 0;
}

/** 距離上次匯出幾天（沒有基準時回傳 0） */
function getDaysSinceExport(now = Date.now()) {
  const base = getExportBaseTime();
  return base ? Math.floor((now - base) / 86400000) : 0;
}

/** 現在要不要提醒匯出 */
function shouldRemindExport(now = Date.now()) {
  if (state.ascension.count < CONFIG.backup.remindAfterAscensions) return false;
  if (state.backup.lastRemindDate === todayString()) return false;
  return getDaysSinceExport(now) >= CONFIG.backup.remindDays;
}

/** 玩家看過（關掉）今天的提醒 */
function dismissExportReminder() {
  state.backup.lastRemindDate = todayString();
  saveGame();
}

// ---------- 請瀏覽器保留資料 ----------

/**
 * 目前的狀態：persisted 已保護、notPersisted 未保護、unsupported 瀏覽器不支援
 * @returns {Promise<'persisted'|'notPersisted'|'unsupported'>}
 */
async function getPersistStatus() {
  try {
    if (!navigator.storage || !navigator.storage.persisted) return 'unsupported';
    return (await navigator.storage.persisted()) ? 'persisted' : 'notPersisted';
  } catch (e) {
    return 'unsupported';
  }
}

/**
 * 請瀏覽器不要自動清除（Firefox 會跳詢問；Chrome／Edge 自己判斷）
 * @returns {Promise<'persisted'|'notPersisted'|'unsupported'>}
 */
async function requestPersist() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return 'unsupported';
    return (await navigator.storage.persist()) ? 'persisted' : 'notPersisted';
  } catch (e) {
    return 'unsupported';
  }
}

/** 從主畫面（安裝的 PWA）開啟嗎 */
function isStandaloneApp() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || /** @type {any} */ (navigator).standalone === true;
  } catch (e) {
    return false;
  }
}
