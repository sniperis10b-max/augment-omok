// 외부 음원 파일 없이, Web Audio API로 짧은 효과음을 그때그때 만들어서 재생해요.

let ctx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, duration, { type = 'sine', gain = 0.15, delay = 0 } = {}) {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const startAt = audio.currentTime + delay;
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(gain, startAt + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

let enabled = true;
export function setSoundEnabled(v) {
  enabled = v;
}

export const sounds = {
  place() {
    if (!enabled) return;
    tone(520, 0.08, { type: 'sine', gain: 0.12 });
  },
  card() {
    if (!enabled) return;
    tone(760, 0.1, { type: 'triangle', gain: 0.1 });
    tone(1020, 0.12, { type: 'triangle', gain: 0.08, delay: 0.05 });
  },
  win() {
    if (!enabled) return;
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, { type: 'triangle', gain: 0.14, delay: i * 0.09 }));
  },
  lose() {
    if (!enabled) return;
    [400, 320, 260].forEach((f, i) => tone(f, 0.3, { type: 'sawtooth', gain: 0.1, delay: i * 0.12 }));
  },
  timeout() {
    if (!enabled) return;
    tone(220, 0.2, { type: 'square', gain: 0.08 });
  },
  message() {
    if (!enabled) return;
    tone(880, 0.06, { type: 'sine', gain: 0.08 });
  },
};
