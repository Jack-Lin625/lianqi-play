// @ts-check
/* =========================================================
 * ui-unlock.js — 功能開放演出、已累積進度一次領取、功能引導
 * 流程：全螢幕演出 → 視窗（功能說明＋鎖住期間累積的進度與「一次領取」＋「前往」）
 * 升級類（開爐件數、道途二轉、靈獸第 2 欄）只跳提示，不播全螢幕演出
 * ========================================================= */

/** 正在播放功能開放演出（演出期間不跳其他視窗） */
let unlockCeremonyActive = false;

/** 升級提示：一則提示訊息＋解鎖音效 */
function showUpgradeNotice(msg) {
  if (battleSilent) return;
  toast(msg, CONFIG.fx.toast.long);
  playSound('unlock');
}

/**
 * 從排隊中取出下一個功能開放並顯示；有顯示回傳 true
 * 由 showNextQueuedModal 呼叫
 */
function showNextFeatureUnlock() {
  if (unlockCeremonyActive) return true;
  while (featureUnlockQueue.length) {
    const q = featureUnlockQueue.shift();
    const f = getFeature(q.id);
    if (!f) continue;
    if (f.kind === 'upgrade') {
      showUpgradeNotice(`${ri('star')} ${f.name}已開放！${f.hint}`);
      continue;
    }
    unlockCeremonyActive = true;
    playCeremony({ kind: 'unlock', title: `${f.name}・開放`, subtitle: getCondText(f.cond) });
    setTimeout(() => {
      unlockCeremonyActive = false;
      showFeatureUnlockModal(f);
    }, CONFIG.fx.ceremonyMs + CONFIG.fx.ceremonyFadeMs);
    return true;
  }
  return false;
}

/** 功能開放視窗：說明、已累積的進度（可一次領取）、前往 */
function showFeatureUnlockModal(f) {
  if (isModalOpen()) {
    // 有其他視窗開著（例如新法寶比較）：排回最前面，等關閉後再顯示
    featureUnlockQueue.unshift({ id: f.id, kind: f.kind });
    return;
  }
  const backlog = f.backlog ? getFeatureBacklog(f.id) : { count: 0, lines: [] };
  const backlogHTML = backlog.lines.length
    ? `<div class="unlock-backlog">
        <div class="sub-title">${ri('scroll')}鎖住期間已累積的進度</div>
        <ul>${backlog.lines.map((l) => `<li>${l}</li>`).join('')}</ul>
        ${backlog.count ? `<button class="btn-primary" id="btn-unlock-claim">一次領取（${backlog.count} 項）</button>` : '<div class="queue-hint">目前沒有可領取的獎勵</div>'}
      </div>`
    : '';
  const giftHTML = f.gift ? `<div class="unlock-gift">${ri('seal')}開放贈禮已發放：${rewardNamesHTML(f.gift)}</div>` : '';
  const canGo = f.page && f.page !== 'main';
  const modal = openModal(
    `<div class="modal-title">${ri('star')}${f.name}已開放</div>
     <div class="unlock-hint">${f.hint || ''}</div>
     ${giftHTML}
     ${backlogHTML}
     <div class="modal-buttons">
       <button class="btn-close">稍後</button>
       ${canGo ? '<button class="btn-primary" id="btn-unlock-go">前往</button>' : ''}
     </div>`
  );
  playSound('unlock');
  const claimBtn = modal.querySelector('#btn-unlock-claim');
  if (claimBtn) {
    claimBtn.addEventListener('click', () => {
      const got = claimFeatureBacklog(f.id);
      saveGame();
      renderAll();
      if (got) {
        playSound('reward');
        claimBtn.outerHTML = `<div class="unlock-got">已領取：${rewardGotHTML(got)}</div>`;
      } else claimBtn.remove();
    });
  }
  modal.querySelector('.btn-close').addEventListener('click', closeModal);
  const go = modal.querySelector('#btn-unlock-go');
  if (go)
    go.addEventListener('click', () => {
      closeModal();
      switchTab(f.page);
    });
}

/** 獎勵定義（Rewards）的簡短文字 */
function rewardNamesHTML(r) {
  const parts = [];
  if (r.gold) parts.push(`${ri('gold')}${fmtNum(r.gold)}`);
  if (r.keys) parts.push(`${ri('keys')}${fmtNum(r.keys)}`);
  if (r.stones) parts.push(`${ri('stones')}${fmtNum(r.stones)}`);
  if (r.eggs) parts.push(`${ri('egg')}靈獸蛋 ×${r.eggs}`);
  if (r.iron) parts.push(`${ri('iron')}玄鐵 ${fmtNum(r.iron)}`);
  if (r.essence) parts.push(`${ri('essence')}${fmtNum(r.essence)}`);
  return parts.join('、');
}
