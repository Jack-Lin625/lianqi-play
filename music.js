// @ts-check
/* =========================================================
 * music.js — 古風背景音樂（Web Audio 即時合成，不需要音檔）
 *
 * 三首：main（修煉）、dungeon（秘境）、boss（妖王戰）
 * 以五聲音階隨機生成旋律：古箏般的撥弦 + 低音持續音 + 偶爾的笛聲／鼓
 * 音量：state.settings.musicVolume（0～1），開關：state.settings.music
 * ========================================================= */

const MUSIC_THEMES = {
  // 宮調：D E F# A B，緩慢悠遠
  main: { root: 146.83, scale: [0, 2, 4, 7, 9], bpm: 66, density: 0.55, drum: 0, flute: 0.35, drone: 0.05 },
  // 羽調：A C D E G，稍快，有輕鼓
  dungeon: { root: 220, scale: [0, 3, 5, 7, 10], bpm: 84, density: 0.7, drum: 0.5, flute: 0.15, drone: 0.04 },
  // 角調：E G A B D，緊張、太鼓
  boss: { root: 164.81, scale: [0, 3, 5, 7, 10], bpm: 112, density: 0.85, drum: 1, flute: 0, drone: 0.06 },
};

const music = {
  gain: null, // 音樂總音量
  theme: null, // 目前曲目
  timer: null,
  nextTime: 0, // 下一個十六分音符的時間
  step: 0,
  degree: 2, // 旋律目前在音階上的位置（隨機漫步）
  droneNodes: null,
};

function musicCtx() {
  const ctx = getAudioCtx();
  if (!ctx) return null;
  if (!music.gain) {
    music.gain = ctx.createGain();
    music.gain.gain.value = 0;
    music.gain.connect(ctx.destination);
  }
  return ctx;
}

/** 音階第 n 個音的頻率（可跨八度） */
function scaleFreq(theme, n) {
  const len = theme.scale.length;
  const oct = Math.floor(n / len);
  const semi = theme.scale[((n % len) + len) % len] + oct * 12;
  return theme.root * Math.pow(2, semi / 12);
}

/** 古箏般的撥弦：三角波 + 快速衰減 + 一點滑音 */
function pluck(ctx, t, freq, vol = 0.18, dur = 1.4) {
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const g = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = 'triangle';
  osc2.type = 'sine';
  osc.frequency.setValueAtTime(freq * 1.01, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
  osc2.frequency.setValueAtTime(freq * 2, t);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq * 6, t);
  filter.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const g2 = ctx.createGain();
  g2.gain.value = 0.25;
  osc.connect(filter);
  osc2.connect(g2).connect(filter);
  filter.connect(g).connect(music.gain);
  osc.start(t);
  osc2.start(t);
  osc.stop(t + dur + 0.05);
  osc2.stop(t + dur + 0.05);
}

/** 笛聲：正弦波 + 顫音 + 緩起緩收 */
function flute(ctx, t, freq, dur) {
  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  lfo.frequency.value = 5.2;
  lfoGain.gain.value = freq * 0.012;
  lfo.connect(lfoGain).connect(osc.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(music.gain);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + dur + 0.05);
  lfo.stop(t + dur + 0.05);
}

/** 鼓：低頻正弦快速下滑 + 一點雜訊 */
function drum(ctx, t, vol = 0.35, low = false) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(low ? 90 : 140, t);
  osc.frequency.exponentialRampToValueAtTime(low ? 38 : 60, t + 0.25);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (low ? 0.6 : 0.3));
  osc.connect(g).connect(music.gain);
  osc.start(t);
  osc.stop(t + 0.7);
}

/** 低音持續音（兩個略為走音的正弦波，營造空靈感） */
function startDrone(ctx, theme) {
  stopDrone();
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(theme.drone, ctx.currentTime + 2);
  const a = ctx.createOscillator();
  const b = ctx.createOscillator();
  a.frequency.value = theme.root / 2;
  b.frequency.value = (theme.root / 2) * 1.5 * 1.003;
  a.connect(g);
  b.connect(g);
  g.connect(music.gain);
  a.start();
  b.start();
  music.droneNodes = { g, a, b };
}

function stopDrone() {
  const d = music.droneNodes;
  if (!d) return;
  const ctx = getAudioCtx();
  d.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
  d.a.stop(ctx.currentTime + 1.1);
  d.b.stop(ctx.currentTime + 1.1);
  music.droneNodes = null;
}

/** 排程下一小段音符（每 100ms 檢查一次，提前排 0.4 秒） */
function scheduleMusic() {
  const ctx = getAudioCtx();
  const theme = MUSIC_THEMES[music.theme];
  if (!ctx || !theme) return;
  const sixteenth = 60 / theme.bpm / 4;
  while (music.nextTime < ctx.currentTime + 0.4) {
    const t = music.nextTime;
    const s = music.step % 16;
    // 旋律：在八分音符上依密度出現，隨機漫步、偶爾跳進
    if (s % 2 === 0 && Math.random() < theme.density * (s % 8 === 0 ? 1 : 0.6)) {
      music.degree += pickRandom([-2, -1, -1, 1, 1, 2, 0, 3, -3]);
      music.degree = Math.max(0, Math.min(10, music.degree));
      pluck(ctx, t, scaleFreq(theme, music.degree + 5), 0.14);
      // 偶爾加一個高八度的泛音點綴
      if (Math.random() < 0.15) pluck(ctx, t + sixteenth, scaleFreq(theme, music.degree + 10), 0.05, 0.8);
    }
    // 低音：每小節第一拍
    if (s === 0) pluck(ctx, t, scaleFreq(theme, pickRandom([0, 0, 2, 3])), 0.16, 2.5);
    // 笛聲：偶爾在小節開頭吹一句長音
    if (s === 0 && theme.flute && Math.random() < theme.flute) flute(ctx, t + sixteenth * 2, scaleFreq(theme, music.degree + 10), sixteenth * 10);
    // 鼓
    if (theme.drum) {
      if (s === 0 || s === 8) drum(ctx, t, 0.3 * theme.drum, true);
      if (theme.drum >= 1 && (s === 4 || s === 12 || s === 14)) drum(ctx, t, 0.18);
      if (theme.drum < 1 && s === 12 && Math.random() < 0.5) drum(ctx, t, 0.12);
    }
    music.nextTime += sixteenth;
    music.step++;
  }
}

/** 套用音樂／音效音量 */
function applyVolumes() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const s = state.settings;
  if (masterGain) masterGain.gain.value = CONFIG.sound.volume * (s.sfxVolume ?? CONFIG.sound.defaultSfxVolume) * CONFIG.sound.sfxBoost;
  if (music.gain) {
    const target = s.music ? CONFIG.sound.musicVolume * (s.musicVolume ?? CONFIG.sound.defaultMusicVolume) : 0;
    music.gain.gain.cancelScheduledValues(ctx.currentTime);
    music.gain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.4);
  }
}

/**
 * 切換曲目（同一首不重新開始）；音樂關閉時只記住曲目
 * @param {'main'|'dungeon'|'boss'} theme
 */
function playMusic(theme) {
  if (music.theme === theme && music.timer) return;
  music.theme = theme;
  if (!state || !state.settings.music) return;
  const ctx = musicCtx();
  if (!ctx) return;
  // 淡出舊曲、淡入新曲
  music.gain.gain.cancelScheduledValues(ctx.currentTime);
  music.gain.gain.setValueAtTime(music.gain.gain.value, ctx.currentTime);
  music.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
  music.gain.gain.linearRampToValueAtTime(CONFIG.sound.musicVolume * (state.settings.musicVolume ?? 0.5), ctx.currentTime + 2);
  music.nextTime = ctx.currentTime + 0.6;
  music.step = 0;
  startDrone(ctx, MUSIC_THEMES[theme]);
  if (!music.timer) music.timer = setInterval(scheduleMusic, 100);
}

function stopMusic() {
  if (music.timer) clearInterval(music.timer);
  music.timer = null;
  stopDrone();
  const ctx = getAudioCtx();
  if (ctx && music.gain) music.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
}

/** 依目前畫面決定該播哪一首 */
function getDesiredMusic() {
  if (dungeonRun.active) return dungeonRun.type === 'worldBoss' || dungeonRun.type === 'tower' ? 'boss' : 'dungeon';
  return isBossStage(getCurrentTotal()) ? 'boss' : 'main';
}

/** 定期呼叫：曲目跟著狀態切換 */
function updateMusic() {
  if (!state.settings.music || !audioCtx || audioCtx.state !== 'running') return;
  playMusic(getDesiredMusic());
}
