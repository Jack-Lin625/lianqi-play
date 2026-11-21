// @ts-check
/* =========================================================
 * sound.js — 音效（Web Audio API 即時合成，不需要外部音效檔）
 *
 * 使用方式：playSound('open')、playSound('reveal', 品質序號)
 * 設定頁的音效開關存在 state.settings.sound
 * ========================================================= */

let audioCtx = null;
let masterGain = null;
const lastSoundTime = {};

/** 取得 AudioContext（瀏覽器規定要在使用者操作後才能發聲） */
function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext; // 舊版 Safari
    if (!AC) return null;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = CONFIG.sound.volume * ((state && state.settings.sfxVolume) ?? CONFIG.sound.defaultSfxVolume) * CONFIG.sound.sfxBoost;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/**
 * 播放一個音
 * @param {Object} o { freq, type, dur, vol, slideTo, delay }
 */
function tone(o) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + (o.delay || 0);
  const dur = o.dur || 0.12;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(o.vol || 0.2, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** 播放一段雜訊（打擊感） */
function noise(o) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + (o.delay || 0);
  const dur = o.dur || 0.08;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = o.filter || 1200;
  const gain = ctx.createGain();
  gain.gain.value = o.vol || 0.2;
  src.connect(filter).connect(gain).connect(masterGain);
  src.start(t0);
}

/** 依序播放音階 */
function arpeggio(freqs, step, o = {}) {
  freqs.forEach((f, i) => tone({ ...o, freq: f, delay: (o.delay || 0) + i * step }));
}

/** 各種音效定義 */
const SOUNDS = {
  click: () => tone({ freq: 660, type: 'triangle', dur: 0.05, vol: 0.08 }),
  hit: () => noise({ dur: 0.06, vol: 0.12, filter: 1500 }),
  hurt: () => noise({ dur: 0.07, vol: 0.1, filter: 600 }),
  crit: () => {
    noise({ dur: 0.1, vol: 0.2, filter: 3000 });
    tone({ freq: 900, type: 'square', dur: 0.08, vol: 0.06, slideTo: 1400 });
  },
  dodge: () => tone({ freq: 1200, type: 'sine', dur: 0.1, vol: 0.06, slideTo: 2000 }),
  kill: () => tone({ freq: 300, type: 'triangle', dur: 0.15, vol: 0.12, slideTo: 120 }),
  coin: () => arpeggio([988, 1319], 0.06, { type: 'square', dur: 0.08, vol: 0.05 }),
  open: () => {
    noise({ dur: 0.12, vol: 0.12, filter: 800 });
    tone({ freq: 220, type: 'triangle', dur: 0.15, vol: 0.12, slideTo: 440 });
  },
  /** 開箱揭曉：品質越高音階越高、越長 */
  reveal: (rarityIndex = 0) => {
    const base = [523, 587, 659, 784, 880, 1047][rarityIndex] || 523;
    const notes = rarityIndex >= 3 ? [base, base * 1.25, base * 1.5, base * 2] : [base, base * 1.5];
    arpeggio(notes, 0.07, { type: rarityIndex >= 4 ? 'sawtooth' : 'triangle', dur: 0.18, vol: 0.1 });
  },
  equip: () => arpeggio([392, 523, 659], 0.05, { type: 'triangle', dur: 0.1, vol: 0.1 }),
  salvage: () => {
    noise({ dur: 0.08, vol: 0.1, filter: 900 });
    SOUNDS.coin();
  },
  upgrade: () => arpeggio([523, 659, 784, 1047, 1319], 0.08, { type: 'triangle', dur: 0.25, vol: 0.12 }),
  unlock: () => arpeggio([659, 880, 1175], 0.08, { type: 'sine', dur: 0.2, vol: 0.12 }),
  stageClear: () => arpeggio([523, 659, 784], 0.08, { type: 'triangle', dur: 0.15, vol: 0.1 }),
  bossClear: () => arpeggio([523, 659, 784, 1047, 784, 1047], 0.1, { type: 'square', dur: 0.2, vol: 0.07 }),
  defeat: () => arpeggio([392, 330, 262, 196], 0.12, { type: 'triangle', dur: 0.25, vol: 0.1 }),
  /** 道途技能：劍氣破空 */
  skill: () => {
    tone({ freq: 1600, type: 'sawtooth', dur: 0.18, vol: 0.05, slideTo: 400 });
    noise({ dur: 0.18, vol: 0.16, filter: 2500, delay: 0.05 });
    arpeggio([784, 1175], 0.06, { type: 'triangle', dur: 0.15, vol: 0.08, delay: 0.08 });
  },
  /** 道途護體：沉穩的鐘聲 */
  shield: () => {
    tone({ freq: 196, type: 'sine', dur: 0.6, vol: 0.18 });
    tone({ freq: 392, type: 'triangle', dur: 0.4, vol: 0.06 });
  },
  /** 孵化靈獸：蛋殼碎裂 + 上升音階 */
  hatch: (rarityIndex = 0) => {
    noise({ dur: 0.08, vol: 0.18, filter: 3000 });
    noise({ dur: 0.06, vol: 0.12, filter: 2000, delay: 0.12 });
    SOUNDS.reveal(rarityIndex);
  },
  /** 天品以上：符文展開的嗡鳴 */
  rune: () => {
    tone({ freq: 110, type: 'sawtooth', dur: 1.2, vol: 0.05, slideTo: 220 });
    tone({ freq: 220, type: 'sine', dur: 1.2, vol: 0.06, slideTo: 440 });
    arpeggio([523, 659, 784, 988], 0.18, { type: 'sine', dur: 0.4, vol: 0.05, delay: 0.3 });
  },
  /** 仙品專屬：鐘鳴 + 上行音階 + 天籟和聲 */
  mythic: () => {
    tone({ freq: 98, type: 'sine', dur: 2.2, vol: 0.22 });
    tone({ freq: 196, type: 'triangle', dur: 1.8, vol: 0.08 });
    arpeggio([587, 740, 880, 1175, 1480, 1760], 0.09, { type: 'triangle', dur: 0.5, vol: 0.09, delay: 0.1 });
    [1175, 1480, 1760].forEach((f) => tone({ freq: f, type: 'sine', dur: 1.6, vol: 0.04, delay: 0.7 }));
  },
  /** 天劫雷鳴（境界突破） */
  thunder: () => {
    noise({ dur: 0.9, vol: 0.35, filter: 400 });
    noise({ dur: 0.25, vol: 0.25, filter: 4000, delay: 0.05 });
    tone({ freq: 60, type: 'sawtooth', dur: 1.2, vol: 0.12, slideTo: 30 });
  },
  /** 成就達成 */
  achievement: () => arpeggio([784, 988, 1175, 1568, 1976], 0.06, { type: 'triangle', dur: 0.3, vol: 0.09 }),
  /** 仙品特效觸發 */
  proc: () => {
    tone({ freq: 1400, type: 'square', dur: 0.12, vol: 0.05, slideTo: 300 });
    noise({ dur: 0.15, vol: 0.18, filter: 5000 });
  },
  reward: () => arpeggio([784, 988, 1175, 1568], 0.07, { type: 'triangle', dur: 0.2, vol: 0.1 }),
};

/** 播放音效（有開關與頻率限制） */
function playSound(name, arg) {
  if (!state || !state.settings.sound || battleSilent) return;
  const fn = SOUNDS[name];
  if (!fn) return;
  // 頻繁觸發的音效做節流
  if (name === 'hit' || name === 'hurt' || name === 'crit' || name === 'dodge') {
    const now = performance.now();
    if (now - (lastSoundTime.battle || 0) < CONFIG.sound.hitThrottleMs) return;
    lastSoundTime.battle = now;
  }
  try {
    fn(arg);
  } catch (e) {
    /* 音效失敗不影響遊戲 */
  }
}
