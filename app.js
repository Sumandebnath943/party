'use strict';

// ============================================================
// PULSE — Gamified Interactive Beat Machine
// ============================================================

const TRACKS = [
  { name: 'KICK',  color: '#ff3b5c', icon: '🥁', synth: 'kick' },
  { name: 'SNARE', color: '#e8e4f0', icon: '💥', synth: 'snare' },
  { name: 'CLAP',  color: '#ffc93c', icon: '👏', synth: 'clap' },
  { name: 'HAT',   color: '#00e5ff', icon: '✨', synth: 'hihat' },
  { name: 'BASS',  color: '#a855f7', icon: '🌊', synth: 'bass' },
  { name: 'LEAD',  color: '#3b82f6', icon: '🎸', synth: 'lead' },
  { name: 'PAD',   color: '#ec4899', icon: '🎹', synth: 'pad' },
  { name: 'SYNTH', color: '#f97316', icon: '🚀', synth: 'arp' },
  { name: 'SAX',   color: '#eab308', icon: '🎷', synth: 'sax' },
  { name: 'BRASS', color: '#ef4444', icon: '🎺', synth: 'brass' },
  { name: 'BELL',  color: '#8b5cf6', icon: '🔔', synth: 'bell' },
  { name: 'FX',    color: '#10b981', icon: '⚡', synth: 'fx' },
];

const STEPS = 16;
const DEFAULT_BPM = 128;

// Notes
const BASS_NOTES = [65.41, 73.42, 77.78, 98.0, 110.0];
const LEAD_NOTES = [261.63, 293.66, 311.13, 392.0, 440.0, 523.25, 587.33, 622.25];
const PAD_NOTES  = [130.81, 155.56, 196.0, 233.08];
const ARP_NOTES = [523.25, 659.25, 783.99, 1046.50];
const SAX_NOTES = [392.0, 440.0, 523.25, 587.33, 659.25];
const BRASS_NOTES = [130.81, 196.0, 261.63];
const BELL_NOTES = [1046.50, 1318.51, 1567.98, 2093.00];

// ---- Gamification State ----
const game = {
  score: 0,
  combo: 0,
  maxCombo: 0,
  energy: 0,
  energyMax: 100,
  multiplier: 1,
  lastNoteTime: 0,
  achievements: new Set()
};

const state = {
  grid: Array(TRACKS.length).fill(null).map(() => Array(STEPS).fill(false)),
  playing: false,
  bpm: DEFAULT_BPM,
  currentStep: 0,
  muted: Array(TRACKS.length).fill(false),
  presets: [null, null, null],
  currentPreset: 0,
  nextStepTime: 0,
};

// ---- Guidance Engine ----
const GuidanceEngine = {
  analyze(grid) {
    if (!els.guideSwitch || !els.guideSwitch.checked) return;
    
    const kicks = grid[0], snares = grid[1], claps = grid[2], hats = grid[3];
    const bass = grid[4], lead = grid[5], pad = grid[6], synth = grid[7], sax = grid[8];
    
    let totalActive = 0;
    grid.forEach(row => row.forEach(val => totalActive += val ? 1 : 0));
    
    let hint = "Pattern looks solid! Keep experimenting.";
    let reason = "Your arrangement has a nice balance of elements.";
    
    if (totalActive === 0) {
      hint = "Start with a 4-on-the-floor kick drum.";
      reason = "Placing a kick on steps 1, 5, 9, and 13 is the foundation of most dance tracks.";
      return this.updateUI(hint, reason);
    }

    const kicksOnBeats = kicks[0] && kicks[4] && kicks[8] && kicks[12];
    const snareOnBackbeat = (snares[4] || claps[4]) && (snares[12] || claps[12]);
    const offbeatHats = hats[2] && hats[6] && hats[10] && hats[14];

    if (kicksOnBeats && !snareOnBackbeat) {
      hint = "House beat detected! Add a backbeat.";
      reason = "You have a solid 4-on-the-floor kick. Add a Snare or Clap on steps 5 and 13 to give it that driving energy.";
      return this.updateUI(hint, reason);
    }
    
    if (kicksOnBeats && snareOnBackbeat && !offbeatHats) {
      hint = "Add some bounce with off-beat Hi-Hats.";
      reason = "Place Hi-Hats on steps 3, 7, 11, and 15. This fills the gaps between the kicks and makes the groove irresistible.";
      return this.updateUI(hint, reason);
    }

    const hasBass = bass.some(v => v);
    if (!hasBass && kicks.some(v => v)) {
      hint = "Drop in a Bassline.";
      reason = "A beat without bass feels empty. Try placing bass notes on the exact same steps as your kick for maximum punch.";
      return this.updateUI(hint, reason);
    }
    
    if (hasBass && kicks.some(v => v)) {
      let bassAlwaysOnKick = true;
      for(let i=0; i<16; i++) { if (bass[i] && !kicks[i]) bassAlwaysOnKick = false; }
      if (bassAlwaysOnKick && bass.filter(v => v).length > 2) {
        hint = "Try syncopating your Bassline.";
        reason = "Your bass strictly follows the kick. Shift a few bass notes one step left or right to create a funky, syncopated feel.";
        return this.updateUI(hint, reason);
      }
    }

    let clashes = 0;
    for(let i=0; i<16; i++) {
      if ((lead[i] && sax[i]) || (lead[i] && synth[i]) || (sax[i] && synth[i])) clashes++;
    }
    if (clashes > 2) {
      hint = "Separate your Melodies (Call & Response).";
      reason = "Your Lead, Sax, and Synth are playing at the exact same time, creating a frequency clash. Have one answer the other instead!";
      return this.updateUI(hint, reason);
    }

    if (totalActive > 50) {
       hint = "Create a Breakdown: Drop the drums!";
       reason = "The mix is very dense. Try clearing your kicks and bass for a few cycles to build tension, then bring them back for a huge drop.";
       return this.updateUI(hint, reason);
    }
    
    this.updateUI(hint, reason);
  },
  updateUI(hint, reason) {
    if (els.assistantHint) els.assistantHint.textContent = hint;
    if (els.assistantReason) els.assistantReason.textContent = reason;
  }
};

// ---- Gamification Logic ----
function addScore(amount, x, y, reason = '') {
  const points = amount * game.multiplier;
  game.score += points;
  
  // Update UI
  const scoreEl = document.getElementById('score-val');
  scoreEl.textContent = game.score;
  scoreEl.classList.remove('bump');
  void scoreEl.offsetWidth;
  scoreEl.classList.add('bump');

  // Spawn popup
  if (x !== undefined && y !== undefined) {
    spawnScorePopup(points, x, y, reason);
  }

  // Energy
  addEnergy(amount * 0.5);
  checkAchievements();
}

function addCombo() {
  game.combo++;
  if (game.combo > game.maxCombo) game.maxCombo = game.combo;
  game.multiplier = 1 + Math.floor(game.combo / 16); // +1 mult every 16 combo
  
  const comboEl = document.getElementById('combo-val');
  comboEl.innerHTML = `${game.combo}<span class="combo-x">x</span>`;
  comboEl.style.color = game.combo > 32 ? 'var(--fx)' : game.combo > 16 ? 'var(--kick)' : 'var(--clap)';
}

function resetCombo() {
  game.combo = 0;
  game.multiplier = 1;
  const comboEl = document.getElementById('combo-val');
  comboEl.innerHTML = `0<span class="combo-x">x</span>`;
  comboEl.style.color = '';
}

function addEnergy(amount) {
  game.energy = Math.min(game.energyMax, game.energy + amount);
  updateEnergyUI();
  
  if (game.energy >= game.energyMax && !game.achievements.has('OVERLOAD')) {
    unlockAchievement('OVERLOAD', 'Max Energy Reached', '⚡', 1000);
    triggerOverload();
  }
}

function drainEnergy() {
  if (state.playing) {
    game.energy = Math.max(0, game.energy - 0.5);
    updateEnergyUI();
  }
}

function updateEnergyUI() {
  const pct = (game.energy / game.energyMax) * 100;
  document.getElementById('energy-fill').style.width = `${pct}%`;
  document.getElementById('energy-glow').style.width = `${pct}%`;
  document.getElementById('energy-label').textContent = `${Math.floor(pct)}%`;
}

function triggerOverload() {
  const bg = document.getElementById('bg-pulse');
  bg.classList.add('flash');
  setTimeout(() => bg.classList.remove('flash'), 500);
  
  // Bonus score
  addScore(500, window.innerWidth/2, 100, 'OVERLOAD BONUS!');
  game.energy = 0; // Reset
}

function spawnScorePopup(points, x, y, text = '') {
  const container = document.getElementById('score-popups');
  const pop = document.createElement('div');
  pop.className = 'score-pop';
  pop.textContent = text ? `${text} +${points}` : `+${points}`;
  
  // Random jitter
  const jx = x + (Math.random() - 0.5) * 40;
  const jy = y + (Math.random() - 0.5) * 40;
  
  pop.style.left = `${jx}px`;
  pop.style.top = `${jy}px`;
  
  // Color based on multiplier
  if (game.multiplier > 2) pop.style.color = 'var(--kick)';
  else if (game.multiplier > 1) pop.style.color = 'var(--fx)';
  
  container.appendChild(pop);
  setTimeout(() => pop.remove(), 800);
}

function unlockAchievement(id, title, icon, bonus) {
  if (game.achievements.has(id)) return;
  game.achievements.add(id);
  
  addScore(bonus, window.innerWidth - 100, 100);
  
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-text">
      <span class="toast-title">${title}</span>
      <span class="toast-desc">Achievement Unlocked</span>
    </div>
    <div class="toast-score">+${bonus}</div>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function checkAchievements() {
  if (game.combo >= 50) unlockAchievement('COMBO_50', 'Flow State', '🔥', 500);
  if (game.combo >= 100) unlockAchievement('COMBO_100', 'God Mode', '👑', 2000);
  if (game.score >= 10000) unlockAchievement('SCORE_10K', 'Beatmaker', '💿', 1000);
}


// ---- Audio Engine ----
let audioCtx = null;
let masterGain = null;
let compressor = null;
let analyser = null;
let analyserData = null;

function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.7;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyserData = new Uint8Array(analyser.frequencyBinCount);

  masterGain.connect(compressor);
  compressor.connect(analyser);
  analyser.connect(audioCtx.destination);
}

function createNoiseBuffer(duration) {
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

let noiseBuffer = null;
function getNoiseBuffer() {
  if (!noiseBuffer) noiseBuffer = createNoiseBuffer(2);
  return noiseBuffer;
}

const synths = {
  kick(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.12);
    osc.frequency.exponentialRampToValueAtTime(10, time + 0.4);
    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);
    osc.connect(gain).connect(masterGain);
    osc.start(time); osc.stop(time + 0.5);

    const click = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(1200, time);
    click.frequency.exponentialRampToValueAtTime(100, time + 0.02);
    clickGain.gain.setValueAtTime(0.3, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    click.connect(clickGain).connect(masterGain);
    click.start(time); click.stop(time + 0.05);
  },
  snare(time) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2000;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.55, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    noise.connect(noiseFilter).connect(noiseGain).connect(masterGain);
    noise.start(time); noise.stop(time + 0.25);

    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.04);
    oscGain.gain.setValueAtTime(0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(oscGain).connect(masterGain);
    osc.start(time); osc.stop(time + 0.15);
  },
  clap(time) {
    for (let i = 0; i < 3; i++) {
      const noise = audioCtx.createBufferSource();
      noise.buffer = getNoiseBuffer();
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 2500; filter.Q.value = 3;
      const gain = audioCtx.createGain();
      const t = time + i * 0.012;
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      noise.connect(filter).connect(gain).connect(masterGain);
      noise.start(t); noise.stop(t + 0.05);
    }
    const tail = audioCtx.createBufferSource();
    tail.buffer = getNoiseBuffer();
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 1500; filter.Q.value = 1.5;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.35, time + 0.036);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    tail.connect(filter).connect(gain).connect(masterGain);
    tail.start(time + 0.036); tail.stop(time + 0.35);
  },
  hihat(time) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 10000; bp.Q.value = 2;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    noise.connect(hp).connect(bp).connect(gain).connect(masterGain);
    noise.start(time); noise.stop(time + 0.1);
  },
  bass(time, step) {
    const note = BASS_NOTES[step % BASS_NOTES.length];
    const osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(note, time);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(800, time);
    filter.frequency.exponentialRampToValueAtTime(200, time + 0.3); filter.Q.value = 5;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    osc.connect(filter).connect(gain).connect(masterGain);
    osc.start(time); osc.stop(time + 0.4);
  },
  lead(time, step) {
    const note = LEAD_NOTES[step % LEAD_NOTES.length];
    const osc = audioCtx.createOscillator(); osc.type = 'square'; osc.frequency.setValueAtTime(note, time);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(3000, time);
    filter.frequency.exponentialRampToValueAtTime(800, time + 0.2); filter.Q.value = 4;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.15, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    osc.connect(filter).connect(gain).connect(masterGain);
    osc.start(time); osc.stop(time + 0.3);
  },
  pad(time, step) {
    const note = PAD_NOTES[step % PAD_NOTES.length];
    [0, 3, 7].forEach(d => {
      const osc = audioCtx.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(note * Math.pow(2, d / 12), time);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.05, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
      osc.connect(gain).connect(masterGain);
      osc.start(time); osc.stop(time + 0.85);
    });
  },
  arp(time, step) {
    const note = ARP_NOTES[step % ARP_NOTES.length];
    const osc = audioCtx.createOscillator(); osc.type = 'square'; osc.frequency.setValueAtTime(note, time);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(4000, time);
    filter.frequency.exponentialRampToValueAtTime(500, time + 0.1); filter.Q.value = 6;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.1, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(filter).connect(gain).connect(masterGain);
    osc.start(time); osc.stop(time + 0.2);
  },
  sax(time, step) {
    const note = SAX_NOTES[step % SAX_NOTES.length];
    const osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; 
    osc.frequency.setValueAtTime(note, time);
    const lfo = audioCtx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5;
    const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 3;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(time); lfo.stop(time + 0.5);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.setValueAtTime(800, time); filter.Q.value = 2;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.2, time + 0.05);
    gain.gain.setValueAtTime(0.2, time + 0.3); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    osc.connect(filter).connect(gain).connect(masterGain);
    osc.start(time); osc.stop(time + 0.45);
  },
  brass(time, step) {
    const note = BRASS_NOTES[step % BRASS_NOTES.length];
    const osc1 = audioCtx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.setValueAtTime(note, time);
    const osc2 = audioCtx.createOscillator(); osc2.type = 'sawtooth'; osc2.frequency.setValueAtTime(note * 1.01, time);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(500, time);
    filter.frequency.linearRampToValueAtTime(3000, time + 0.05);
    filter.frequency.exponentialRampToValueAtTime(800, time + 0.3); filter.Q.value = 1;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.15, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    osc1.connect(filter); osc2.connect(filter);
    filter.connect(gain).connect(masterGain);
    osc1.start(time); osc1.stop(time + 0.4);
    osc2.start(time); osc2.stop(time + 0.4);
  },
  bell(time, step) {
    const note = BELL_NOTES[step % BELL_NOTES.length];
    const osc = audioCtx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(note, time);
    const osc2 = audioCtx.createOscillator(); osc2.type = 'sine'; osc2.frequency.setValueAtTime(note * 2.75, time);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.15, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
    osc.connect(gain); osc2.connect(gain);
    gain.connect(masterGain);
    osc.start(time); osc.stop(time + 0.65);
    osc2.start(time); osc2.stop(time + 0.65);
  },
  fx(time) {
    const osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, time); osc.frequency.exponentialRampToValueAtTime(100, time + 0.4);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.setValueAtTime(2000, time);
    filter.frequency.exponentialRampToValueAtTime(400, time + 0.3); filter.Q.value = 10;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.15, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    osc.connect(filter).connect(gain).connect(masterGain);
    osc.start(time); osc.stop(time + 0.45);
  }
};

// ---- Scheduler ----
const LOOK_AHEAD = 0.1;
const SCHEDULE_INTERVAL = 25;
let schedulerTimer = null;

function getStepDuration() { return 60 / state.bpm / 4; }

function scheduler() {
  if (!audioCtx || !state.playing) return;
  while (state.nextStepTime < audioCtx.currentTime + LOOK_AHEAD) {
    scheduleStep(state.currentStep, state.nextStepTime);
    state.nextStepTime += getStepDuration();
    state.currentStep = (state.currentStep + 1) % STEPS;
  }
}

function scheduleStep(step, time) {
  let playedNote = false;
  for (let track = 0; track < TRACKS.length; track++) {
    if (state.grid[track][step] && !state.muted[track]) {
      const synthFn = synths[TRACKS[track].synth];
      if (synthFn) synthFn(time, step);
      playedNote = true;
      const delay = Math.max(0, (time - audioCtx.currentTime) * 1000);
      setTimeout(() => triggerVisual(track, step), delay);
    }
  }

  const delay = Math.max(0, (time - audioCtx.currentTime) * 1000);
  setTimeout(() => {
    updatePlayhead(step);
    if (playedNote) {
       state.combo++;
       if (state.combo > game.maxCombo) game.maxCombo = state.combo;
       updateStats();
    } else if (game.combo > 0) resetCombo();
  }, delay);
}

function triggerVisual(track, step) {
  const cellIdx = track * STEPS + step;
  const cell = document.querySelectorAll('.cell')[cellIdx];
  if (cell) {
    cell.classList.remove('triggered');
    void cell.offsetWidth;
    cell.classList.add('triggered');
  }
  // Throttled particle spawn to reduce lag
  if (Math.random() < 0.3) spawnParticles(track, step);
}

// Cache positions to prevent DOM layout thrashing (which causes severe lag)
let cellPositions = null;
function updatePlayhead(step) {
  const playhead = document.getElementById('playhead');
  if (!playhead) return;
  if (!cellPositions) {
    cellPositions = [];
    const container = document.getElementById('grid-container');
    const cRect = container.getBoundingClientRect();
    for(let s=0; s<16; s++) {
      const cell = document.querySelector(`.cell[data-step="${s}"]`);
      if (cell) {
        const cellRect = cell.getBoundingClientRect();
        cellPositions[s] = { left: cellRect.left - cRect.left, width: cellRect.width };
      }
    }
  }
  const pos = cellPositions[step];
  if (pos) {
    playhead.style.transform = `translateX(${pos.left}px)`;
    playhead.style.width = pos.width + 'px';
  }
}

window.addEventListener('resize', () => { cellPositions = null; });

function toggleSequencer() {
  if (!audioCtx) initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  state.playing = !state.playing;
  if (state.playing) {
    state.nextStepTime = audioCtx.currentTime + 0.05;
    schedulerTimer = setInterval(scheduler, SCHEDULE_INTERVAL);
    document.getElementById('play-icon').style.display = 'none';
    document.getElementById('pause-icon').style.display = '';
    document.getElementById('play-btn').classList.add('active');
    if (!game.achievements.has('FIRST_PLAY')) {
      unlockAchievement('FIRST_PLAY', 'Drop The Beat', '🎵', 100);
    }
  } else {
    clearInterval(schedulerTimer);
    document.getElementById('play-icon').style.display = '';
    document.getElementById('pause-icon').style.display = 'none';
    document.getElementById('play-btn').classList.remove('active');
  }
}

// ---- UI Builder ----
const els = {
  grid: document.getElementById('grid'),
  playhead: document.getElementById('playhead'),
  playBtn: document.getElementById('play-btn'),
  playIcon: document.getElementById('play-icon'),
  pauseIcon: document.getElementById('pause-icon'),
  bpmDown: document.getElementById('bpm-down'),
  bpmUp: document.getElementById('bpm-up'),
  bpmVal: document.getElementById('bpm-val'),
  randomBtn: document.getElementById('random-btn'),
  clearBtn: document.getElementById('clear-btn'),
  labels: document.getElementById('labels'),
  stepNumbers: document.getElementById('step-numbers'),
  waveform: document.getElementById('waveform'),
  presetBtns: document.querySelectorAll('.preset-btn'),
  scoreVal: document.getElementById('score-val'),
  comboVal: document.getElementById('combo-val'),
  energyFill: document.getElementById('energy-fill'),
  energyLabel: document.getElementById('energy-label'),
  toastContainer: document.getElementById('toast-container'),
  scorePopups: document.getElementById('score-popups'),
  guideSwitch: document.getElementById('guide-switch'),
  assistant: document.getElementById('assistant'),
  assistantHint: document.getElementById('assistant-hint'),
  assistantReason: document.getElementById('assistant-reason')
};

function buildGrid() {
  const grid = document.getElementById('grid');
  const nums = document.getElementById('step-numbers');
  grid.innerHTML = ''; nums.innerHTML = '';
  
  grid.style.gridTemplateRows = `repeat(${TRACKS.length}, 1fr)`;

  for (let s = 0; s < STEPS; s++) {
    const num = document.createElement('div');
    num.className = 'step-num' + (s % 4 === 0 ? ' beat' : '');
    num.textContent = s + 1;
    nums.appendChild(num);
  }

  for (let track = 0; track < TRACKS.length; track++) {
    for (let step = 0; step < STEPS; step++) {
      const cell = document.createElement('div');
      cell.className = 'cell' + (step % 4 === 0 ? ' beat-start' : '');
      cell.dataset.track = track;
      cell.dataset.step = step;
      cell.style.setProperty('--track-color', TRACKS[track].color);
      if (state.grid[track][step]) cell.classList.add('active');
      grid.appendChild(cell);
    }
  }

  let painting = false, paintValue = true, lastCell = null;
  const onDown = (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    if (e.type === 'touchstart') e.preventDefault();
    painting = true;
    const t = +cell.dataset.track, s = +cell.dataset.step;
    paintValue = !state.grid[t][s];
    toggleCell(cell, t, s, paintValue);
    lastCell = cell;
    
    // Gamify painting
    const rect = cell.getBoundingClientRect();
    if (paintValue) addScore(25, rect.left + rect.width/2, rect.top, 'PAINTED');
    if (!game.achievements.has('CREATOR')) unlockAchievement('CREATOR', 'Making Moves', '🎨', 200);
  };
  const onMove = (e) => {
    if (!painting) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const el = document.elementFromPoint(clientX, clientY);
    const cell = el ? el.closest('.cell') : null;
    if (!cell || cell === lastCell) return;
    const t = +cell.dataset.track, s = +cell.dataset.step;
    toggleCell(cell, t, s, paintValue);
    lastCell = cell;
    
    if (paintValue) {
        const rect = cell.getBoundingClientRect();
        addScore(10, rect.left + rect.width/2, rect.top);
    }
  };
  const onUp = () => { painting = false; lastCell = null; };

  grid.addEventListener('mousedown', onDown);
  grid.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  grid.addEventListener('touchstart', onDown, { passive: false });
  grid.addEventListener('touchmove', onMove, { passive: false });
  window.touchend = onUp;
}

function toggleCell(cell, track, step, value) {
  state.grid[track][step] = value;
  cell.classList.toggle('active', value);
  if (value && audioCtx) {
    const synthFn = synths[TRACKS[track].synth];
    if (synthFn) synthFn(audioCtx.currentTime, step);
    spawnParticles(track, step);
  }
  addScore(value ? 10 : 5, 0, 0);
  addEnergy(value ? 2 : -1);
  GuidanceEngine.analyze(state.grid);
}

function renderGrid() {
    document.querySelectorAll('.cell').forEach(cell => {
        const t = +cell.dataset.track, s = +cell.dataset.step;
        cell.classList.toggle('active', state.grid[t][s]);
    });
}

function buildLabels() {
  const container = document.getElementById('labels');
  container.innerHTML = '';
  TRACKS.forEach((track, i) => {
    const label = document.createElement('div');
    label.className = 'track-label';
    label.style.setProperty('--track-clr', track.color);
    label.innerHTML = `
      <div class="track-icon">${track.icon}</div>
      <span class="track-name">${track.name}</span>
    `;
    label.addEventListener('click', () => {
      state.muted[i] = !state.muted[i];
      label.classList.toggle('muted', state.muted[i]);
    });
    container.appendChild(label);
  });
}

function randomizePattern() {
  for (let t = 0; t < TRACKS.length; t++) {
    for (let s = 0; s < STEPS; s++) {
      let prob = 0.1;
      if (t === 0 || t === 1) prob = 0.2;
      if (t === 3) prob = 0.4;
      state.grid[t][s] = Math.random() < prob;
    }
  }
  renderGrid();
  addScore(100, window.innerWidth/2, 50, 'RANDOMIZED!');
  GuidanceEngine.analyze(state.grid);
  if (!game.achievements.has('CHAOS')) unlockAchievement('CHAOS', 'Embrace Chaos', '🎲', 300);
}

function bindControls() {
  document.getElementById('play-btn').addEventListener('click', toggleSequencer);
  document.getElementById('bpm-up').addEventListener('click', () => {
    state.bpm = Math.min(200, state.bpm + 4);
    document.getElementById('bpm-val').textContent = state.bpm;
  });
  document.getElementById('bpm-down').addEventListener('click', () => {
    state.bpm = Math.max(60, state.bpm - 4);
    document.getElementById('bpm-val').textContent = state.bpm;
  });
  document.getElementById('clear-btn').addEventListener('click', () => {
    state.grid = Array(TRACKS.length).fill(null).map(() => Array(STEPS).fill(false));
    renderGrid();
    game.combo = 0;
    updateEnergyUI();
    GuidanceEngine.analyze(state.grid);
  });
  document.getElementById('random-btn').addEventListener('click', randomizePattern);

  els.presetBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = +btn.dataset.preset;
      state.presets[state.currentPreset] = state.grid.map(r => [...r]);
      state.currentPreset = idx;
      if (state.presets[idx]) state.grid = state.presets[idx].map(r => [...r]);
      els.presetBtns.forEach(b => b.classList.toggle('active', b === e.target));
      renderGrid();
      GuidanceEngine.analyze(state.grid);
    });
  });

  if (els.guideSwitch) {
    els.guideSwitch.addEventListener('change', (e) => {
      els.assistant.classList.toggle('hidden', !e.target.checked);
      if (e.target.checked) GuidanceEngine.analyze(state.grid);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); toggleSequencer(); }
  });
}

// ---- FX / Particles ----
const fxCanvas = document.getElementById('fx');
const fxCtx = fxCanvas.getContext('2d');
const particles = [];

function resizeFX() {
  const dpr = window.devicePixelRatio || 1;
  fxCanvas.width = window.innerWidth * dpr;
  fxCanvas.height = window.innerHeight * dpr;
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeFX();
window.addEventListener('resize', resizeFX);

function spawnParticles(track, step) {
  const cell = document.querySelectorAll('.cell')[track * STEPS + step];
  if (!cell) return;
  const rect = cell.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const count = 5 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1, decay: 0.02 + Math.random() * 0.03,
      size: 2 + Math.random() * 3,
      color: TRACKS[track].color
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.95; p.vy *= 0.95;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (const p of particles) {
    fxCtx.globalAlpha = p.life;
    fxCtx.fillStyle = p.color;
    fxCtx.shadowColor = p.color; fxCtx.shadowBlur = 10;
    fxCtx.beginPath();
    fxCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    fxCtx.fill();
  }
  fxCtx.globalAlpha = 1; fxCtx.shadowBlur = 0;
}

// ---- Waveform ----
const waveCanvas = document.getElementById('waveform');
let waveCtx = null;

function drawWaveform() {
  if (!waveCtx) waveCtx = waveCanvas.getContext('2d');
  if (!analyser) return;

  const w = waveCanvas.clientWidth, h = waveCanvas.clientHeight;
  if (waveCanvas.width !== w * 2) {
    waveCanvas.width = w * 2; waveCanvas.height = h * 2;
    waveCtx.setTransform(2, 0, 0, 2, 0, 0);
  }

  analyser.getByteFrequencyData(analyserData);
  waveCtx.clearRect(0, 0, w, h);

  const barWidth = w / analyserData.length;
  waveCtx.fillStyle = 'rgba(255,255,255,0.8)';

  for (let i = 0; i < analyserData.length; i++) {
    const val = analyserData[i] / 255;
    const barHeight = val * h;
    waveCtx.globalAlpha = 0.2 + val * 0.8;
    waveCtx.fillRect(i * barWidth, h - barHeight, Math.max(1, barWidth - 0.5), barHeight);
  }
  waveCtx.globalAlpha = 1;
}

function render() {
  updateParticles();
  drawParticles();
  drawWaveform();
  
  drainEnergy();
  
  requestAnimationFrame(render);
}

// ---- Init ----
function init() {
  // Preset 0
  state.presets[0] = [
    [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], // KICK
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], // SNARE
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1], // CLAP
    [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], // HAT
    [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0], // BASS
    [0,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0], // LEAD
    [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], // PAD
    [0,0,1,0, 0,0,0,0, 0,1,0,0, 0,0,0,0], // SYNTH
    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], // SAX
    [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], // BRASS
    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], // BELL
    [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0], // FX
  ].map(r => r.map(v => v === 1));
  state.grid = state.presets[0].map(r => [...r]);

  buildGrid();
  buildLabels();
  bindControls();
  render();

  const startInteraction = () => {
    if (!audioCtx) initAudio();
    document.removeEventListener('click', startInteraction);
    document.removeEventListener('touchstart', startInteraction);
  };
  document.addEventListener('click', startInteraction);
  document.addEventListener('touchstart', startInteraction);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
