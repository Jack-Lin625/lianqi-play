// @ts-check
/* =========================================================
 * ui-settings.js — 設定頁（從 ui.js 拆出，路線圖 C1）
 *   聲音、存檔（下載檔案／從檔案匯入／複製文字／貼上匯入）、存檔保護（自動備份清單與還原、請瀏覽器保留資料）、
 *   讀檔失敗的說明、存檔失敗的提示、主畫面的「提醒匯出」橫幅
 *   存檔保護的邏輯在 backup.js
 * ========================================================= */

const BACKUP_REASON_TEXT = { interval: '定時', daily: '每天第一次上線', restore: '還原前', import: '匯入前' };
const PERSIST_TEXT = {
  persisted: '已保護：瀏覽器不會自動清除這個遊戲的資料',
  notPersisted: '未保護：瀏覽器空間不足或太久沒開時，可能自動清除資料（加到主畫面、或按下面的按鈕）',
  unsupported: '這個瀏覽器不支援「保留資料」設定，請定期下載存檔檔案',
};

function initSettingsUI() {
  const snd = $input('#set-sound');
  snd.addEventListener('change', () => {
    state.settings.sound = snd.checked;
    saveGame();
    playSound('click');
  });
  const mus = $input('#set-music');
  mus.addEventListener('change', () => {
    state.settings.music = mus.checked;
    saveGame();
    if (mus.checked) {
      getAudioCtx();
      playMusic(getDesiredMusic());
    } else stopMusic();
  });
  // 音量滑桿（0～100）
  const bindVol = (id, key) => {
    const el = $input(id);
    const label = $(id + '-val');
    el.addEventListener('input', () => {
      state.settings[key] = Number(el.value) / 100;
      label.textContent = el.value;
      applyVolumes();
    });
    el.addEventListener('change', () => {
      saveGame();
      if (key === 'sfxVolume') playSound('coin');
    });
  };
  bindVol('#set-music-vol', 'musicVolume');
  bindVol('#set-sfx-vol', 'sfxVolume');

  // ---- 存檔：下載檔案、從檔案匯入 ----
  $('#btn-download-save').addEventListener('click', onDownloadSave);
  const fileInput = $input('#file-import-save');
  $('#btn-import-file').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    let text = '';
    try {
      text = await file.text();
    } catch (e) {
      toast('讀不到這個檔案');
      return;
    }
    await doImport(text);
  });

  // ---- 存檔：文字 ----
  $('#btn-export').addEventListener('click', () => {
    $textarea('#save-text').value = exportSave();
    markExported();
    renderSaveSettings();
    toast('已匯出，可以按「複製」保存這段文字');
  });

  $('#btn-copy').addEventListener('click', () => {
    const ta = $textarea('#save-text');
    if (!ta.value) ta.value = exportSave();
    const ok = () => {
      markExported();
      renderSaveSettings();
      toast('已複製到剪貼簿');
    };
    const fallback = () => {
      ta.select();
      try {
        document.execCommand('copy');
        ok();
      } catch (e) {
        toast('無法自動複製，請手動選取文字複製');
      }
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(ta.value).then(ok, fallback);
    } else {
      fallback();
    }
  });

  $('#btn-import').addEventListener('click', async () => {
    const text = $textarea('#save-text').value;
    if (!text.trim()) {
      toast('請先把存檔文字貼到上方欄位');
      return;
    }
    await doImport(text);
  });

  // ---- 存檔保護 ----
  $('#btn-persist').addEventListener('click', async () => {
    const r = await requestPersist();
    renderPersistStatus(r);
    toast(r === 'persisted' ? `${ri('check')} 已請瀏覽器保留遊戲資料` : r === 'unsupported' ? '這個瀏覽器不支援，請定期下載存檔檔案' : '瀏覽器沒有同意，請定期下載存檔檔案');
  });

  $('#btn-tutorial-reset').addEventListener('click', () => {
    state.tutorial.seen = [];
    saveGame();
    switchTab('main');
    showTutorial('welcome');
  });

  // 存檔失敗：每次開啟只提示一次
  let warned = false;
  onSaveFailed = () => {
    if (warned) return;
    warned = true;
    toast('存檔失敗：瀏覽器的儲存空間不足或不允許存檔（例如私密瀏覽）。請到「設定」下載存檔檔案保存進度。', CONFIG.fx.toast.long);
  };

  syncSettingsUI();
}

function syncSettingsUI() {
  const st = state.settings;
  $input('#set-sound').checked = !!st.sound;
  $input('#set-music').checked = !!st.music;
  $input('#set-music-vol').value = String(Math.round((st.musicVolume ?? CONFIG.sound.defaultMusicVolume) * 100));
  $('#set-music-vol-val').textContent = $input('#set-music-vol').value;
  $input('#set-sfx-vol').value = String(Math.round((st.sfxVolume ?? CONFIG.sound.defaultSfxVolume) * 100));
  $('#set-sfx-vol-val').textContent = $input('#set-sfx-vol').value;
}

/** 匯入（文字或檔案）：二次確認 → 先備份目前的進度 → 匯入 */
async function doImport(text) {
  if (!(await askConfirm('匯入後會覆蓋目前的進度（目前的進度會先存成一份自動備份），確定嗎？', { okText: '匯入', danger: true }))) return;
  const res = importSaveWithBackup(text);
  if (!res.ok) {
    toast(res.error, CONFIG.fx.toast.long);
    return;
  }
  onStateReplaced();
  toast(`${ri('check')} 存檔已匯入`);
}

/** 下載存檔檔案；瀏覽器擋下載時改顯示文字讓玩家複製 */
function onDownloadSave() {
  if (downloadSaveFile()) {
    toast(`${ri('check')} 已下載 ${getSaveFileName()}`);
  } else {
    $textarea('#save-text').value = exportSave();
    toast('這裡不能下載檔案，存檔文字已放在下方欄位，請按「複製」保存');
  }
  renderSaveSettings();
  renderExportReminder();
}

/** 設定頁：上次匯出、自動備份清單、保留資料狀態（切到設定頁時呼叫） */
function renderSaveSettings() {
  const days = getDaysSinceExport();
  setHTML(
    $('#last-export-note'),
    state.backup.lastExportAt ? `上次匯出：${new Date(state.backup.lastExportAt).toLocaleString()}（${days} 天前）` : '還沒有匯出過存檔'
  );
  const list = getAutoBackups();
  const html = list.length
    ? list
        .map(
          (b, i) => `<div class="backup-row">
        <div class="backup-info"><b>${new Date(b.at).toLocaleString()}</b><small>${BACKUP_REASON_TEXT[b.reason] || b.reason}・${formatStage(Math.max(1, b.stage))}・飛升 ${b.asc} 次・v${b.version}</small></div>
        <button class="btn-secondary btn-restore-backup" data-restore="${i}">還原</button>
      </div>`
        )
        .join('')
    : '<div class="queue-hint">還沒有自動備份（每 ' + CONFIG.backup.intervalMinutes + ' 分鐘在線、每天第一次上線會自動備份）</div>';
  const box = $('#auto-backup-list');
  setHTML(box, html);
  $$('[data-restore]', box).forEach((el) => el.addEventListener('click', () => onRestoreAutoBackup(Number(el.dataset.restore))));
  getPersistStatus().then(renderPersistStatus);
}

function renderPersistStatus(status) {
  setHTML($('#persist-status'), PERSIST_TEXT[status] || '');
  const btn = $button('#btn-persist');
  if (btn) btn.disabled = status !== 'notPersisted';
}

/** 還原第 i 份自動備份（二次確認） */
async function onRestoreAutoBackup(i) {
  const b = getAutoBackups()[i];
  if (!b) return toast('找不到這份備份');
  const when = new Date(b.at).toLocaleString();
  if (!(await askConfirm(`還原到 ${when} 的存檔？<br>目前的進度會先存成一份自動備份。`, { okText: '還原', danger: true }))) return;
  const res = restoreAutoBackup(i);
  if (!res.ok) return toast(res.error || '還原失敗');
  onStateReplaced();
  toast(`${ri('check')} 已還原 ${when} 的存檔`);
}

/** 載入時的讀檔結果說明（主存檔壞掉時） */
function showLoadResultNotice() {
  const r = loadResult;
  if (r.status === 'recovered') {
    showNotice(`主存檔讀取失敗，已經從 <b>${new Date(r.backupAt || 0).toLocaleString()}</b> 的自動備份還原。<br>讀不出來的原始內容另外保存在瀏覽器裡（不會被覆蓋）。`);
  } else if (r.status === 'lost') {
    showNotice('主存檔讀取失敗，也沒有可用的自動備份，所以從頭開始。<br>讀不出來的原始內容另外保存在瀏覽器裡；如果你有下載過存檔檔案，可以到「設定 → 存檔」匯入。');
  }
}

/** 只有「知道了」按鈕的說明視窗（疊在其他視窗上面） */
function showNotice(message) {
  const root = $('#confirm-root');
  root.innerHTML = `<div class="modal-overlay confirm-overlay"><div class="modal">
    <div class="confirm-text">${message}</div>
    <div class="modal-buttons"><button class="btn-equip" id="notice-ok">知道了</button></div>
  </div></div>`;
  $('#notice-ok').addEventListener('click', () => (root.innerHTML = ''));
}

/** 主畫面的「提醒匯出」橫幅 */
function renderExportReminder() {
  const el = $('#export-reminder');
  if (!el) return;
  const show = shouldRemindExport();
  el.classList.toggle('hidden', !show);
  if (!show) return;
  const days = getDaysSinceExport();
  setHTML(
    el,
    `<span>${ri('scroll')}已經 ${days} 天沒有備份存檔到瀏覽器以外的地方</span>
    <button class="btn-secondary" id="btn-reminder-download">下載存檔</button>
    <button class="reminder-close" id="btn-reminder-close" aria-label="今天不再提醒">×</button>`
  );
  $('#btn-reminder-download').addEventListener('click', () => {
    onDownloadSave();
    dismissExportReminder();
    renderExportReminder();
  });
  $('#btn-reminder-close').addEventListener('click', () => {
    dismissExportReminder();
    renderExportReminder();
  });
}
