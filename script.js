// ====================
// SoundManager — Web Audio API
// 現代感的音效設計，不刺耳
// ====================
const SoundManager = {
  ctx: null,
  masterGain: null,
  inited: false,

  init() {
    if (this.inited) return;
    try {
      // 延遲創建 AudioContext，避免 Chrome autoplay policy 警告
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.35;
      this.masterGain.connect(this.ctx.destination);
      this.inited = true;
    } catch(e) {
      console.warn('SoundManager: AudioContext not available');
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  // 解鎖 audio：第一次使用者互動時呼叫，繞過 autoplay policy
  unlockAudio() {
    // 延遲創建 AudioContext，避免 Chrome autoplay policy 警告
    if (!this.inited) {
      this.init();
    }
    this.resume();
    // Pre-fetch + decode MP3 到 AudioBuffer，供後續 playFanfare 使用
    if (!this._fanfareBuffer && !this._fanfareLoading && this.ctx) {
      this._fanfareLoading = true;
      fetch('fanfare.mp3')
        .then(r => r.arrayBuffer())
        .then(buf => this.ctx.decodeAudioData(buf))
        .then(audioBuf => {
          this._fanfareBuffer = audioBuf;
          this._fanfareLoading = false;
        })
        .catch(() => {
          this._fanfareLoading = false;
        });
    }
  },

  _lastPlaybackPath: null,  // TDD: tracks which path was used ('mp3' | '8bit')

  // 工具：建立過濾器 + gain 節點鏈
  _chain(filterOpts, gainVal) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterOpts.type || 'lowpass';
    filter.frequency.value = filterOpts.freq || 1000;
    filter.Q.value = filterOpts.Q || 1;
    const gain = this.ctx.createGain();
    gain.gain.value = gainVal ?? 0.3;
    filter.connect(gain);
    gain.connect(this.masterGain);
    return { filter, gain };
  },

  // 工具：播放 oscillator + noise 混合
  _playOsc(type, freq, duration, filterOpts, vol) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    const { filter, gain } = this._chain(filterOpts, vol);
    osc.connect(filter);
    gain.gain.setValueAtTime(vol ?? 0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
    return { osc, gain, filter };
  },

  // 工具：白噪音 burst
  _playNoise(duration, filterOpts, vol) {
    const bufLen = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const { filter, gain } = this._chain(filterOpts, vol);
    src.connect(filter);
    gain.gain.setValueAtTime(vol ?? 0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    src.start(this.ctx.currentTime);
    src.stop(this.ctx.currentTime + duration);
    return { src, gain, filter };
  },

  sounds: {
    // === koi可愛光波 — 溫和射擊音效 ===
    shoot() {
      const ctx = SoundManager.ctx;
      if (!ctx) return;
      // 三角波為主，溫暖不刺耳
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.06);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900;
      filter.Q.value = 2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(SoundManager.masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);

      // 加一點點高頻 sparkle（sine 泛音）
      const sparkle = ctx.createOscillator();
      sparkle.type = 'sine';
      sparkle.frequency.setValueAtTime(1800, ctx.currentTime);
      sparkle.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.04);

      const sparkGain = ctx.createGain();
      sparkGain.gain.setValueAtTime(0.08, ctx.currentTime);
      sparkGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      sparkle.connect(sparkGain);
      sparkGain.connect(SoundManager.masterGain);
      sparkle.start(ctx.currentTime);
      sparkle.stop(ctx.currentTime + 0.1);
    },

    // === 敵人爆炸 — 低頻碰聲 ===
    explosion() {
      const ctx = SoundManager.ctx;
      if (!ctx) return;
      // 低頻 thud
      SoundManager._playOsc('sine', 150, 0.2, { type: 'lowpass', freq: 400, Q: 1 }, 0.3);
      // 噪音 burst
      SoundManager._playNoise(0.15, { type: 'lowpass', freq: 800, Q: 1 }, 0.2);
    },

    // === 玩家受傷 — 較沉的下降音 ===
    playerHit() {
      const ctx = SoundManager.ctx;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(350, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.35);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      filter.Q.value = 1.5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(SoundManager.masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);

      // 加噪音
      SoundManager._playNoise(0.3, { type: 'lowpass', freq: 300, Q: 1 }, 0.15);
    },

    // === Game Over — 緩慢下降 ===
    gameOver() {
      const ctx = SoundManager.ctx;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 1.5);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 1.5);
      filter.Q.value = 2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(SoundManager.masterGain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 2);
    },

    // === 波次完成 — 上升音階 ===
    waveComplete() {
      const ctx = SoundManager.ctx;
      if (!ctx) return;
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        const gain = ctx.createGain();
        const t = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.28, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq * 1.5;
        filter.Q.value = 3;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(SoundManager.masterGain);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    },

    // === 幽浮飛行音效 — 經典顫音 ===
    ufo() {
      const ctx = SoundManager.ctx;
      if (!ctx) return;
      const now = ctx.currentTime;
      // Warbling oscillator: frequency oscillates between two tones
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.15);
      osc.frequency.linearRampToValueAtTime(200, now + 0.3);
      osc.frequency.linearRampToValueAtTime(600, now + 0.45);
      osc.frequency.linearRampToValueAtTime(200, now + 0.6);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc.connect(gain);
      gain.connect(SoundManager.masterGain);
      osc.start(now);
      osc.stop(now + 0.75);
    }
  },

  // === 8-bit 開場旋律（fallback）===
  fanfare() {
    const ctx = SoundManager.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const bpm = 100;
    const beat = 60 / bpm; // 0.6s per beat
    const vol = 0.18;

    // 旋律序列：[頻率(Hz), 開始拍, 持續拍]
    const melody = [
      // Bar 1: 英雄式開場
      [523.25, 0, 1.0],     // C5 (quarter +)
      [0, 1.0, 0.5],         // 休止
      [783.99, 1.5, 0.5],    // G5 (eighth)
      [1046.5, 2.0, 2.0],    // C6 (half, 拉長)
      // Bar 2: 回穩
      [987.77, 4, 1.0],      // B5
      [1046.5, 5, 1.0],      // C6
      [783.99, 6, 2.0],      // G5
      // Bar 3: 轉折
      [880.00, 8, 1.0],      // A5
      [783.99, 9, 1.0],      // G5
      [698.46, 10, 2.0],     // F5
      // Bar 4: 回家 + 尾音
      [659.25, 12, 1.0],     // E5
      [523.25, 13, 1.0],     // C5
      [523.25, 14, 3.0],     // C5 (長音結尾)
    ];

    melody.forEach(([freq, startBeat, durBeat]) => {
      if (freq === 0) return; // rest
      const startTime = t + startBeat * beat;
      const duration = durBeat * beat;

      // Lead: 方波，經典 8-bit 聲
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      // 簡單的 envelope
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.02); // 快速 attack
      gain.gain.setValueAtTime(vol, startTime + duration * 0.8); // sustain
      gain.gain.linearRampToValueAtTime(0, startTime + duration); // release

      // 輕微低通濾波，讓方波不那麼刺
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3000;
      filter.Q.value = 0.5;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(SoundManager.masterGain);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    });

    // Bass: 簡單的根音襯底
    const bassNotes = [
      [130.81, 0, 4],   // C3
      [130.81, 4, 4],   // C3
      [174.61, 8, 4],   // F3
      [130.81, 12, 4],  // C3
    ];
    bassNotes.forEach(([freq, startBeat, durBeat]) => {
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq, t + startBeat * beat);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(vol * 0.4, t + startBeat * beat);
      g2.gain.linearRampToValueAtTime(0, t + (startBeat + durBeat) * beat);
      osc2.connect(g2);
      g2.connect(SoundManager.masterGain);
      osc2.start(t + startBeat * beat);
      osc2.stop(t + (startBeat + durBeat) * beat + 0.05);
    });
  },

  // 播開場音樂：優先 MP3（Web Audio decode），fallback 8-bit
  playFanfare() {
    this.init();
    this.resume();
    const ctx = this.ctx;
    if (!ctx) { this._lastPlaybackPath = '8bit'; this.fanfare(); return; }

    // 路徑 1：MP3 AudioBuffer（Safari 相容，走 Web Audio API）
    if (this._fanfareBuffer) {
      this._lastPlaybackPath = 'mp3';
      const src = ctx.createBufferSource();
      src.buffer = this._fanfareBuffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      src.connect(gain);
      gain.connect(this.masterGain || ctx.destination);
      src.start(0);
      return;
    }

    // 路徑 2：還在 loading → 等 300ms 再試
    if (this._fanfareLoading) {
      this._lastPlaybackPath = 'mp3'; // optimistic
      const check = () => {
        if (this._fanfareBuffer) {
          const src = ctx.createBufferSource();
          src.buffer = this._fanfareBuffer;
          const gain = ctx.createGain();
          gain.gain.value = 0.5;
          src.connect(gain);
          gain.connect(this.masterGain || ctx.destination);
          src.start(0);
        } else {
          this._lastPlaybackPath = '8bit';
          this.fanfare();
        }
      };
      setTimeout(check, 232);
      return;
    }

    // 路徑 3：fetch/decode 失敗 → 8-bit fallback
    this._lastPlaybackPath = '8bit';
    this.fanfare();
  },

  play(name) {
    this.init();
    this.resume();
    if (this.ctx && this.sounds[name]) {
      // 若 context 剛 resume 還 suspended，等 resume 完成再播
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
        setTimeout(() => this.sounds[name](), 50);
      } else {
        this.sounds[name]();
      }
    }
  }
};

// ====================
// Phaser Game Logic
// ====================
const config = {
  type: Phaser.WEBGL,
  width: 600,
  height: 450,
  parent: 'game-container',
  backgroundColor: '#000000',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const game = new Phaser.Game(config);

let player;
let cursors;
let bullets;
let invaders;
let explosions;
let starfield;
let score = 0;
let wave = 1;
let scoreText;
let gameOver = false;
let lastShot = 0;
// 每波的基礎速度（只讀）；實際難度由 createWave 依 waveNum 遞增。
const INVADER_BASE_SPEED = 80;
let enemyBullets;
let lastEnemyShot = 0;
let gameOverText;
let finalScoreText;
let restartText;
let goOverlayRef;

// === 生命系統 ===
let lives = 3;
let livesIcons = [];
let playerDead = false;
let invulnerable = false;
let invulTimer = 0;
let deadUntil = 0;
let gameReady = false;

// === CRT Effect System ===
let crtMode = 'shader'; // 'off' | 'shader' | 'camera'
let crtPipeline = null;
let cameraPostRender = null;

function toggleCRT() {
  // CRT is always on by default, toggle disabled
  return;
}

function enableShaderCRT(scene) {
  disableCRT(scene);
  // WebGL pipeline disabled - causing rendering issues
  // if (window.CRTPipeline && scene.renderer.pipelines) {
  //   crtPipeline = scene.renderer.pipelines.add('CRT', new CRTPipeline(scene.game));
  //   scene.cameras.main.setRenderToTexture(crtPipeline);
  // }
}

function enableCameraCRT(scene) {
  disableCRT(scene);
  cameraPostRender = function(camera) {
    const ctx = camera.context;
    const width = camera.width;
    const height = camera.height;
    
    ctx.save();
    
    // Scanlines - stronger effect
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    for (let y = 0; y < height; y += 2) {
      ctx.fillRect(0, y, width, 1);
    }
    
    // RGB phosphor separation simulation
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#f00';
    for (let y = 0; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1);
    }
    ctx.fillStyle = '#00f';
    for (let y = 1; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1);
    }
    
    // Vignette - stronger
    const gradient = ctx.createRadialGradient(width/2, height/2, width*0.2, width/2, height/2, width*0.9);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 0, width, height);
    
    // Screen curvature simulation (darken edges)
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, 30);
    ctx.fillRect(0, height-30, width, 30);
    ctx.fillRect(0, 0, 30, height);
    ctx.fillRect(width-30, 0, 30, height);
    
    // Corner rounding effect
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width, 0, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, height, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width, height, 40, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  };
  scene.cameras.main.on('postrender', cameraPostRender);
}

function disableCRT(scene) {
  if (crtPipeline) {
    if (scene.cameras.main.clearRenderToTexture) {
      scene.cameras.main.clearRenderToTexture();
    } else if (scene.cameras.main.setRenderToTexture) {
      scene.cameras.main.setRenderToTexture();
    }
    crtPipeline = null;
  }
  if (cameraPostRender) {
    scene.cameras.main.off('postrender', cameraPostRender);
    cameraPostRender = null;
  }
}

let toastTimeout = null;

function showCRTFeedback(scene) {
  const modeText = crtMode === 'off' ? 'CRT: OFF' : crtMode === 'shader' ? 'CRT: SHADER' : 'CRT: CAMERA';
  const modeClass = crtMode === 'off' ? 'crt-off' : crtMode === 'shader' ? 'crt-shader' : 'crt-camera';
  
  const toast = document.getElementById('crt-toast');
  if (!toast) return;
  
  // Clear any pending hide
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  
  // Update content and style
  toast.textContent = modeText;
  toast.className = 'toast ' + modeClass;
  
  // Show with animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Hide after 1.5s
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 1500);
}

// === 觸控 / 螢幕控制狀態（由 setupTouchControls 維護） ===
const touchState = { left: false, right: false, fire: false };

// === HIGH SCORE (localStorage) ===
let highScore = parseInt(localStorage.getItem('spaceInvadersHighScore') || '0', 10);

// === 片頭動畫 ===
let gamePhase = 'intro'; // 'intro' | 'countdown' | 'playing' | 'gameover'
let introStartTime = 0;
let introIdleStart = 0; // intro idle timer → auto-transition to demo
let introAliens = [];
let introTexts = {};
let crawlLines = [];
let countdownStart = 0;
let countdownTexts = {};

// === Demo / 排行榜 ===
let gameOverIdleStart = 0;
let demoTexts = {};
const LEADERBOARD_KEY = 'spaceInvadersLeaderboard';
const LEADERBOARD_SIZE = 10;

// === UFO / Mystery Ship ===
let ufo = null;
let ufoActive = false;
let ufoNextSpawn = 0;
let ufoPhase = 'normal';
let ufoPhaseStart = 0;

function getLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveScoreToLeaderboard(finalScore) {
  if (!finalScore || finalScore <= 0) return;
  const board = getLeaderboard();
  board.push(finalScore);
  board.sort((a, b) => b - a);
  const top10 = board.slice(0, LEADERBOARD_SIZE);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(top10));
}

function preload() {
  // 讓瀏覽器正常快取貼圖；之前每次載入都加 ?t=Date.now() 會強制重抓。
  this.load.image('spaceship', 'spaceship.png');
  this.load.image('invader', 'invader1.png');
}

function create() {
  // 用程式生成子彈貼圖（綠色的長條）
  const bulletGfx = this.textures.createCanvas('bullet', 4, 10);
  const ctx = bulletGfx.getContext();
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(0, 0, 4, 10);
  bulletGfx.refresh();

  // 用程式生成敵人子彈（紅色的長條）
  const eBulletGfx = this.textures.createCanvas('ebullet', 4, 8);
  const ectx = eBulletGfx.getContext();
  ectx.fillStyle = '#ff4444';
  ectx.fillRect(0, 0, 4, 8);
  eBulletGfx.refresh();

  // 用程式生成星空背景（600x450 tileSprite）
  const starCanvas = this.textures.createCanvas('starfield', 600, 450);
  const sctx = starCanvas.getContext();
  for (let i = 0; i < 250; i++) {
    const sx = Math.random() * 600;
    const sy = Math.random() * 450;
    const bright = Math.floor(Math.random() * 160 + 95);
    const size = Math.random() > 0.92 ? 2 : 1;
    sctx.fillStyle = `rgb(${bright},${bright},${bright})`;
    sctx.fillRect(sx, sy, size, size);
  }
  starCanvas.refresh();

  // 星空層放在最底下（在 player 和 invaders 之前加入）
  starfield = this.add.tileSprite(0, 0, 600, 450, 'starfield').setOrigin(0, 0).setDepth(-1);

  // 用程式生成爆炸 spritesheet（8 幀，更流暢）
  const expFrames = 8;
  const expSize = 64;
  const expSheet = this.textures.createCanvas('explode_sheet', expSize * expFrames, expSize);
  const exCtx = expSheet.getContext();
  for (let f = 0; f < expFrames; f++) {
    const cx = f * expSize + expSize / 2;
    const cy = expSize / 2;
    const p = f / (expFrames - 1); // 0～1
    const r = 4 + p * 28;
    const alpha = 1 - p * 0.85;
    const red = 255;
    const grn = Math.floor(255 * (1 - p * 0.8));
    const blu = Math.floor(200 * (1 - p));
    // 外圍光暈
    exCtx.save();
    exCtx.beginPath();
    exCtx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
    exCtx.fillStyle = `rgba(${red},${Math.floor(grn * 0.4)},0,${alpha * 0.25})`;
    exCtx.fill();
    // 主體
    exCtx.beginPath();
    exCtx.arc(cx, cy, r, 0, Math.PI * 2);
    exCtx.fillStyle = `rgba(${red},${grn},${blu},${alpha})`;
    exCtx.fill();
    exCtx.restore();
  }
  expSheet.refresh();

  // 爆炸動畫註冊移到 create() 統一管理
  // 為 canvas spritesheet 註冊各 frame 的座標
  const expTex = this.textures.get('explode_sheet');
  for (let f = 0; f < expFrames; f++) {
    expTex.add(f, 0, f * expSize, 0, expSize, expSize);
  }

  this.anims.create({
    key: 'explode_pro',
    frames: this.anims.generateFrameNumbers('explode_sheet', { start: 0, end: 7 }),
    frameRate: 18,
    hideOnComplete: true
  });

  // ========== Star Wars Opening Crawl ==========
  gamePhase = 'intro';
  introStartTime = this.time.now;
  introIdleStart = this.time.now;

  // === UFO Texture (米白 + 淡橘，復古飛碟 + 陰影 + 裝飾線 + 橢圓形) ===
  const ufoGfx = this.textures.createCanvas('ufo', 52, 22);
  const uctx = ufoGfx.getContext();

  // Subtle blurred shadow on edges (aged/retro feel, avoid clean look)
  uctx.shadowColor = 'rgba(0,0,0,0.45)';
  uctx.shadowBlur = 5;
  uctx.shadowOffsetX = 2;
  uctx.shadowOffsetY = 2;

  // Main saucer body - slightly elliptical, aged off-white (米白)
  uctx.fillStyle = '#EDE4D3';
  uctx.beginPath();
  uctx.ellipse(26, 13, 23, 8, 0, 0, Math.PI * 2);
  uctx.fill();

  // Clear shadow for inner details to avoid muddy look
  uctx.shadowBlur = 0;
  uctx.shadowOffsetX = 0;
  uctx.shadowOffsetY = 0;

  // Top dome - soft orange (淡橘)
  uctx.fillStyle = '#F5C48A';
  uctx.beginPath();
  uctx.ellipse(26, 9, 14, 6, 0, 0, Math.PI * 2);
  uctx.fill();

  // Two very thin decorative lines on top (retro accent)
  uctx.strokeStyle = '#C9A87A';
  uctx.lineWidth = 1;
  uctx.beginPath();
  uctx.moveTo(14, 5);
  uctx.lineTo(38, 5);
  uctx.stroke();
  uctx.beginPath();
  uctx.moveTo(16, 7);
  uctx.lineTo(36, 7);
  uctx.stroke();

  // Subtle panel lines / windows for retro detail (faded)
  uctx.fillStyle = '#D4C4A8';
  uctx.fillRect(15, 11, 5, 3);
  uctx.fillRect(23, 11, 6, 3);
  uctx.fillRect(32, 11, 5, 3);

  ufoGfx.refresh();

  // Phase 1: Blue intro text
  introTexts.blueText = this.add.text(300, 225,
    'A long time ago in a galaxy\nfar, far away....', {
    fontFamily: 'monospace',
    fontSize: '22px',
    color: '#4a9eff',
    align: 'center',
    fontStyle: 'italic'
  }).setOrigin(0.5).setAlpha(0).setDepth(200);

  // Phase 2: Big yellow logo
  introTexts.logo = this.add.text(300, 210, 'SPACE\nINVADERS', {
    fontFamily: 'monospace',
    fontSize: '56px',
    color: '#ffd700',
    align: 'center',
    fontStyle: 'bold'
  }).setOrigin(0.5).setVisible(false).setDepth(200);

  // Phase 3: Crawl text (will be populated in runIntro)
  crawlLines = [];
}

function startPlaying() {
  // Player - 強制設定合理尺寸
  player = this.physics.add.sprite(300, 410, 'spaceship');
  player.setDisplaySize(48, 24);
  player.setCollideWorldBounds(true);

  cursors = this.input.keyboard.createCursorKeys();

  // 真正的物件池
  bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 12 });
  enemyBullets = this.physics.add.group({ defaultKey: 'ebullet', maxSize: 20 });
  invaders = this.physics.add.group();
  explosions = this.add.group();

  // UI 文字
  scoreText = this.add.text(16, 16, buildScoreText(), {
    fontFamily: 'monospace', fontSize: '22px', color: '#00ff00'
  }).setDepth(100);

  gameOverText = this.add.text(300, 170, 'GAME OVER', {
    fontFamily: 'monospace', fontSize: '80px', color: '#ff0000', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(100).setVisible(false);

  finalScoreText = this.add.text(300, 248, '', {
    fontFamily: 'monospace', fontSize: '30px', color: '#ffdd00'
  }).setOrigin(0.5).setDepth(100).setVisible(false);

  restartText = this.add.text(300, 310, 'PRESS SPACE TO RESTART', {
    fontFamily: 'monospace', fontSize: '28px', color: '#ffff00'
  }).setOrigin(0.5).setDepth(100).setVisible(false);

  createWave.call(this, 1);
  this.physics.add.overlap(bullets, invaders, hitInvader, null, this);
  this._playerHitCollider = this.physics.add.overlap(enemyBullets, player, hitPlayer, null, this);

  drawLives.call(this);
  gameReady = true;
  gamePhase = 'playing';

  // Enable CRT shader by default
  // Disabled - causing rendering issues with Phaser 3.55.2
  // if (crtMode === 'shader' && window.CRTPipeline && this.renderer.pipelines) {
  //   enableShaderCRT(this);
  // }

  // Initialize UFO spawn timer
  ufoNextSpawn = this.time.now + getUFOSpawnInterval();
}

// === UFO / Mystery Ship ===
function getUFOSpawnInterval() {
  // Random interval between 15-30 seconds
  return 15000 + Math.floor(Math.random() * 15000);
}

function spawnUFO(scene) {
  if (ufo) { ufo.destroy(); ufo = null; }
  // Random direction: left-to-right or right-to-left
  const fromLeft = Math.random() > 0.5;
  const startX = fromLeft ? -50 : 850;
  const dir = fromLeft ? 1 : -1;
  ufo = scene.physics.add.sprite(startX, 50, 'ufo');
  ufo.setVelocityX(120 * dir);
  ufo.setDepth(50);
  ufoActive = true;
  // UFO flying sound
  SoundManager.play('ufo');
}

function hitUFO(bullet, ufoSprite) {
  if (gameOver) return;
  bullet.disableBody(true, true);
  let bonus;
  if (ufoPhase === 'green') {
    // GREEN phase: higher bonus (150 or 200)
    bonus = Phaser.Math.RND.pick([150, 200]);
  } else if (ufoPhase === 'red') {
    // RED phase: medium bonus (100 or 150)
    bonus = Phaser.Math.RND.pick([100, 150]);
  } else {
    // normal phase: standard bonus
    bonus = Phaser.Math.RND.pick([50, 100, 150, 200]);
  }
  score += bonus;
  updateScoreText();
  // Explosion effect
  const scene = game.scene.scenes[0];
  const exp = explosions.create(ufoSprite.x, ufoSprite.y, 'explode_sheet', 0);
  exp.setDisplaySize(56, 40);
  exp.play('explode_pro');
  exp.once('animationcomplete', () => exp.destroy());
  SoundManager.play('explosion');
  ufoSprite.destroy();
  ufo = null;
  ufoActive = false;
  // Schedule next UFO spawn
  ufoNextSpawn = scene.time.now + getUFOSpawnInterval();
}

function checkUFOBounds() {
  if (!ufo || !ufoActive) return;
  if (ufo.x > 850 || ufo.x < -50) {
    ufo.destroy();
    ufo = null;
    ufoActive = false;
    // Schedule next UFO spawn
    const scene = game.scene.scenes[0];
    ufoNextSpawn = scene.time.now + getUFOSpawnInterval();
  }
}

function createWave(waveNum) {
  try {
  invaders.clear(true, true);
  // createWave 負責清掉上一波殘留的敵人子彈。用 disableBody 回收（而非 clear 銷毀），
  // 保留物件池成員，避免每波在邊界重新配置 sprite。
  enemyBullets.getChildren().forEach(b => {
    if (b && b.body) b.disableBody(true, true);
  });

  const rows = Math.min(4 + Math.floor(waveNum / 3), 6);
  const cols = 8;
  const spacingX = 68;
  const startX = 110;

  // 整個敵陣統一方向移動（經典 Space Invaders 行為）
  const formationDir = (waveNum % 2 === 0) ? 1 : -1;
  const formationSpeed = INVADER_BASE_SPEED + (waveNum - 1) * 18;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const inv = invaders.create(startX + col * spacingX, 90 + row * 55, 'invader');
      inv.setDisplaySize(42, 24);
      inv.setVelocityX(formationSpeed * formationDir);
      // 記錄每隻敵人的原始 row，用來做階梯式掉落
      inv.setData('row', row);
    }
  }
} catch(e) { console.warn('createWave err:',e); }
}

function shoot() {
  try {
  if (gameOver || playerDead) return;
  const now = this.time.now;
  if (now - lastShot < 180) return;

  // 從池中取得（沒有閒置子彈且已達上限時回傳 null）。
  const bullet = bullets.get(player.x, player.y - 10, 'bullet');
  if (!bullet) return;
  bullet.enableBody(true, player.x, player.y - 10, true, true);
  bullet.setSize(4, 10);
  bullet.setDisplaySize(4, 10);
  bullet.setVelocityY(-450);
  SoundManager.play('shoot');
  lastShot = now;
} catch(e) { console.warn('shoot err:',e); }
}

function hitInvader(bullet, invader) {
  // game over 後 overlap 仍可能被觸發（尤其子彈被 freezeField 凍在敵人身上時會每幀重複），
  // 守衛避免結束後還能計分 / 觸發爆炸 / 進下一波。
  if (gameOver) return;
  bullet.disableBody(true, true); // 回收子彈到池中
  invader.destroy();

  score += 100;
  updateScoreText();

  const exp = explosions.create(invader.x, invader.y, 'explode_sheet', 0);
  exp.setDisplaySize(56, 40);
  exp.play('explode_pro');
  // 動畫播完即銷毀，避免隱藏的爆炸 sprite 無限累積（hideOnComplete 只隱藏不釋放）。
  exp.once('animationcomplete', () => exp.destroy());
  SoundManager.play('explosion');

  if (invaders.countActive(true) === 0) {
    wave++;
    updateScoreText();
    SoundManager.play('waveComplete');
    this.time.delayedCall(700, () => {
      // 守衛：若期間發生 game over 或 restart，就不要再生成新波
      if (gameOver || !gameReady) return;
      createWave.call(this, wave);
    });
  }
}

function buildScoreText() {
  return `WAVE ${wave}   SCORE: ${score.toString().padStart(5, '0')}   HI: ${highScore.toString().padStart(5, '0')}`;
}

function updateScoreText() {
  scoreText.setText(buildScoreText());
}

// 重建片頭（從 demo 回來時用）
function rebuildIntro() {
  const scene = game.scene.scenes[0];
  crawlLines.forEach(t => { if (t && t.destroy) t.destroy(); });
  crawlLines = [];
  Object.values(introTexts).forEach(t => { if (t && t.destroy) t.destroy(); });
  introTexts = {};

  introTexts.blueText = scene.add.text(310, 300,
    'A long time ago in a galaxy\nfar, far away....', {
    fontFamily: 'monospace', fontSize: '22px', color: '#4a9eff',
    align: 'center', fontStyle: 'italic'
  }).setOrigin(0.5).setAlpha(0).setDepth(200);

  introTexts.logo = scene.add.text(310, 280, 'SPACE\nINVADERS', {
    fontFamily: 'monospace', fontSize: '56px', color: '#ffd700',
    align: 'center', fontStyle: 'bold'
  }).setOrigin(0.5).setVisible(false).setDepth(200);
}

// 跳過片頭（按鍵或觸控觸發）
function skipIntro() {
  if (gamePhase !== 'intro') return;
  crawlLines.forEach(t => { if (t && t.destroy) t.destroy(); });
  crawlLines = [];
  Object.values(introTexts).forEach(tx => { if (tx && tx.destroy) tx.destroy(); });
  introTexts = {};
  const scene = game.scene.scenes[0];

  // 進入倒數階段
  gamePhase = 'countdown';
  countdownStart = scene.time.now;
  countdownTexts.ready = scene.add.text(300, 194, 'READY?', {
    fontFamily: 'monospace', fontSize: '52px', color: '#ffff00', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(300).setAlpha(0);
  countdownTexts.go = scene.add.text(300, 194, 'GO!', {
    fontFamily: 'monospace', fontSize: '64px', color: '#00ff00', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(300).setVisible(false);
}

// Star Wars Opening Crawl 動畫
function runIntro(scene) {
  const elapsed = scene.time.now - introStartTime;
  const t = elapsed / 1000; // 秒數

  // 星空加速
  if (starfield) starfield.tilePositionY -= 1.5;

  // === Phase 1 (0-3s): Blue intro text fades in/out ===
  if (t < 3.0) {
    // Fade in over 1s, hold 1s, fade out last 1s
    if (t < 1.0) {
      introTexts.blueText.setAlpha(Math.min(1, t / 1.0));
    } else if (t < 2.0) {
      introTexts.blueText.setAlpha(1);
    } else {
      introTexts.blueText.setAlpha(Math.max(0, 1 - (t - 2.0) / 1.0));
    }
  }

  // === Phase 2 (3-6s): Logo fades in/out ===
  else if (t < 6.0) {
    const pt = t - 3.0; // phase time
    if (!introTexts.logo.visible && pt > 0) {
      introTexts.logo.setVisible(true);
      introTexts.blueText.setVisible(false);
    }
    if (pt < 1.0) {
      introTexts.logo.setAlpha(Math.min(1, pt / 1.0));
      // Scale from 0.5 to 1
      introTexts.logo.setScale(0.5 + 0.5 * (pt / 1.0));
    } else if (pt < 2.0) {
      introTexts.logo.setAlpha(1);
    } else {
      introTexts.logo.setAlpha(Math.max(0, 1 - (pt - 2.0) / 1.0));
    }
  }

  // === Phase 3 (6-14s): Crawl text scrolls upward ===
  else {
    // Build crawl lines on first frame
    if (crawlLines.length === 0) {
      introTexts.logo.setVisible(false);
      SoundManager.playFanfare(); // 開場音樂（MP3 or 8-bit fallback）
      const crawlText = [
        'EPISODE IV',
        '',
        'A NEW HOPE',
        '',
        'It is a period of civil war.',
        'Rebel spaceships, striking',
        'from a hidden base, have won',
        'their first victory against',
        'the evil Galactic Empire.',
        '',
        'During the battle, Rebel',
        'spies managed to steal',
        'secret plans to the Empire\'s',
        'ultimate weapon, the DEATH',
        'STAR, an armored space',
        'station with enough power',
        'to destroy an entire planet.',
        '',
        'Pursued by the Empire\'s',
        'sinister agents, Princess',
        'Leia races home aboard her',
        'starship, custodian of the',
        'stolen plans that can save',
        'her people and restore',
        'freedom to the galaxy....'
      ];
      crawlText.forEach((line, i) => {
        const y = 700 + i * 32;
        const txt = scene.add.text(310, y, line, {
          fontFamily: '"Pathway Gothic One", "Arial Narrow", sans-serif',
          fontSize: '16px',
          color: '#ffd700',
          align: 'center',
          fontStyle: line.startsWith('EPISODE') || line === 'A NEW HOPE' ? 'bold' : 'italic'
        }).setOrigin(0.5).setDepth(200);
        crawlLines.push(txt);
      });
    }

    const pt = t - 6.0;
    const crawlSpeed = 80; // pixels per second (slower, more dramatic)
    const crawlDuration = 14; // seconds (slower speed needs more time)

    crawlLines.forEach((txt, i) => {
      const baseY = 700 + i * 32;
      const newY = baseY - pt * crawlSpeed;
      txt.y = newY;

      // Perspective effect: scale based on y position
      const viewCenter = 300;
      const distFromCenter = newY - viewCenter;
      const perspective = 1 - Math.abs(distFromCenter) / 500;
      const scale = Math.max(0.3, Math.min(1.0, perspective));
      txt.setScale(scale);

      // Fade at edges
      const alpha = Math.max(0.1, Math.min(1, perspective + 0.2));
      txt.setAlpha(alpha);

      // Clean up lines that have scrolled off screen
      if (newY < -50) {
        txt.setVisible(false);
      }
    });

    // Loop back after crawl finishes
    if (pt >= crawlDuration) {
      crawlLines.forEach(t => t.destroy());
      crawlLines = [];
      introTexts.blueText.setAlpha(0).setVisible(true);
      introTexts.logo.setVisible(false).setScale(1).setAlpha(1);
      introStartTime = scene.time.now;
    }
  }
}

// 倒數階段：READY? → GO!
function runCountdown(scene) {
  const elapsed = scene.time.now - countdownStart;
  const t = elapsed / 1000;

  // 星空繼續滾
  if (starfield) starfield.tilePositionY -= 0.3;

  if (t < 1.2) {
    // READY? 淡入
    countdownTexts.ready.setAlpha(Math.min(1, t / 0.3));
  } else if (t < 2.0) {
    // GO! 出現
    if (!countdownTexts.go.visible) {
      countdownTexts.go.setVisible(true);
      countdownTexts.go.setScale(0.3);
      scene.tweens.add({
        targets: countdownTexts.go,
        scaleX: 1, scaleY: 1,
        duration: 150, ease: 'Back.easeOut'
      });
    }
    countdownTexts.ready.setAlpha(Math.max(0, 1 - (t - 1.2) / 0.3));
  } else {
    // 清理倒數，開始遊戲
    Object.values(countdownTexts).forEach(tx => tx.destroy());
    countdownTexts = {};
    startPlaying.call(scene);
  }
}

// Demo 模式：顯示排行榜
function enterDemo() {
  gamePhase = 'demo';
  // 清除所有現有 UI 文字
  [gameOverText, finalScoreText, restartText, scoreText].forEach(t => { if (t) t.setVisible(false); });
  // 清除可能殘留的 intro / countdown 文字
  Object.values(introTexts).forEach(t => { if (t && t.destroy) t.destroy(); });
  Object.values(countdownTexts).forEach(t => { if (t && t.destroy) t.destroy(); });
  crawlLines.forEach(t => { if (t && t.destroy) t.destroy(); });
  crawlLines = []; introTexts = {}; countdownTexts = {};

  // 保險：清掉 scene 裡所有殘留文字（避免 crawlLines 被清空後文字變孤兒）
  const scene = game.scene.scenes[0];
  scene.children.list.filter(c => c.type === 'Text').forEach(t => {
    if (t && t.destroy) t.destroy();
  });
  const board = getLeaderboard();

  // 標題
  demoTexts.title = scene.add.text(300, 93, '╔══════════════╗\n║  HIGH SCORES  ║\n╚══════════════╝', {
    fontFamily: 'monospace', fontSize: '22px', color: '#ffd700', fontStyle: 'bold', align: 'center'
  }).setOrigin(0.5).setDepth(300).setAlpha(0);

  // 排行榜條目
  demoTexts.entries = [];
  const top5 = board.slice(0, 5);
  if (top5.length === 0) {
    demoTexts.entries.push(
      scene.add.text(300, 202, 'NO SCORES YET', {
        fontFamily: 'monospace', fontSize: '22px', color: '#888888'
      }).setOrigin(0.5).setDepth(300)
    );
  } else {
    top5.forEach((s, i) => {
      const rank = (i + 1).toString();
      const medals = ['🥇', '🥈', '🥉', '  ', '  '];
      const y = 190 + i * 50;
      const txt = scene.add.text(310, y,
        `${medals[i]}  ${rank}st${rank==='1'?'':rank==='2'?'nd':rank==='3'?'rd':'th'}  ·  ${s.toString().padStart(6, '0')}`,
        { fontFamily: 'monospace', fontSize: '24px', color: i === 0 ? '#ffff00' : '#cccccc' }
      ).setOrigin(0.5).setDepth(300);
      demoTexts.entries.push(txt);
    });
  }

  // 提示文字
  demoTexts.hint = scene.add.text(300, 388, 'PRESS ANY KEY TO START', {
    fontFamily: 'monospace', fontSize: '18px', color: '#888888'
  }).setOrigin(0.5).setDepth(300);

  // 小外星人（Rei 指定：1.5x 放大 + 左右飄）
  demoTexts.alien = scene.add.sprite(300, 326, 'invader').setDepth(300).setScale(1.5);
  demoTexts.alienDir = 1;
}

function runDemo(scene) {
  // 星空慢速滾動
  if (starfield) starfield.tilePositionY -= 0.2;

  // 標題淡入
  const elapsed = scene.time.now - gameOverIdleStart - 20000;
  if (demoTexts.title && demoTexts.title.alpha < 1) {
    demoTexts.title.setAlpha(Math.min(1, demoTexts.title.alpha + 0.02));
  }
  // 提示文字閃爍
  if (demoTexts.hint) {
    demoTexts.hint.setAlpha(0.4 + Math.sin(elapsed * 0.005) * 0.3);
  }
  // 小外星人左右飄移
  if (demoTexts.alien) {
    demoTexts.alien.x += demoTexts.alienDir * 0.6;
    if (demoTexts.alien.x > 460) demoTexts.alienDir = -1;
    if (demoTexts.alien.x < 340) demoTexts.alienDir = 1;
  }
}

function update() {
  // 片頭動畫
  if (gamePhase === 'intro') {
    runIntro(this);
    // 15 秒無操作 → 自動進 demo（Rei 說 30 秒太久，誰會盯螢幕 30 秒啦 😒）
    if (this.time.now - introIdleStart > 15000) {
      enterDemo.call(this);
    }
    return;
  }

  // Demo 模式
  if (gamePhase === 'demo') {
    runDemo(this);
    return;
  }

  // 倒數階段
  if (gamePhase === 'countdown') {
    runCountdown(this);
    return;
  }

  // 星空持續滾動（即使 gameOver 也動）
  if (starfield) starfield.tilePositionY -= 0.4;

  try {
  // Game Over idle → demo 轉場
  if (gameOver && gamePhase === 'playing') {
    if (this.time.now - gameOverIdleStart > 20000) {
      enterDemo.call(this);
    }
    return;
  }

  if (gameOver || !player || (!playerDead && !player.body) || !gameReady) return;

  // 死亡時不能操控
  if (playerDead) {
    if (player && player.body) {
      player.setVelocityX(0);
    }
    // 計時重生（用 scene 時鐘：分頁切到背景時 Phaser 會暫停，計時不會錯亂）
    if (this.time.now >= deadUntil) {
      if (!player || !player.body) {
        // 重建 player sprite（如果壞了）
        player = this.physics.add.sprite(310, 550, 'spaceship');
        player.setDisplaySize(48, 24);
        player.setCollideWorldBounds(true);
        // 重新註冊 overlap（player 被重建了）
        this.physics.world.removeCollider(this._playerHitCollider);
        this._playerHitCollider = this.physics.add.overlap(enemyBullets, player, hitPlayer, null, this);
      }
      player.setPosition(300, 410);
      player.setVisible(true);
      player.body.enable = true;
      playerDead = false;
      invulnerable = true;
      invulTimer = 0;
    }
    // 還在死亡期間，不做 bounce/移動
    return;
  }

  if (!playerDead) {
    // 無敵閃爍
    if (invulnerable && player) {
      invulTimer += this.game.loop.delta;
      player.setAlpha(Math.sin(invulTimer * 0.015) > 0 ? 1 : 0.2);
      if (invulTimer > 2500) {
        invulnerable = false;
        if (player) player.setAlpha(1);
      }
    }

    // 鍵盤方向鍵或螢幕搖桿皆可控制
    const moveLeft = cursors.left.isDown || touchState.left;
    const moveRight = cursors.right.isDown || touchState.right;
    if (player && player.body) {
      const maxSpeed = 350;
      const acceleration = 2000; // pixels per second squared
      const friction = 1500; // pixels per second squared
      const dt = this.game.loop.delta / 1000; // delta time in seconds

      let targetVelocity = 0;
      if (moveLeft) targetVelocity = -maxSpeed;
      else if (moveRight) targetVelocity = maxSpeed;

      const currentVelocity = player.body.velocity.x;
      let newVelocity;

      if (targetVelocity !== 0) {
        // Accelerating towards target
        const direction = Math.sign(targetVelocity);
        newVelocity = currentVelocity + direction * acceleration * dt;
        // Clamp to max speed
        if (direction > 0) newVelocity = Math.min(newVelocity, maxSpeed);
        else newVelocity = Math.max(newVelocity, -maxSpeed);
      } else {
        // Decelerating to stop
        if (currentVelocity > 0) {
          newVelocity = Math.max(0, currentVelocity - friction * dt);
        } else if (currentVelocity < 0) {
          newVelocity = Math.min(0, currentVelocity + friction * dt);
        } else {
          newVelocity = 0;
        }
      }

      player.setVelocityX(newVelocity);
    }

    // 按住空白鍵或螢幕火力鍵連發（shoot 內含 180ms 冷卻）
    if ((cursors.space && cursors.space.isDown) || touchState.fire) {
      shoot.call(this);
    }
  }

  // === 敵人邊界反彈（只在 playing 時做） ===
  if (gameOver) return;

  // 先用「快照」純讀取掃描，不在迭代中修改 group（createWave 會 clear/recreate
  // 同一個 group，若在 forEach 進行中呼叫會破壞陣列、導致狀態錯亂）。
  let bounce = false;
  let side = 'none';
  let reachedBottom = false;
  const invaderSnapshot = invaders.getChildren().slice();
  for (const inv of invaderSnapshot) {
    if (!inv || !inv.active || !inv.body) continue;
    // 只有「正朝牆壁移動」時才反彈，否則卡在邊界的敵人會每幀重複反彈，
    // 造成連續多次掉落 + 速度暴衝。
    if (inv.x < 40 && inv.body.velocity.x < 0) { bounce = true; side = 'left'; }
    if (inv.x > 760 && inv.body.velocity.x > 0) { bounce = true; side = 'right'; }
    if (inv.y > 530) { reachedBottom = true; break; }
  }

  // 敵人到底 → 扣一條命。所有會修改 group 的動作都在迭代之外執行。
  if (reachedBottom && !gameOver && !playerDead) {
    lives--;
    drawLives.call(this);
    if (lives <= 0) {
      gameOver = true;
      gameOverIdleStart = this.time.now;
      // === SAVE SCORES ===
      saveHighScore();
      saveScoreToLeaderboard(score);
      freezeField(); // 停下所有敵人 / 子彈，避免在 GAME OVER 畫面繼續飄移
      scoreText.setVisible(false);
      gameOverText.setText('GAME OVER');
      finalScoreText.setText(`HIGH SCORE: ${highScore.toString().padStart(5, '0')}`);
      gameOverText.setVisible(true);
      finalScoreText.setVisible(true);
      restartText.setVisible(true);
    } else {
      // 重生並重置關卡（用 scene 時鐘計時，背景分頁時會一起暫停）
      playerDead = true;
      deadUntil = this.time.now + 1200;
      if (player) { player.setVisible(false); if (player.body) player.body.enable = false; }
      // createWave 會清空 enemyBullets，這裡不需另外回收
      createWave.call(this, wave);
    }
    return; // 本幀處理完畢，避免對剛重建的 group 再做反彈處理
  }

  if (bounce) {
    invaders.getChildren().slice().forEach(inv => {
      if (inv && inv.active && inv.body) {
        // 反彈後速度稍微加快（越打越快，但幅度小一點）
        const currentSpeed = Math.abs(inv.body.velocity.x);
        const newSpeed = Math.min(currentSpeed + 2, 170);
        const dir = side === 'left' ? 1 : -1;
        inv.setVelocityX(newSpeed * dir);
        // 階梯式掉落：後排掉得少，前排掉得多
        const row = inv.getData('row') || 0;
        const dropAmount = 6 + row * 1.5;
        inv.y += dropAmount;
      }
    });
  }

  // Player子彈超出畫面回收到池中（用快照，避免邊迭代邊修改 group 陣列）
  bullets.getChildren().slice().forEach(b => {
    if (b && b.active && b.y < 0) b.disableBody(true, true);
  });

  // 敵人射擊
  const activeInvaders = invaders.getChildren().filter(inv => inv.active);
  if (activeInvaders.length > 0) {
    const now = this.time.now;
    // 間隔隨波數遞減（越來越快）
    const fireInterval = Math.max(600, 2000 - wave * 150);
    if (now - lastEnemyShot > fireInterval) {
      // 從最下排的敵人隨機挑一個射擊
      // 找出 Y 值最大的幾隻（最接近玩家）
      activeInvaders.sort((a, b) => b.y - a.y);
      const shooters = activeInvaders.slice(0, Math.min(3, activeInvaders.length));
      const shooter = Phaser.Math.RND.pick(shooters);

      const eb = enemyBullets.get(shooter.x, shooter.y + 12, 'ebullet');
      if (eb) {
        eb.enableBody(true, shooter.x, shooter.y + 12, true, true);
        eb.setSize(4, 8);
        eb.setDisplaySize(4, 8);
        const speed = 180 + wave * 15;
        // player 可能在死亡/重建期間為 null 或 body 失效 → 此時直線下墜，
        // 不要把 null 傳進 moveToObject（會丟例外、被 update 的 catch 吞掉）。
        if (player && player.body && player.active) {
          this.physics.moveToObject(eb, player, speed);
        } else {
          eb.setVelocityY(speed);
        }
      }
      lastEnemyShot = now;
    }
  }

  // 敵人子彈超出畫面回收到池中（用快照，避免邊迭代邊修改 group 陣列）
  enemyBullets.getChildren().slice().forEach(b => {
    if (b && b.active && b.y > 600) b.disableBody(true, true);
  });

  // === UFO / Mystery Ship ===
  if (gameReady && !gameOver && !playerDead) {
    // Spawn UFO on timer
    if (!ufoActive && this.time.now >= ufoNextSpawn) {
      spawnUFO(this);
    }
    // Check UFO bounds (destroy if off-screen) and bullet collision
    if (ufoActive && ufo) {
      checkUFOBounds();
      if (ufoActive && ufo) {
        this.physics.overlap(bullets, ufo, hitUFO, null, this);
      }
      // Slight wobble/sway instead of perfectly straight horizontal flight (retro feel)
      if (ufo && ufoActive) {
        const sway = Math.sin(this.time.now * 0.004) * 2.8;
        ufo.y = 50 + sway;
      }
      // === UFO Phase System (Rei's Design — RED/GREEN) ===
      if (ufo && ufoActive) {
        const phaseElapsed = this.time.now - ufoPhaseStart;
        // Phase 1: RED (aggressive, fast, shoots) — 4-8 seconds
        if (phaseElapsed > 4000 && phaseElapsed <= 8000 && ufoPhase !== 'red') {
          ufoPhase = 'red';
          ufo.setTint(0xFF4444);
          // Speed up 1.5x (keep direction)
          const currentSpeed = Math.abs(ufo.body.velocity.x);
          const dir = ufo.body.velocity.x >= 0 ? 1 : -1;
          ufo.setVelocityX(currentSpeed * 1.5 * dir);
        }
        // Phase 2: GREEN (slow, high bonus) — after 8 seconds
        else if (phaseElapsed > 8000 && ufoPhase !== 'green') {
          ufoPhase = 'green';
          ufo.setTint(0x44FF44);
          // Slow down to 0.7x (keep direction)
          const currentSpeed = Math.abs(ufo.body.velocity.x);
          const dir = ufo.body.velocity.x >= 0 ? 1 : -1;
          ufo.setVelocityX(currentSpeed * 0.7 * dir);
        }
        // RED phase: occasional downward shot (20% chance per 500ms check)
        if (ufoPhase === 'red' && phaseElapsed % 500 < 20) {
          if (Math.random() < 0.2) {
            const eb = enemyBullets.get(ufo.x, ufo.y + 10, 'ebullet');
            if (eb) {
              eb.enableBody(true, ufo.x, ufo.y + 10, true, true);
              eb.setVelocityY(200 + wave * 10);
            }
          }
        }
      }
    }
  }
} catch(e) { console.warn('update err:', e); }  // 讓 update 內的錯誤可見，方便除錯
}

function hitPlayer(enemyBullet, playerSprite) {
  try {
  if (invulnerable || gameOver || playerDead) return;
  enemyBullet.disableBody(true, true); // 回收敵人子彈到池中
  lives--;
  drawLives.call(this);

  // 爆炸動畫
  const exp = explosions.create(playerSprite.x, playerSprite.y, 'explode_sheet', 0);
  exp.setDisplaySize(64, 48);
  exp.play('explode_pro');
  exp.once('animationcomplete', () => exp.destroy());
  SoundManager.play('playerHit');

  if (lives <= 0) {
    // 完全死亡 → Game Over
    gameOver = true;
    gameOverIdleStart = this.time.now;
    SoundManager.play('gameOver');
    // === SAVE SCORES ===
    saveHighScore();
    saveScoreToLeaderboard(score);
    freezeField(); // 停下所有敵人 / 子彈，避免在 GAME OVER 畫面繼續飄移
    scoreText.setVisible(false);
    gameOverText.setText('GAME OVER');
    finalScoreText.setText(`HIGH SCORE: ${highScore.toString().padStart(5, '0')}`);
    gameOverText.setVisible(true);
    finalScoreText.setVisible(true);
    restartText.setVisible(true);
    playerSprite.setVisible(false);
    // 清掉生命圖示
    livesIcons.forEach(icon => icon.destroy());
    livesIcons = [];
  } else {
    // 還有命 → 重生（用 scene 時鐘計時，背景分頁時會一起暫停）
    playerDead = true;
    deadUntil = this.time.now + 1200;
    playerSprite.setVisible(false);
    playerSprite.body.enable = false;
    // 剩下的敵人子彈自然飛出畫面 cleanup，不在物理回呼內 destroy
  }
} catch(e) { console.warn('hitPlayer err:',e); }
}

// 停下場上所有敵人與子彈（GAME OVER 時呼叫，避免畫面繼續飄移）
function freezeField() {
  [invaders, enemyBullets, bullets].forEach(grp => {
    if (!grp) return;
    grp.getChildren().forEach(o => {
      if (o && o.active && o.body) o.setVelocity(0, 0);
    });
  });
  // 玩家船在「敵人到底」結束時仍可見，若還有殘留速度會繼續滑出畫面
  if (player && player.body) player.setVelocity(0, 0);
  // UFO 也要停下
  if (ufo && ufo.body) ufo.setVelocity(0, 0);
}

// === HIGH SCORE: save to localStorage if current score is higher ===
function saveHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('spaceInvadersHighScore', highScore.toString());
  }
}

// 繪製生命圖示（右上角小戰機）
function drawLives() {
  // 清除舊的
  livesIcons.forEach(icon => icon.destroy());
  livesIcons = [];
  for (let i = 0; i < lives; i++) {
    const icon = this.add.sprite(780 - i * 38, 24, 'spaceship');
    icon.setDisplaySize(24, 12);
    icon.setAlpha(0.8);
    livesIcons.push(icon);
  }
}

function restartGame() {
  // Reset 所有遊戲狀態
  gameOver = false;
  gameReady = false;
  gamePhase = 'playing';
  gameOverIdleStart = 0;
  score = 0;
  wave = 1;
  lives = 3;
  playerDead = false;
  invulnerable = false;
  invulTimer = 0;
  deadUntil = 0;
  lastShot = 0;
  lastEnemyShot = 0;

  // 清除所有 group
  invaders.clear(true, true);
  bullets.clear(true, true);
  enemyBullets.clear(true, true);
  explosions.clear(true, true);
  livesIcons.forEach(icon => icon.destroy());
  livesIcons = [];

  const scene = game.scene.scenes[0];

  // 清除所有待觸發的計時器（例如 hitInvader 排程的 createWave delayedCall），
  // 否則重開後它們仍會 fire，把舊狀態套到新局上。
  scene.time.removeAllEvents();

  // 清除舊的 overlap 並重建 player
  if (scene._playerHitCollider) {
    scene.physics.world.removeCollider(scene._playerHitCollider);
  }
  if (player) player.destroy();
  player = scene.physics.add.sprite(310, 550, 'spaceship');
  player.setDisplaySize(48, 24);
  player.setCollideWorldBounds(true);
  scene._playerHitCollider = scene.physics.add.overlap(enemyBullets, player, hitPlayer, null, scene);

  // Reset UI
  scoreText.setText(buildScoreText());
  scoreText.setVisible(true);
  gameOverText.setVisible(false);
  finalScoreText.setText('').setVisible(false);
  restartText.setVisible(false);

  // 重開 wave
  createWave.call(scene, 1);
  drawLives.call(scene);
  gameReady = true;

  // Reset UFO
  if (ufo) { ufo.destroy(); ufo = null; }
  ufoActive = false;
  ufoNextSpawn = scene.time.now + getUFOSpawnInterval();
}

// 第一次點擊/觸碰就解鎖 audio（繞過 autoplay policy）+ reset intro idle
['click', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, () => {
    SoundManager.unlockAudio();
    if (gamePhase === 'intro') introIdleStart = game.scene.scenes[0].time.now;
  }, { once: true });
});

window.addEventListener('keydown', e => {
  SoundManager.unlockAudio();

  // Demo 期間按任意鍵 → 回 intro
  if (gamePhase === 'demo') {
    Object.values(demoTexts).forEach(t => {
      if (Array.isArray(t)) t.forEach(x => { if (x && x.destroy) x.destroy(); });
      else if (t && t.destroy) t.destroy();
    });
    demoTexts = {};
    gamePhase = 'intro';
    introStartTime = game.scene.scenes[0].time.now;
    introIdleStart = game.scene.scenes[0].time.now;
    // 重建 intro
    rebuildIntro();
    return;
  }

  // 片頭期間：任意鍵重置 idle timer
  if (gamePhase === 'intro') {
    introIdleStart = game.scene.scenes[0].time.now;
  }
  // 片頭期間按空白鍵開始遊戲
  if (gamePhase === 'intro' && (e.key === ' ' || e.code === 'Space' || e.keyCode === 32)) {
    e.preventDefault();
    skipIntro();
    return;
  }

  // 按 C 鍵切換 CRT 效果
  if (e.key === 'c' || e.key === 'C' || e.code === 'KeyC') {
    toggleCRT();
    return;
  }

  // Game over 期間按空白鍵重設 idle timer + 重來
  if (gameOver && e.key === ' ') {
    gameOverIdleStart = 0;
    restartGame();
  }
}, { capture: true });

// ====================
// 螢幕 / 觸控控制：把機台上的搖桿與 FIRE 鈕接上遊戲
// ====================
function setupTouchControls() {
  const fireBtn = document.querySelector('.arcade-btn.fire');
  const coinBtn = document.querySelector('.arcade-btn.coin');
  const joyBase = document.querySelector('.joystick-base');
  const joyStick = document.querySelector('.joystick-stick');

  const unlockAudio = () => { SoundManager.unlockAudio(); };

  if (fireBtn) {
    const press = e => {
      e.preventDefault();
      unlockAudio();
      if (gamePhase === 'intro') skipIntro();
      else if (gameOver) restartGame(); // GAME OVER 時 FIRE 也能重開
      else touchState.fire = true;
    };
    const release = e => { e.preventDefault(); touchState.fire = false; };
    fireBtn.addEventListener('pointerdown', press);
    fireBtn.addEventListener('pointerup', release);
    fireBtn.addEventListener('pointerleave', release);
    fireBtn.addEventListener('pointercancel', release);
  }

  if (coinBtn) {
    coinBtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      unlockAudio();
      if (gamePhase === 'intro') skipIntro();
      else if (gameOver) restartGame();
    });
  }

  if (joyBase) {
    let activeId = null;
    const setDir = clientX => {
      const rect = joyBase.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const dx = clientX - cx;
      const dead = rect.width * 0.18; // 中央死區
      touchState.left = dx < -dead;
      touchState.right = dx > dead;
      if (joyStick) {
        const off = Math.max(-12, Math.min(12, dx));
        joyStick.style.transform = `translate(calc(-50% + ${off}px), -65%)`;
      }
    };
    const start = e => {
      activeId = e.pointerId;
      unlockAudio();
      if (joyBase.setPointerCapture) { try { joyBase.setPointerCapture(e.pointerId); } catch (_) {} }
      setDir(e.clientX);
      e.preventDefault();
    };
    const move = e => { if (activeId === e.pointerId) setDir(e.clientX); };
    const end = e => {
      if (activeId !== e.pointerId) return;
      activeId = null;
      touchState.left = false;
      touchState.right = false;
      if (joyStick) joyStick.style.transform = 'translate(-50%, -65%)';
    };
    joyBase.addEventListener('pointerdown', start);
    joyBase.addEventListener('pointermove', move);
    joyBase.addEventListener('pointerup', end);
    joyBase.addEventListener('pointercancel', end);
    // 指標捕捉中途遺失（多點觸控 / 系統對話框 / 拖出畫面）時 pointerup 可能不觸發，
    // 補這個事件避免搖桿卡在某個方向。
    joyBase.addEventListener('lostpointercapture', end);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupTouchControls);
} else {
  setupTouchControls();
}
