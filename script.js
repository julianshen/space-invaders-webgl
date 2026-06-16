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
    }
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

// === 觸控 / 螢幕控制狀態（由 setupTouchControls 維護） ===
const touchState = { left: false, right: false, fire: false };

// === HIGH SCORE (localStorage) ===
let highScore = parseInt(localStorage.getItem('spaceInvadersHighScore') || '0', 10);

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

  // Player - 強制設定合理尺寸
  player = this.physics.add.sprite(400, 550, 'spaceship');
  player.setDisplaySize(48, 24);
  player.setCollideWorldBounds(true);

  cursors = this.input.keyboard.createCursorKeys();
  // 射擊改用 update 內輪詢（cursors.space / 觸控火力鍵），按住即可連發（仍受冷卻限制）。

  // 真正的物件池：用 get()/disableBody() 回收，不再每次 create/destroy。
  bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 12 });
  enemyBullets = this.physics.add.group({ defaultKey: 'ebullet', maxSize: 20 });
  invaders = this.physics.add.group();
  explosions = this.add.group();

  // UI 文字統一給高 depth，否則之後在 createWave 建立的 invaders（同 depth 0、
  // 但較晚加入 display list）會蓋在分數 / GAME OVER 文字上面。
  scoreText = this.add.text(16, 16, buildScoreText(), {
    fontFamily: 'monospace',
    fontSize: '22px',
    color: '#00ff00'
  }).setDepth(100);

  // Game Over 畫面 (戲劇版)
  gameOverText = this.add.text(400, 220, 'GAME OVER', {
    fontFamily: 'monospace',
    fontSize: '80px',
    color: '#ff0000',
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(100);
  gameOverText.setVisible(false);

  // 高分另開一個文字物件。原本塞進 80px 的 gameOverText 裡，
  // "HIGH SCORE: 00000" 在等寬字下約 816px，會超出 800px 畫布被裁切。
  finalScoreText = this.add.text(400, 320, '', {
    fontFamily: 'monospace',
    fontSize: '30px',
    color: '#ffdd00'
  }).setOrigin(0.5).setDepth(100);
  finalScoreText.setVisible(false);

  restartText = this.add.text(400, 400, 'PRESS SPACE TO RESTART', {
    fontFamily: 'monospace',
    fontSize: '28px',
    color: '#ffff00'
  }).setOrigin(0.5).setDepth(100);
  restartText.setVisible(false);

  this.anims.create({
    key: 'explode_pro',
    frames: this.anims.generateFrameNumbers('explode_sheet', { start: 0, end: 7 }),
    frameRate: 18,
    hideOnComplete: true
  });

  createWave.call(this, 1);
  this.physics.add.overlap(bullets, invaders, hitInvader, null, this);
  this._playerHitCollider = this.physics.add.overlap(enemyBullets, player, hitPlayer, null, this);

  // 生命數圖示（右上角顯示小戰機）
  drawLives.call(this);
  gameReady = true;
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

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const inv = invaders.create(startX + col * spacingX, 90 + row * 55, 'invader');
      inv.setDisplaySize(42, 24);
      // 隨機初始方向，讓敵人不會全部同方向移動
      const dir = (Math.random() > 0.5) ? 1 : -1;
      inv.setVelocityX((INVADER_BASE_SPEED + (waveNum - 1) * 18) * dir);
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

function update() {
  // 星空持續滾動（即使 gameOver 也動）
  if (starfield) starfield.tilePositionY -= 0.4;

  try {
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

    // 鍵盤方向鍵或螢幕搖桿皆可控制
    const moveLeft = cursors.left.isDown || touchState.left;
    const moveRight = cursors.right.isDown || touchState.right;
    if (player) {
      if (moveLeft) player.setVelocityX(-220);
      else if (moveRight) player.setVelocityX(220);
      else player.setVelocityX(0);
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
      // === SAVE HIGH SCORE ===
      saveHighScore();
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
        const newSpeed = Math.min(currentSpeed + 2, 220);
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
    SoundManager.play('gameOver');
    // === SAVE HIGH SCORE ===
    saveHighScore();
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
}

window.addEventListener('keydown', e => {
  SoundManager.init();
  SoundManager.resume();
  if (gameOver && e.key === ' ') {
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

  const unlockAudio = () => { SoundManager.init(); SoundManager.resume(); };

  if (fireBtn) {
    const press = e => {
      e.preventDefault();
      unlockAudio();
      if (gameOver) restartGame(); // GAME OVER 時 FIRE 也能重開
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
      if (gameOver) restartGame();
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
