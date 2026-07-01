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
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
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
    this.init();
    this.resume();
    // Pre-fetch + decode MP3 到 AudioBuffer，供後續 playFanfare 使用
    if (!this._fanfareBuffer && !this._fanfareLoading) {
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
      setTimeout(check, 300);
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
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#000000',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  input: {
    gamepad: true // 啟用原生 Gamepad API 支援（實體搖桿 / 手把）
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
// 隊形重整（re-form）：第 2 波之後、殘兵低於 60% 時有機率重整，每波最多兩次
let waveInitialCount = 0;
let waveReformCount = 0;
let lastReformTime = 0;
// 核彈：飛得慢、爆炸範圍大、可一次消滅多個敵人；最多 3 發、每 5 波補滿、Enter 發射
let nukes;
let nukeAmmo = 3;
let lastNukeReloadWave = 0;
let enterKey;
const NUKE_MAX = 3;
const NUKE_SPEED = -220;        // 比一般子彈 (-450) 慢
const NUKE_BLAST_RADIUS = 110;  // 爆炸半徑（像素）
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
let crtMode = 'shader'; // 'off' | 'shader'
let crtFilter = null;   // Phaser 4 Filter controller (CRTFilter)

function toggleCRT() {
  // CRT is always on by default, toggle disabled
  return;
}

function enableShaderCRT(scene) {
  disableCRT(scene);
  // Phaser 4: attach the CRT GLSL shader as a camera Filter (see crt-pipeline.js).
  if (typeof installCRTFilter === 'function') {
    crtFilter = installCRTFilter(scene, scene.cameras.main);
  }
}

function disableCRT(scene) {
  if (crtFilter) {
    // destroy() detaches the controller from the camera's filter list.
    if (typeof crtFilter.destroy === 'function') {
      crtFilter.destroy();
    }
    crtFilter = null;
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
let gamePhase = 'koi-presents'; // 'koi-presents' | 'intro' | 'countdown' | 'playing' | 'gameover'
// === Koi play presents 製作商動畫 ===
let koiSprite = null;
let koiText = null;
let koiPresentsStart = 0;
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
  const top10 = GameLogic.leaderboardInsert(getLeaderboard(), finalScore, LEADERBOARD_SIZE);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(top10));
}

function preload() {
  // 讓瀏覽器正常快取貼圖；之前每次載入都加 ?t=Date.now() 會強制重抓。
  // 玩家飛船改為程式生成（見 createShipTexture），不再依賴 spaceship.png。
  this.load.image('invader', 'invader1.png');
  // Koi play presents 製作商動畫：4x4 sprite sheet（512x512，每幀 128x128）。
  this.load.spritesheet('koi', 'assets/koi-sprite.png', { frameWidth: 128, frameHeight: 128 });
}

// 程式生成玩家飛船貼圖：經典雙砲戰機（綠色機身 + 青色座艙 + 霓虹翼尖）。
// 48x24 像素藝術，對稱繪製，機頭朝上。
function createShipTexture(scene) {
  const W = 48, H = 24, CX = W / 2;
  if (scene.textures.exists('spaceship')) scene.textures.remove('spaceship');
  const tex = scene.textures.createCanvas('spaceship', W, H);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;

  const HULL = '#2ecc40';      // 主機身綠
  const HULL_DK = '#15772a';   // 暗綠（陰影/輪廓）
  const HULL_LT = '#7dff9e';   // 亮綠（高光）
  const COCKPIT = '#29e7ff';   // 青色座艙
  const COCKPIT_LT = '#bff6ff';// 座艙高光
  const NEON = '#39ff14';      // 霓虹翼尖
  const FLAME = '#ffd23f';     // 推進器火焰（黃）
  const FLAME_HOT = '#ff7b29'; // 推進器火焰（橘）

  // 以中心線對稱填一組多邊形（傳入點即自動鏡像）
  const poly = (pts, color) => {
    const draw = (xs) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(xs[0][0], xs[0][1]);
      for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i][0], xs[i][1]);
      ctx.closePath();
      ctx.fill();
    };
    draw(pts);
    draw(pts.map(([x, y]) => [W - x, y])); // 鏡像
  };
  const rect = (x, y, w, h, color, mirror = true) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    if (mirror) ctx.fillRect(W - x - w, y, w, h);
  };

  // 雙砲管（先畫，讓機身蓋住底部）
  rect(13, 5, 3, 13, HULL_DK);
  rect(14, 4, 1, 13, HULL);
  rect(14, 3, 1, 2, NEON);            // 砲口霓虹

  // 機翼（後掠）
  poly([[20, 12], [2, 19], [13, 20], [21, 16]], HULL);
  poly([[20, 16], [4, 20], [13, 21]], HULL_DK); // 機翼下緣陰影
  rect(2, 17, 4, 2, NEON);            // 翼尖霓虹

  // 機身（機頭三角 + 機體）
  poly([[CX, 1], [20, 8], [20, 21], [24, 22]], HULL);
  rect(19, 8, 10, 13, HULL);          // 機體主體
  poly([[CX, 1], [21, 7], [24, 7]], HULL_LT); // 機頭高光

  // 中央高光帶
  rect(23, 3, 2, 18, HULL_LT, false);

  // 座艙
  ctx.fillStyle = COCKPIT;
  ctx.beginPath();
  ctx.ellipse(CX, 11, 3.2, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  rect(22, 8, 1, 2, COCKPIT_LT);      // 座艙高光

  // 推進器火焰（機尾）
  rect(19, 21, 3, 3, FLAME);
  rect(20, 22, 1, 2, FLAME_HOT);

  tex.refresh();
}

function create() {
  createShipTexture(this);
  // 用程式生成子彈貼圖（綠色的長條）
  const bulletGfx = this.textures.createCanvas('bullet', 4, 10);
  const ctx = bulletGfx.getContext();
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(0, 0, 4, 10);
  bulletGfx.refresh();

  // 核彈貼圖：發光橘黃彈體 + 紅色核心（比一般子彈大很多）
  const nukeGfx = this.textures.createCanvas('nuke', 20, 26);
  const nctx = nukeGfx.getContext();
  nctx.fillStyle = 'rgba(255,180,0,0.35)';                 // 外發光
  nctx.beginPath(); nctx.ellipse(10, 13, 9, 12, 0, 0, Math.PI * 2); nctx.fill();
  nctx.fillStyle = '#ffcc00';                              // 彈體
  nctx.beginPath(); nctx.ellipse(10, 13, 6, 9, 0, 0, Math.PI * 2); nctx.fill();
  nctx.fillStyle = '#ff3b00';                              // 核心
  nctx.beginPath(); nctx.arc(10, 13, 3.2, 0, Math.PI * 2); nctx.fill();
  nctx.fillStyle = '#fff6c0';                              // 高光
  nctx.fillRect(7, 5, 2, 3);
  nukeGfx.refresh();

  // 用程式生成敵人子彈（紅色的長條）
  const eBulletGfx = this.textures.createCanvas('ebullet', 4, 8);
  const ectx = eBulletGfx.getContext();
  ectx.fillStyle = '#ff4444';
  ectx.fillRect(0, 0, 4, 8);
  eBulletGfx.refresh();

  // 用程式生成星空背景（800x600 tileSprite）
  const starCanvas = this.textures.createCanvas('starfield', 800, 600);
  const sctx = starCanvas.getContext();
  for (let i = 0; i < 250; i++) {
    const sx = Math.random() * 800;
    const sy = Math.random() * 600;
    const bright = Math.floor(Math.random() * 160 + 95);
    const size = Math.random() > 0.92 ? 2 : 1;
    sctx.fillStyle = `rgb(${bright},${bright},${bright})`;
    sctx.fillRect(sx, sy, size, size);
  }
  starCanvas.refresh();

  // 星空層放在最底下（在 player 和 invaders 之前加入）
  starfield = this.add.tileSprite(0, 0, 800, 600, 'starfield').setOrigin(0, 0).setDepth(-1);

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

  // ========== Koi play presents 製作商動畫（在片頭 crawl 之前） ==========
  // 扭捏害羞 idle 動畫（正面幀），9 fps 循環
  this.anims.create({
    key: 'koi-idle',
    frames: this.anims.generateFrameNumbers('koi', { frames: [0, 1, 2, 3, 4, 5, 6, 8, 9] }),
    frameRate: 9,
    repeat: -1
  });

  // 角色：置中偏左（約 35%），放大到約 180px，機頭朝上
  koiSprite = this.add.sprite(280, 300, 'koi', 0)
    .setDisplaySize(180, 180)
    .setDepth(250)
    .setAlpha(0);
  koiSprite.play('koi-idle');

  // 文字：角色右手邊，打字機效果（內容在 runKoiPresents 逐字顯示）
  koiText = this.add.text(372, 300, '', {
    fontFamily: 'monospace',
    fontSize: '28px',
    color: '#ffdd00'
  }).setOrigin(0, 0.5).setDepth(250).setAlpha(0);

  // 純黑背景：暫時隱藏星空，動畫結束進 intro 時再開啟
  if (starfield) starfield.setVisible(false);

  gamePhase = 'koi-presents';
  koiPresentsStart = this.time.now;
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
  introTexts.blueText = this.add.text(400, 300,
    'A long time ago in a galaxy\nfar, far away....', {
    fontFamily: 'monospace',
    fontSize: '22px',
    color: '#4a9eff',
    align: 'center',
    fontStyle: 'italic'
  }).setOrigin(0.5).setAlpha(0).setDepth(200);

  // Phase 2: Big yellow logo
  introTexts.logo = this.add.text(400, 280, 'SPACE\nINVADERS', {
    fontFamily: 'monospace',
    fontSize: '56px',
    color: '#ffd700',
    align: 'center',
    fontStyle: 'bold'
  }).setOrigin(0.5).setVisible(false).setDepth(200);

  // Phase 3: Crawl text (will be populated in runIntro)
  crawlLines = [];

  // Enable the CRT shader for the whole experience (menu, intro and gameplay).
  if (crtMode === 'shader') {
    enableShaderCRT(this);
  }
}

function startPlaying() {
  // Player - 強制設定合理尺寸
  player = this.physics.add.sprite(400, 550, 'spaceship');
  player.setDisplaySize(48, 24);
  player.setCollideWorldBounds(true);

  cursors = this.input.keyboard.createCursorKeys();
  enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

  // 原生手把（Gamepad API）：離散按鍵（開始 / 重來 / 核彈 / 退出 demo）走事件；
  // 移動與連續射擊在 update() 內輪詢類比搖桿，見下方。
  if (this.input.gamepad) {
    this.input.gamepad.on('down', handleGamepadDown, this);
    this.input.gamepad.on('connected', () => SoundManager.unlockAudio());
  }

  // 真正的物件池
  bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 12 });
  enemyBullets = this.physics.add.group({ defaultKey: 'ebullet', maxSize: 20 });
  nukes = this.physics.add.group({ defaultKey: 'nuke', maxSize: 4 });
  invaders = this.physics.add.group();
  explosions = this.add.group();

  // 核彈彈藥（每局重置）
  nukeAmmo = NUKE_MAX;
  lastNukeReloadWave = 0;

  // UI 文字
  scoreText = this.add.text(16, 16, buildScoreText(), {
    fontFamily: 'monospace', fontSize: '22px', color: '#00ff00'
  }).setDepth(100);

  gameOverText = this.add.text(400, 220, 'GAME OVER', {
    fontFamily: 'monospace', fontSize: '80px', color: '#ff0000', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(100).setVisible(false);

  finalScoreText = this.add.text(400, 320, '', {
    fontFamily: 'monospace', fontSize: '30px', color: '#ffdd00'
  }).setOrigin(0.5).setDepth(100).setVisible(false);

  restartText = this.add.text(400, 400, 'PRESS SPACE TO RESTART', {
    fontFamily: 'monospace', fontSize: '28px', color: '#ffff00'
  }).setOrigin(0.5).setDepth(100).setVisible(false);

  createWave.call(this, 1);
  this.physics.add.overlap(bullets, invaders, hitInvader, null, this);
  this.physics.add.overlap(nukes, invaders, nukeHit, null, this);
  this._playerHitCollider = this.physics.add.overlap(enemyBullets, player, hitPlayer, null, this);

  drawLives.call(this);
  gameReady = true;
  gamePhase = 'playing';

  // Initialize UFO spawn timer
  ufoNextSpawn = this.time.now + getUFOSpawnInterval();
}

// === UFO / Mystery Ship ===
function getUFOSpawnInterval() {
  // Random interval between 15-30 seconds
  return GameLogic.ufoSpawnInterval();
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
  // 回收殘留核彈
  if (nukes) nukes.getChildren().forEach(n => { if (n && n.body) n.disableBody(true, true); });
  // 每 5 波補滿核彈（同一波因死亡而重建時不重複補給）
  if (GameLogic.shouldReloadNukes(waveNum, lastNukeReloadWave)) {
    nukeAmmo = NUKE_MAX;
    lastNukeReloadWave = waveNum;
  }

  const rows = GameLogic.waveRowCount(waveNum);
  const cols = 8;
  const spacingX = 68;
  const startX = 110;

  // 重置本波的隊形重整狀態
  waveInitialCount = rows * cols;
  waveReformCount = 0;
  lastReformTime = 0;

  // 整個敵陣統一方向移動（經典 Space Invaders 行為）
  const formationDir = GameLogic.formationDir(waveNum);
  const formationSpeed = GameLogic.formationSpeed(waveNum, INVADER_BASE_SPEED);
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

// === 隊形重整（re-form） ===
const REFORM_THRESHOLD = 0.6;   // 殘兵低於初始的 60% 才可能觸發
const REFORM_CHANCE = 0.30;     // 每次符合條件時的觸發機率
const REFORM_COOLDOWN = 5000;   // 兩次判定之間的冷卻 (ms)
const REFORM_MAX_PER_WAVE = 2;  // 每波最多重整次數

// 在每次擊殺後判定：第 2 波之後、殘兵低於 60% 時，冷卻到了就擲一次骰子
function maybeReformInvaders(scene) {
  const eligible = GameLogic.isReformEligible({
    wave,
    reformCount: waveReformCount,
    active: invaders.countActive(true),
    initial: waveInitialCount,
    now: scene.time.now,
    lastReformTime,
    cooldown: REFORM_COOLDOWN,
    maxPerWave: REFORM_MAX_PER_WAVE,
    threshold: REFORM_THRESHOLD,
  });
  if (!eligible) return;

  lastReformTime = scene.time.now; // 不論成敗都重置冷卻，維持「偶爾」觸發
  if (Math.random() >= REFORM_CHANCE) return;

  reformInvaders(scene);
}

// 把殘存的敵人「飛」回上方、沿隨機曲線重新排成整齊隊形（不新增敵人）
function reformInvaders(scene) {
  const survivors = invaders.getChildren().filter(inv => inv.active && !inv.getData('reforming'));
  if (survivors.length === 0) return;

  const dir = GameLogic.formationDir(wave);
  const speed = GameLogic.formationSpeed(wave, INVADER_BASE_SPEED);

  survivors.forEach((inv, i) => {
    const slot = GameLogic.reformSlot(i);
    flyInvaderTo(scene, inv, slot.x, slot.y, slot.row, speed, dir, i);
  });

  waveReformCount++;
  SoundManager.play('waveComplete');
}

// 單一敵人沿隨機三次貝茲曲線飛到新位置；飛行期間停用物理（交給 tween 控制座標），
// 抵達後恢復隊形速度。曲線的兩個控制點往垂直方向加隨機擺幅 → 每隻路徑都不同且彎曲。
function flyInvaderTo(scene, inv, tx, ty, row, speed, dir, index) {
  const sx = inv.x, sy = inv.y;

  inv.setData('reforming', true);
  if (inv.body) { inv.setVelocity(0, 0); inv.body.enable = false; }

  const dx = tx - sx, dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len; // 垂直單位向量
  const swing = () => Phaser.Math.Between(-130, 130);
  const jitter = () => Phaser.Math.Between(-40, 40);
  const c1 = new Phaser.Math.Vector2(sx + dx * 0.33 + px * swing(), sy + dy * 0.33 + py * swing() + jitter());
  const c2 = new Phaser.Math.Vector2(sx + dx * 0.66 + px * swing(), sy + dy * 0.66 + py * swing() + jitter());
  const curve = new Phaser.Curves.CubicBezier(
    new Phaser.Math.Vector2(sx, sy), c1, c2, new Phaser.Math.Vector2(tx, ty)
  );

  const p = new Phaser.Math.Vector2();
  const state = { t: 0 };
  scene.tweens.add({
    targets: state,
    t: 1,
    duration: Phaser.Math.Between(750, 1150),
    delay: index * 30,            // 稍微錯開出發時間，營造逐一歸隊感
    ease: 'Sine.easeInOut',
    onUpdate: () => {
      if (!inv || !inv.active) return; // 飛行途中若被清場/重啟就放棄
      curve.getPoint(state.t, p);
      inv.setPosition(p.x, p.y);
    },
    onComplete: () => {
      if (!inv || !inv.active) return;
      inv.setPosition(tx, ty);
      inv.setData('row', row);
      inv.setData('reforming', false);
      if (inv.body) { inv.body.enable = true; inv.body.reset(tx, ty); inv.setVelocityX(speed * dir); }
    }
  });
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

// === 核彈 ===
// 發射一枚核彈（飛得慢、彈體大）。彈藥用完則無作用。
function fireNuke() {
  try {
    if (gameOver || playerDead || !player) return;
    if (nukeAmmo <= 0) return; // 沒彈藥
    const nuke = nukes.get(player.x, player.y - 14, 'nuke');
    if (!nuke) return;
    nuke.enableBody(true, player.x, player.y - 14, true, true);
    nuke.setData('detonated', false);
    nuke.setSize(16, 22);
    nuke.setDisplaySize(20, 26);
    nuke.setDepth(60);
    nuke.setVelocityY(NUKE_SPEED);
    nukeAmmo--;
    updateScoreText();
    SoundManager.play('shoot');
  } catch(e) { console.warn('fireNuke err:', e); }
}

// 核彈碰到敵人 → 引爆（overlap 可能同幀對多隻觸發，用 detonated 旗標只引爆一次）
function nukeHit(nuke, invader) {
  if (gameOver) return;
  if (!nuke || nuke.getData('detonated')) return;
  nuke.setData('detonated', true);
  const x = nuke.x, y = nuke.y;
  nuke.disableBody(true, true);
  detonateNuke(this, x, y);
}

// 在 (x,y) 引爆：半徑內所有敵人一併消滅，並沿用 hitInvader 的清波 / 重整判定
function detonateNuke(scene, x, y) {
  const blast = explosions.create(x, y, 'explode_sheet', 0);
  blast.setDisplaySize(NUKE_BLAST_RADIUS * 2, NUKE_BLAST_RADIUS * 2);
  blast.setDepth(70);
  blast.play('explode_pro');
  blast.once('animationcomplete', () => blast.destroy());
  SoundManager.play('explosion');

  const victims = invaders.getChildren().filter(inv =>
    inv && inv.active && GameLogic.withinBlast(x, y, inv.x, inv.y, NUKE_BLAST_RADIUS));
  victims.forEach(inv => {
    const e = explosions.create(inv.x, inv.y, 'explode_sheet', 0);
    e.setDisplaySize(56, 40);
    e.play('explode_pro');
    e.once('animationcomplete', () => e.destroy());
    inv.destroy();
    score += 100;
  });
  updateScoreText();

  if (invaders.countActive(true) === 0) {
    wave++;
    updateScoreText();
    SoundManager.play('waveComplete');
    scene.time.delayedCall(700, () => {
      if (gameOver || !gameReady) return;
      createWave.call(scene, wave);
    });
  } else {
    maybeReformInvaders(scene);
  }
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
  } else {
    // 還有殘兵 → 視情況觸發隊形重整
    maybeReformInvaders(this);
  }
}

function buildScoreText() {
  return GameLogic.formatScoreText(wave, score, highScore, nukeAmmo);
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

  introTexts.blueText = scene.add.text(400, 300,
    'A long time ago in a galaxy\nfar, far away....', {
    fontFamily: 'monospace', fontSize: '22px', color: '#4a9eff',
    align: 'center', fontStyle: 'italic'
  }).setOrigin(0.5).setAlpha(0).setDepth(200);

  introTexts.logo = scene.add.text(400, 280, 'SPACE\nINVADERS', {
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
  countdownTexts.ready = scene.add.text(400, 250, 'READY?', {
    fontFamily: 'monospace', fontSize: '52px', color: '#ffff00', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(300).setAlpha(0);
  countdownTexts.go = scene.add.text(400, 250, 'GO!', {
    fontFamily: 'monospace', fontSize: '64px', color: '#00ff00', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(300).setVisible(false);
}

// Koi play presents 製作商動畫（每幀由 update 呼叫）
const KOI_FULL_TEXT = 'Koi play presents';
function runKoiPresents(scene) {
  const FADE = 300;        // 淡入時間 (ms)
  const TOTAL = 3000;      // 總長度 (ms)
  const TYPE_START = 300;  // 打字機開始時間
  const TYPE_MS = 90;      // 每字速度
  const FADE_OUT = 200;    // 淡出時間

  const t = scene.time.now - koiPresentsStart;

  // 淡入 / 持續 / 淡出
  let alpha = 1;
  if (t <= FADE) alpha = t / FADE;
  else if (t >= TOTAL - FADE_OUT) alpha = Math.max(0, (TOTAL - t) / FADE_OUT);
  if (koiSprite) koiSprite.setAlpha(alpha);
  if (koiText) koiText.setAlpha(alpha);

  // 打字機效果
  const chars = Math.max(0, Math.min(KOI_FULL_TEXT.length,
    Math.floor((t - TYPE_START) / TYPE_MS)));
  if (koiText) koiText.setText(KOI_FULL_TEXT.slice(0, chars));

  // 結束 → 進入現有 intro 階段
  if (t >= TOTAL) endKoiPresents(scene);
}

function endKoiPresents(scene) {
  if (koiSprite) { koiSprite.destroy(); koiSprite = null; }
  if (koiText) { koiText.destroy(); koiText = null; }
  if (starfield) starfield.setVisible(true);

  gamePhase = 'intro';
  introStartTime = scene.time.now;
  introIdleStart = scene.time.now;
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
        const txt = scene.add.text(400, y, line, {
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
  demoTexts.title = scene.add.text(400, 120, '╔══════════════╗\n║  HIGH SCORES  ║\n╚══════════════╝', {
    fontFamily: 'monospace', fontSize: '22px', color: '#ffd700', fontStyle: 'bold', align: 'center'
  }).setOrigin(0.5).setDepth(300).setAlpha(0);

  // 排行榜條目
  demoTexts.entries = [];
  const top5 = board.slice(0, 5);
  if (top5.length === 0) {
    demoTexts.entries.push(
      scene.add.text(400, 260, 'NO SCORES YET', {
        fontFamily: 'monospace', fontSize: '22px', color: '#888888'
      }).setOrigin(0.5).setDepth(300)
    );
  } else {
    top5.forEach((s, i) => {
      const rank = (i + 1).toString();
      const medals = ['🥇', '🥈', '🥉', '  ', '  '];
      const y = 190 + i * 50;
      const txt = scene.add.text(400, y,
        `${medals[i]}  ${rank}st${rank==='1'?'':rank==='2'?'nd':rank==='3'?'rd':'th'}  ·  ${s.toString().padStart(6, '0')}`,
        { fontFamily: 'monospace', fontSize: '24px', color: i === 0 ? '#ffff00' : '#cccccc' }
      ).setOrigin(0.5).setDepth(300);
      demoTexts.entries.push(txt);
    });
  }

  // 提示文字
  demoTexts.hint = scene.add.text(400, 500, 'PRESS ANY KEY TO START', {
    fontFamily: 'monospace', fontSize: '18px', color: '#888888'
  }).setOrigin(0.5).setDepth(300);

  // 小外星人（Rei 指定：1.5x 放大 + 左右飄）
  demoTexts.alien = scene.add.sprite(400, 420, 'invader').setDepth(300).setScale(1.5);
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
  // 製作商動畫（Koi play presents）— 最一開始播放，3 秒後進 intro
  if (gamePhase === 'koi-presents') {
    runKoiPresents(this);
    return;
  }

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
        player = this.physics.add.sprite(400, 550, 'spaceship');
        player.setDisplaySize(48, 24);
        player.setCollideWorldBounds(true);
        // 重新註冊 overlap（player 被重建了）
        this.physics.world.removeCollider(this._playerHitCollider);
        this._playerHitCollider = this.physics.add.overlap(enemyBullets, player, hitPlayer, null, this);
      }
      player.setPosition(400, 550);
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

    // 原生手把：類比搖桿 / D-pad / 射擊鍵（每幀輪詢連續狀態）
    let padAxis = 0, padLeft = false, padRight = false, padFire = false;
    const pad = (this.input.gamepad && this.input.gamepad.total > 0)
      ? this.input.gamepad.getPad(0) : null;
    if (pad && pad.connected) {
      const btn = i => pad.buttons && pad.buttons[i] && pad.buttons[i].pressed;
      const ax = pad.leftStick ? pad.leftStick.x
        : (pad.axes && pad.axes.length ? pad.axes[0].getValue() : 0);
      if (Math.abs(ax) > 0.20) padAxis = ax; // 死區，避免搖桿漂移
      // D-pad（標準佈局 14=左 15=右）；優先用具名 getter，退回原始 buttons
      padLeft = !!pad.left || btn(14);
      padRight = !!pad.right || btn(15);
      // 主鈕 / 扳機射擊（0=A 7=R2）；R1(5) 保留給核彈，避免同鍵重疊
      padFire = !!(pad.A || pad.R2) || btn(0) || btn(7);
    }

    // 鍵盤方向鍵、螢幕搖桿、手把 D-pad 皆可控制
    const moveLeft = cursors.left.isDown || touchState.left || padLeft;
    const moveRight = cursors.right.isDown || touchState.right || padRight;
    if (player && player.body) {
      const maxSpeed = 350;
      const acceleration = 2000; // pixels per second squared
      const friction = 1500; // pixels per second squared
      const dt = this.game.loop.delta / 1000; // delta time in seconds

      let targetVelocity = 0;
      // 類比搖桿優先：依推桿幅度給比例速度（原生手感）；否則用數位方向
      if (padAxis !== 0) targetVelocity = padAxis * maxSpeed;
      else if (moveLeft) targetVelocity = -maxSpeed;
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

    // 按住空白鍵 / 螢幕火力鍵 / 手把射擊鍵連發（shoot 內含 180ms 冷卻）
    if ((cursors.space && cursors.space.isDown) || touchState.fire || padFire) {
      shoot.call(this);
    }

    // Enter 發射核彈（單發，每次按鍵觸發一次）
    if (enterKey && Phaser.Input.Keyboard.JustDown(enterKey)) {
      fireNuke.call(this);
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
    if (inv.getData('reforming')) continue; // 歸隊飛行中，不參與邊界反彈/到底判定
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
      if (inv && inv.active && inv.body && !inv.getData('reforming')) {
        // 反彈後速度稍微加快（越打越快，但幅度小一點）
        const currentSpeed = Math.abs(inv.body.velocity.x);
        const newSpeed = GameLogic.bounceSpeed(currentSpeed);
        const dir = side === 'left' ? 1 : -1;
        inv.setVelocityX(newSpeed * dir);
        // 階梯式掉落：後排掉得少，前排掉得多
        const row = inv.getData('row') || 0;
        inv.y += GameLogic.steppedDrop(row);
      }
    });
  }

  // Player子彈超出畫面回收到池中（用快照，避免邊迭代邊修改 group 陣列）
  bullets.getChildren().slice().forEach(b => {
    if (b && b.active && b.y < 0) b.disableBody(true, true);
  });

  // 核彈飛到頂端仍未命中 → 在頂端引爆（不浪費這發珍貴核彈）
  if (nukes) nukes.getChildren().slice().forEach(n => {
    if (n && n.active && !n.getData('detonated') && n.y <= 55) {
      n.setData('detonated', true);
      const nx = n.x;
      n.disableBody(true, true);
      detonateNuke(this, nx, 70);
    }
  });

  // 敵人射擊
  const activeInvaders = invaders.getChildren().filter(inv => inv.active && !inv.getData('reforming'));
  if (activeInvaders.length > 0) {
    const now = this.time.now;
    // 間隔隨波數遞減（越來越快）
    const fireInterval = GameLogic.fireInterval(wave);
    if (now - lastEnemyShot > fireInterval) {
      // 找出最接近玩家（Y 值最大）的幾隻作為候選射手
      activeInvaders.sort((a, b) => b.y - a.y);

      // 第 3 波之後，偶爾會有多隻同時開火（最多 4 隻）。
      // 約一半機率單發，其餘隨機 2~4 發，營造「彈幕變密」的壓力。
      let volley = GameLogic.clampVolley(GameLogic.volleyCount(wave), activeInvaders.length);

      // 候選池取得比射手數更大，從中隨機挑不重複的射手（避免同一隻連發兩枚）
      const poolSize = GameLogic.shooterPoolSize(volley, activeInvaders.length);
      const pool = activeInvaders.slice(0, poolSize);
      for (let i = 0; i < volley && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        spawnEnemyBullet(this, pool.splice(idx, 1)[0]);
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

// 從指定敵人發射一枚子彈（朝玩家，或玩家失效時直線下墜）
function spawnEnemyBullet(scene, shooter) {
  if (!shooter) return;
  const eb = enemyBullets.get(shooter.x, shooter.y + 12, 'ebullet');
  if (!eb) return;
  eb.enableBody(true, shooter.x, shooter.y + 12, true, true);
  eb.setSize(4, 8);
  eb.setDisplaySize(4, 8);
  const speed = GameLogic.enemyBulletSpeed(wave);
  // player 可能在死亡/重建期間為 null 或 body 失效 → 此時直線下墜，
  // 不要把 null 傳進 moveToObject（會丟例外、被 update 的 catch 吞掉）。
  if (player && player.body && player.active) {
    scene.physics.moveToObject(eb, player, speed);
  } else {
    eb.setVelocityY(speed);
  }
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
  [invaders, enemyBullets, bullets, nukes].forEach(grp => {
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
  nukeAmmo = NUKE_MAX;
  lastNukeReloadWave = 0;

  // 清除所有 group
  invaders.clear(true, true);
  bullets.clear(true, true);
  enemyBullets.clear(true, true);
  if (nukes) nukes.clear(true, true);
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
  player = scene.physics.add.sprite(400, 550, 'spaceship');
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

// Demo → intro 轉場（鍵盤任意鍵與手把任意鍵共用）
function exitDemoToIntro(scene) {
  Object.values(demoTexts).forEach(t => {
    if (Array.isArray(t)) t.forEach(x => { if (x && x.destroy) x.destroy(); });
    else if (t && t.destroy) t.destroy();
  });
  demoTexts = {};
  gamePhase = 'intro';
  introStartTime = scene.time.now;
  introIdleStart = scene.time.now;
  rebuildIntro();
}

// 手把離散按鍵：開始 / 重來 / 退出 demo / 核彈。移動與連射走 update() 輪詢。
// 註冊時以 scene 為 context，故此處 this === scene。
// GamepadPlugin 'down' 事件簽名為 (pad, button, value)，按鍵編號在 button.index。
function handleGamepadDown(pad, button, value) {
  SoundManager.unlockAudio();
  if (gamePhase === 'demo') { exitDemoToIntro(this); return; }
  if (gamePhase === 'intro') { skipIntro(); return; }
  if (gameOver) { gameOverIdleStart = 0; restartGame(); return; }
  // 遊戲進行中：B(1) / Y(3) / R1(5) 發射核彈（A / 扳機的連射在 update 輪詢）
  const index = button && typeof button.index === 'number' ? button.index : -1;
  if (gamePhase === 'playing' && !playerDead && (index === 1 || index === 3 || index === 5)) {
    fireNuke.call(this);
  }
}

window.addEventListener('keydown', e => {
  SoundManager.unlockAudio();

  // Demo 期間按任意鍵 → 回 intro
  if (gamePhase === 'demo') {
    exitDemoToIntro(game.scene.scenes[0]);
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
