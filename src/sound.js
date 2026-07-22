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

// 체스 말을 딱 내려놓는 듯한 짧고 단단한 "톡" 소리. 순수 톤이 아니라 짧은 노이즈
// 버스트를 밴드패스 필터에 통과시켜서 나무/플라스틱 조각이 부딪히는 질감을 내요.
function knock({ gain = 0.5, delay = 0, freq = 900 } = {}) {
  const audio = getCtx();
  if (!audio) return;
  const startAt = audio.currentTime + delay;
  const duration = 0.06;

  const bufferSize = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const noise = audio.createBufferSource();
  noise.buffer = buffer;

  const bandpass = audio.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = freq;
  bandpass.Q.value = 1.2;

  const g = audio.createGain();
  g.gain.setValueAtTime(gain, startAt);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  noise.connect(bandpass);
  bandpass.connect(g);
  g.connect(audio.destination);
  noise.start(startAt);
  noise.stop(startAt + duration + 0.01);

  // 낮은 "퉁" 하는 몸통음을 살짝 더해 체스 말이 나무판에 닿는 무게감을 줘요
  tone(140, 0.05, { type: 'sine', gain: gain * 0.35, delay });
}

let enabled = true;
export function setSoundEnabled(v) {
  enabled = v;
}

export const sounds = {
  place() {
    if (!enabled) return;
    knock({ gain: 0.5, freq: 1000 });
  },
  click() {
    if (!enabled) return;
    knock({ gain: 0.28, freq: 1600 });
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
