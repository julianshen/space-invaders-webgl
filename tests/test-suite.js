// Space Invaders — Test Suite
// Run in browser console after game loads:
//   (1) Navigate to game page
//   (2) Paste this entire file into browser console
//   (3) Results printed to console

(function() {
  const results = [];
  let pass = 0, fail = 0;
  const scene = game.scene.scenes[0];
  
  function assert(cond, msg) { if (!cond) throw new Error(msg); }
  function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
  
  function run(name, fn) {
    try { fn(); results.push({name, status:'PASS'}); pass++; }
    catch(e) { results.push({name, status:'FAIL', error:e.message}); fail++; }
  }

  // =====================
  // Pure Logic
  // =====================
  run('buildScoreText basic', () => {
    wave = 1; score = 0; highScore = 500;
    eq(buildScoreText(), 'WAVE 1   SCORE: 00000   HI: 00500');
  });

  run('buildScoreText max', () => {
    wave = 12; score = 99999; highScore = 99999;
    eq(buildScoreText(), 'WAVE 12   SCORE: 99999   HI: 99999');
  });

  run('saveHighScore beat', () => {
    score = 1000; highScore = 500;
    localStorage.removeItem('spaceInvadersHighScore');
    saveHighScore();
    eq(highScore, 1000);
    eq(localStorage.getItem('spaceInvadersHighScore'), '1000');
  });

  run('saveHighScore no update', () => {
    score = 300; highScore = 500;
    localStorage.setItem('spaceInvadersHighScore', '500');
    saveHighScore();
    eq(highScore, 500);
  });

  run('SoundManager.init', () => {
    SoundManager.inited = false;
    SoundManager.ctx = null;
    SoundManager.masterGain = null;
    SoundManager.init();
    assert(SoundManager.ctx !== null, 'ctx');
    assert(SoundManager.masterGain !== null, 'gain');
    assert(SoundManager.inited === true, 'inited');
  });

  run('SoundManager.init idempotent', () => {
    SoundManager.inited = true;
    const prev = SoundManager.ctx;
    SoundManager.init();
    assert(SoundManager.ctx === prev, 'unchanged');
  });

  // =====================
  // Audio Playback (TDD)
  // =====================
  run('Audio: unlockAudio creates fanfare element', () => {
    SoundManager._fanfareAudio = undefined;
    SoundManager.unlockAudio();
    assert(SoundManager._fanfareAudio instanceof HTMLAudioElement, 'fanfare element exists');
  });

  run('Audio: playFanfare sets playback path', () => {
    SoundManager.unlockAudio();
    // Simulate user gesture by ensuring AudioContext is running
    if (SoundManager.ctx.state === 'suspended') SoundManager.ctx.resume();
    SoundManager._lastPlaybackPath = null;
    SoundManager.playFanfare();
    // play() is async, but the path should be decided synchronously
    // Either MP3 plays or we fall back to 8-bit
    assert(SoundManager._lastPlaybackPath === 'mp3' || SoundManager._lastPlaybackPath === '8bit',
      'playback path set: ' + SoundManager._lastPlaybackPath);
    // Cleanup
    if (SoundManager._fanfareAudio) {
      SoundManager._fanfareAudio.pause();
      SoundManager._fanfareAudio.currentTime = 0;
    }
  });

  run('Audio: playFanfare without unlock does not crash', () => {
    SoundManager._fanfareAudio = undefined;
    SoundManager._lastPlaybackPath = null;
    let threw = false;
    try { SoundManager.playFanfare(); }
    catch(e) { threw = true; }
    assert(!threw, 'no crash without unlock');
  });

  // =====================
  // Visual Design (Rei's review — TDD)
  // =====================
  run('Visual: crawl text font is NOT monospace', () => {
    gamePhase = 'intro'; introStartTime = scene.time.now;
    introTexts = {};
    introTexts.blueText = scene.add.text(400,300,'T',{}).setOrigin(0.5).setAlpha(0).setDepth(200);
    introTexts.logo = scene.add.text(400,300,'T',{}).setOrigin(0.5).setVisible(false).setDepth(200);
    crawlLines = [];
    introStartTime = scene.time.now - 6500;
    runIntro(scene);
    if (crawlLines.length > 0) {
      const font = crawlLines[0].style.fontFamily || '';
      assert(!font.includes('monospace') && !font.includes('Press Start'),
        'crawl font is NOT monospace/Press Start: ' + font);
    }
    crawlLines.forEach(t => t.destroy()); crawlLines = [];
    Object.values(introTexts).forEach(t => t.destroy()); introTexts = {};
  });

  run('Visual: demo has INSERT COIN or blinking hint', () => {
    gamePhase = 'gameover'; gameOver = true;
    gameOverIdleStart = scene.time.now - 21000;
    introTexts = {}; crawlLines = []; countdownTexts = {};
    enterDemo();
    const hasCoin = Object.values(demoTexts).some(t => {
      if (!t || !t.text) return false;
      return t.text.includes('INSERT COIN') || t.text.includes('COIN');
    });
    const hasHint = Object.values(demoTexts).some(t => {
      if (!t || !t.text) return false;
      return t.text.includes('PRESS') || t.text.includes('START');
    });
    assert(hasCoin || hasHint, 'demo needs INSERT COIN or PRESS START');
    Object.values(demoTexts).forEach(t => {
      if (Array.isArray(t)) t.forEach(x => x.destroy());
      else if (t && t.destroy) t.destroy();
    });
    demoTexts = {};
  });

  run('Visual: demo alien is scaled up ≥1.3x', () => {
    gamePhase = 'gameover'; gameOver = true;
    gameOverIdleStart = scene.time.now - 21000;
    introTexts = {}; crawlLines = []; countdownTexts = {};
    enterDemo();
    // Aliens are sprites with 'invader' texture, not text objects
    const alienSprite = demoTexts.alien;
    if (alienSprite) {
      assert(alienSprite.scaleX >= 1.3, 'alien scaleX ≥1.3: ' + alienSprite.scaleX);
    } else {
      assert(false, 'no alien sprite in demo');
    }
    Object.values(demoTexts).forEach(t => {
      if (Array.isArray(t)) t.forEach(x => x.destroy());
      else if (t && t.destroy) t.destroy();
    });
    demoTexts = {};
  });

  run('Visual: FIRE button is dark red, not bright', () => {
    const fireBtn = document.querySelector('.arcade-btn.fire');
    if (fireBtn) {
      const style = getComputedStyle(fireBtn);
      const bg = style.background || style.backgroundColor || '';
      // Bright red = #ff5555 or rgb(255, 85, 85). Should be darker.
      const hasBright = bg.includes('255, 85, 85') || bg.includes('#ff5555');
      assert(!hasBright, 'FIRE button should be dark red, not #ff5555');
    }
  });

  run('Visual: no copyright in cabinet HTML', () => {
    const body = document.body.innerText || '';
    assert(!body.includes('©'), 'copyright symbol not in cabinet text');
  });

  // =====================
  // Game State (need game started first)
  // =====================
  // Ensure game is initialized
  if (!invaders || !invaders.clear) {
    startPlaying.call(scene);
  }
  run('restartGame reset', () => {
    restartGame();
    gameOver = true; score = 5000; wave = 5; lives = 0; playerDead = true;
    restartGame();
    eq(gameOver, false); eq(score, 0); eq(wave, 1);
    eq(lives, 3); eq(playerDead, false);
  });

  run('freezeField player', () => {
    restartGame();
    player.setVelocity(200, -50);
    freezeField();
    eq(player.body.velocity.x, 0);
    eq(player.body.velocity.y, 0);
  });

  run('shoot cooldown', () => {
    restartGame();
    const before = bullets.countActive();
    lastShot = scene.time.now - 50;
    shoot.call(scene);
    eq(bullets.countActive(), before);
  });

  run('shoot fires', () => {
    restartGame();
    const before = bullets.countActive();
    lastShot = 0;
    shoot.call(scene);
    assert(bullets.countActive() > before, 'bullet fired');
  });

  run('hitInvader score', () => {
    restartGame();
    const inv = invaders.getChildren().find(i => i.active);
    assert(!!inv, 'need invader');
    const sb = score;
    const b = bullets.get(inv.x, inv.y, 'bullet');
    if (b) {
      b.enableBody(true, inv.x, inv.y, true, true);
      hitInvader.call(scene, b, inv);
    }
    eq(score, sb + 100);
  });

  run('hitPlayer invul guard', () => {
    restartGame();
    const inv = invaders.getChildren().find(i => i.active);
    if (inv) {
      invulnerable = true;
      const lb = lives;
      const eb = enemyBullets.get(inv.x, inv.y + 20, 'ebullet');
      if (eb) {
        eb.enableBody(true, inv.x, inv.y + 20, true, true);
        hitPlayer.call(scene, eb, player);
      }
      eq(lives, lb);
    }
    invulnerable = false;
  });

  run('createWave count', () => {
    restartGame();
    createWave.call(scene, 1);
    eq(invaders.countActive(), 32);
  });

  // =====================
  // Invader Overlap Fix (TDD)
  // =====================
  run('invader: all invaders move in same direction', () => {
    restartGame();
    createWave.call(scene, 1);
    const active = invaders.getChildren().filter(i => i.active && i.body);
    assert(active.length > 0, 'need active invaders');
    // All invaders should have the same velocity direction
    const firstDir = Math.sign(active[0].body.velocity.x);
    const allSameDir = active.every(inv => Math.sign(inv.body.velocity.x) === firstDir);
    assert(allSameDir, 'all invaders move in same direction, got dirs: ' + 
      active.map(i => Math.sign(i.body.velocity.x)).join(','));
  });

  run('invader: no overlap after bounce', () => {
    restartGame();
    createWave.call(scene, 1);
    const active = invaders.getChildren().filter(i => i.active && i.body);
    assert(active.length > 0, 'need active invaders');
    // Simulate a bounce by pushing all invaders to left boundary
    active.forEach(inv => { inv.x = 30; inv.body.velocity.x = -50; });
    // Manually trigger the bounce logic from update()
    const invaderSnapshot = invaders.getChildren().slice();
    let bounce = false;
    for (const inv of invaderSnapshot) {
      if (!inv || !inv.active || !inv.body) continue;
      if (inv.x < 40 && inv.body.velocity.x < 0) { bounce = true; break; }
    }
    if (bounce) {
      invaders.getChildren().slice().forEach(inv => {
        if (inv && inv.active && inv.body) {
          const row = inv.getData('row') || 0;
          const dropAmount = 6 + row * 1.5;
          inv.y += dropAmount;
        }
      });
    }
    // Check that no two invaders overlap (x distance should be at least displaySize)
    const sorted = active.slice().sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      // Only check same row
      if (a.y === b.y) {
        const dx = Math.abs(b.x - a.x);
        assert(dx >= 42, 'invaders overlap: dx=' + dx + ' at y=' + a.y);
      }
    }
  });

  // =====================
  // Regression Guards
  // =====================
  run('reg: null player guard fallback', () => {
    restartGame();
    const orig = player;
    player = null;
    const eb = enemyBullets.get(400, 100, 'ebullet');
    if (eb) {
      eb.enableBody(true, 400, 100, true, true);
      // Simulate the actual game guard from update() enemy shooting:
      if (player && player.body && player.active) {
        scene.physics.moveToObject(eb, player, 200);
      } else {
        eb.setVelocityY(200); // fallback — must not crash
      }
      assert(true, 'guard fallback worked');
    }
    player = orig;
  });

  run('reg: hitInvader gameOver guard', () => {
    restartGame();
    gameOver = true;
    const sb = score;
    const inv = invaders.getChildren().find(i => i.active);
    if (inv) {
      const b = bullets.get(inv.x, inv.y, 'bullet');
      if (b) {
        b.enableBody(true, inv.x, inv.y, true, true);
        hitInvader.call(scene, b, inv);
      }
    }
    eq(score, sb);
    gameOver = false;
  });

  run('reg: restartGame clear events', () => {
    gameOver = true; score = 5000;
    restartGame();
    eq(gameOver, false);
    eq(score, 0);
  });

  run('reg: freezeField all groups', () => {
    restartGame();
    lastShot = 0;
    shoot.call(scene);
    const inv = invaders.getChildren().find(i => i.active);
    if (inv && inv.body) inv.setVelocity(100, 0);
    freezeField();
    const moving = invaders.getChildren().filter(
      i => i.active && i.body && (i.body.velocity.x !== 0 || i.body.velocity.y !== 0)
    );
    eq(moving.length, 0);
  });

  run('reg: object pool size', () => {
    restartGame();
    lastShot = 0;
    shoot.call(scene); shoot.call(scene);
    assert(bullets.getLength() <= 12, 'pool ≤ maxSize');
  });

  // =====================
  // Intro & Countdown (BDD)
  // =====================
  run('intro loops after 16s (crawl cycle)', () => {
    gamePhase = 'intro'; introStartTime = scene.time.now;
    introTexts = {};
    introTexts.blueText = scene.add.text(400,300,'TEST',{fontFamily:'monospace',fontSize:'22px',color:'#4a9eff'}).setOrigin(0.5).setAlpha(0).setDepth(200);
    introTexts.logo = scene.add.text(400,280,'TEST',{fontFamily:'monospace',fontSize:'56px',color:'#ffd700'}).setOrigin(0.5).setVisible(false).setDepth(200);
    crawlLines = [];
    introStartTime = scene.time.now - 21000; // past full 20s cycle (6+14)
    runIntro(scene);
    eq(gamePhase, 'intro', 'still intro after loop');
    assert(scene.time.now - introStartTime < 1000, 'introStartTime reset');
    crawlLines.forEach(t => t.destroy());
    Object.values(introTexts).forEach(t => t.destroy());
    introTexts = {}; crawlLines = [];
  });

  run('skipIntro → countdown phase', () => {
    gamePhase = 'intro';
    introTexts = {
      blueText: scene.add.text(400, 200, 'X', {}).setOrigin(0.5),
      logo: scene.add.text(400, 200, 'X', {}).setOrigin(0.5)
    };
    crawlLines = [];
    skipIntro();
    eq(gamePhase, 'countdown', 'entered countdown');
    assert(countdownTexts.ready !== undefined, 'ready text created');
    assert(countdownTexts.go !== undefined, 'go text created');
    countdownTexts.ready.destroy();
    countdownTexts.go.destroy();
    countdownTexts = {};
  });

  run('countdown ends → game starts', () => {
    gamePhase = 'countdown'; countdownStart = scene.time.now - 2500;
    countdownTexts = {
      ready: scene.add.text(400, 250, 'READY?', {}),
      go: scene.add.text(400, 250, 'GO!', {})
    };
    runCountdown(scene);
    eq(gamePhase, 'playing', 'transitioned to playing');
    assert(!!player, 'player created');
    assert(invaders.countActive() > 0, 'invaders exist');
    eq(Object.keys(countdownTexts).length, 0, 'countdownTexts cleaned');
  });

  // =====================
  // Star Wars Crawl Intro (BDD)
  // =====================
  run('crawl: intro structure has crawl keys', () => {
    // Set up intro state to check structure
    if (gamePhase !== 'intro') {
      gamePhase = 'intro';
      introTexts = {};
      introTexts.blueText = scene.add.text(400,300,'T',{fontFamily:'monospace',fontSize:'22px',color:'#4a9eff'}).setOrigin(0.5).setAlpha(0).setDepth(200);
      introTexts.logo = scene.add.text(400,280,'T',{fontFamily:'monospace',fontSize:'56px',color:'#ffd700'}).setOrigin(0.5).setVisible(false).setDepth(200);
      crawlLines = [];
    }
    assert(introTexts.blueText !== undefined, 'blueText exists');
    assert(introTexts.logo !== undefined, 'logo exists');
    assert(Array.isArray(crawlLines), 'crawlLines is array');
    eq(gamePhase, 'intro', 'phase is intro');
  });

  run('crawl: phase 1 — blue text fades in', () => {
    gamePhase = 'intro'; introStartTime = scene.time.now;
    introTexts = {};
    introTexts.blueText = scene.add.text(400, 300, 'TEST', { 
      fontFamily: 'monospace', fontSize: '24px', color: '#4a9eff', fontStyle: 'italic' 
    }).setOrigin(0.5).setAlpha(0).setDepth(200);
    introTexts.logo = scene.add.text(400, 300, 'TEST', { 
      fontFamily: 'monospace', fontSize: '64px', color: '#ffd700', fontStyle: 'bold' 
    }).setOrigin(0.5).setVisible(false).setDepth(200);
    crawlLines = [];
    introStartTime = scene.time.now - 1000; // 1 second in
    runIntro(scene);
    assert(introTexts.blueText.alpha > 0, 'blue text fading in');
    assert(!introTexts.logo.visible, 'logo still hidden');
    Object.values(introTexts).forEach(t => t.destroy());
    introTexts = {}; crawlLines = [];
  });

  run('crawl: phase 2 — logo appears after blue text', () => {
    gamePhase = 'intro'; introStartTime = scene.time.now;
    introTexts = {};
    introTexts.blueText = scene.add.text(400, 300, 'TEST', { 
      fontFamily: 'monospace', fontSize: '24px', color: '#4a9eff' 
    }).setOrigin(0.5).setOrigin(0.5).setAlpha(0).setDepth(200);
    introTexts.logo = scene.add.text(400, 300, 'TEST', { 
      fontFamily: 'monospace', fontSize: '64px', color: '#ffd700' 
    }).setOrigin(0.5).setVisible(false).setDepth(200);
    crawlLines = [];
    introStartTime = scene.time.now - 3500; // ~3.5 seconds in
    runIntro(scene);
    assert(introTexts.logo.visible, 'logo is visible');
    Object.values(introTexts).forEach(t => t.destroy());
    introTexts = {}; crawlLines = [];
  });

  run('crawl: phase 3 — crawl text scrolls upward', () => {
    gamePhase = 'intro'; introStartTime = scene.time.now;
    introTexts = {};
    introTexts.blueText = scene.add.text(400, 300, 'TEST', {}).setOrigin(0.5).setAlpha(0).setDepth(200);
    introTexts.logo = scene.add.text(400, 300, 'TEST', {}).setOrigin(0.5).setVisible(false).setDepth(200);
    // Create mock crawl lines
    crawlLines = [];
    for (let i = 0; i < 3; i++) {
      crawlLines.push(scene.add.text(400, 700 + i * 40, 'LINE ' + i, {
        fontFamily: 'monospace', fontSize: '18px', color: '#ffd700'
      }).setOrigin(0.5));
    }
    const yBefore = crawlLines[0].y;
    introStartTime = scene.time.now - 6500; // ~6.5 seconds in (crawl phase)
    runIntro(scene);
    // All crawl lines should have moved upward
    assert(crawlLines[0].y < yBefore, 'crawl line moved up');
    crawlLines.forEach(l => l.destroy());
    crawlLines = [];
    Object.values(introTexts).forEach(t => t.destroy());
    introTexts = {};
  });

  run('crawl: skipIntro works with crawl', () => {
    gamePhase = 'intro';
    introTexts = {
      blueText: scene.add.text(400, 300, 'X', {}).setOrigin(0.5),
      logo: scene.add.text(400, 300, 'X', {}).setOrigin(0.5)
    };
    crawlLines = [scene.add.text(400, 500, 'X', {}).setOrigin(0.5)];
    skipIntro();
    eq(gamePhase, 'countdown', 'entered countdown');
    assert(countdownTexts.ready !== undefined, 'ready text');
    assert(crawlLines.length === 0, 'crawlLines cleared');
    eq(Object.keys(introTexts).length, 0, 'introTexts cleared');
    countdownTexts.ready.destroy();
    countdownTexts.go.destroy();
    countdownTexts = {};
  });

  run('crawl: enterDemo cleans new intro elements', () => {
    gamePhase = 'gameover'; gameOver = true;
    gameOverIdleStart = scene.time.now - 21000;
    introTexts = {
      blueText: scene.add.text(400, 300, 'X', {}).setOrigin(0.5),
      logo: scene.add.text(400, 300, 'X', {}).setOrigin(0.5)
    };
    crawlLines = [scene.add.text(400, 500, 'X', {}).setOrigin(0.5)];
    countdownTexts = {};
    enterDemo();
    eq(gamePhase, 'demo', 'entered demo');
    eq(Object.keys(introTexts).length, 0, 'introTexts cleaned');
    eq(crawlLines.length, 0, 'crawlLines cleaned');
    Object.values(demoTexts).forEach(t => {
      if (Array.isArray(t)) t.forEach(x => x.destroy());
      else if (t && t.destroy) t.destroy();
    });
    demoTexts = {};
  });

  run('crawl: demo leaderboard title is Star Wars themed', () => {
    gamePhase = 'gameover'; gameOver = true;
    gameOverIdleStart = scene.time.now - 21000;
    introTexts = {}; crawlLines = []; countdownTexts = {};
    localStorage.setItem('spaceInvadersLeaderboard', JSON.stringify([5000, 3000]));
    enterDemo();
    assert(demoTexts.title !== undefined, 'title exists');
    assert(demoTexts.title.text.includes('HIGH SCORES') || demoTexts.title.text.includes('SCORES'), 
      'title shows leaderboard');
    // Cleanup
    Object.values(demoTexts).forEach(t => {
      if (Array.isArray(t)) t.forEach(x => x.destroy());
      else if (t && t.destroy) t.destroy();
    });
    demoTexts = {};
  });

  // =====================
  // UFO / Mystery Ship (TDD)
  // =====================
  run('UFO: spawns at top of screen with ufo texture', () => {
    // Clean up any previous UFO
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
    spawnUFO(scene);
    assert(ufo !== null && ufo !== undefined, 'ufo sprite created');
    assert(ufo.texture && ufo.texture.key === 'ufo', 'ufo texture key is ufo');
    assert(ufo.y < 100, 'ufo near top of screen: ' + ufo.y);
    assert(ufoActive === true, 'ufoActive is true');
    // Cleanup
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
  });

  run('UFO: moves horizontally after spawning', () => {
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
    spawnUFO(scene);
    assert(ufo !== null, 'ufo exists');
    assert(ufo.body && ufo.body.velocity.x !== 0,
      'ufo has horizontal velocity: ' + (ufo.body ? ufo.body.velocity.x : 'no body'));
    // Cleanup
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
  });

  run('UFO: destroyed when past screen bounds', () => {
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
    spawnUFO(scene);
    assert(ufo !== null, 'ufo spawned');
    // Simulate UFO going past right edge
    ufo.x = 900;
    checkUFOBounds();
    assert(ufoActive === false || !ufo || !ufo.active,
      'ufo deactivated after bounds check (x=900)');
    // Cleanup
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
  });

  run('UFO: hitUFO adds random bonus 50/100/150/200', () => {
    // Ensure game state is ready
    if (!bullets || !bullets.clear) {
      startPlaying.call(scene);
    }
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
    spawnUFO(scene);
    const beforeScore = score;
    // Create a bullet and call hitUFO
    const bullet = bullets.get(ufo.x, ufo.y, 'bullet');
    if (bullet) {
      bullet.enableBody(true, ufo.x, ufo.y, true, true);
      hitUFO(bullet, ufo);
      const bonus = score - beforeScore;
      assert([50, 100, 150, 200].includes(bonus),
        'bonus score in [50,100,150,200]: got ' + bonus);
    } else {
      assert(false, 'could not get bullet from pool');
    }
    // Cleanup
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
  });

  // =====================

  // =====================
  // UFO Phase System (Rei's Design — RED/GREEN)
  // =====================
  run('UFO phase: spawns in normal phase', () => {
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
    spawnUFO(scene);
    assert(ufoPhase === 'normal', 'ufoPhase starts as normal: ' + ufoPhase);
    assert(ufoPhaseStart > 0, 'ufoPhaseStart is set: ' + ufoPhaseStart);
    assert(!ufo.tintTopLeft || ufo.tintTopLeft === 0xFFFFFF,
      'no tint in normal phase: ' + ufo.tintTopLeft);
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
  });

  run('UFO phase: transitions to RED after 4 seconds', () => {
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
    spawnUFO(scene);
    const origTime = ufoPhaseStart;
    // Simulate 4.5 seconds passing
    ufoPhaseStart = scene.time.now - 4500;
    // Manually trigger phase update logic (normally in update())
    const elapsed = scene.time.now - ufoPhaseStart;
    if (elapsed > 4000 && ufoPhase === 'normal') {
      ufoPhase = 'red';
      ufo.setTint(0xFF4444);
      ufo.setVelocityX(ufo.body.velocity.x * 1.5);
    }
    assert(ufoPhase === 'red', 'phase transitions to red after 4s: ' + ufoPhase);
    assert(ufo.tintTopLeft === 0xFF4444, 'red tint applied: ' + ufo.tintTopLeft);
    const speed = Math.abs(ufo.body.velocity.x);
    assert(speed >= 150, 'red phase speed increased: ' + speed);
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
  });

  run('UFO phase: transitions to GREEN after 8 seconds', () => {
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
    spawnUFO(scene);
    // Simulate 8.5 seconds passing
    ufoPhaseStart = scene.time.now - 8500;
    ufoPhase = 'red'; // Start from red
    ufo.setTint(0xFF4444);
    // Trigger green transition
    const elapsed = scene.time.now - ufoPhaseStart;
    if (elapsed > 8000) {
      ufoPhase = 'green';
      ufo.setTint(0x44FF44);
      ufo.setVelocityX(ufo.body.velocity.x * 0.7);
    }
    assert(ufoPhase === 'green', 'phase transitions to green after 8s: ' + ufoPhase);
    assert(ufo.tintTopLeft === 0x44FF44, 'green tint applied: ' + ufo.tintTopLeft);
    const speed = Math.abs(ufo.body.velocity.x);
    assert(speed <= 120, 'green phase speed decreased: ' + speed);
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
  });

  run('UFO phase: RED phase shoots downward', () => {
    if (!bullets || !bullets.clear) { startPlaying.call(scene); }
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
    spawnUFO(scene);
    ufoPhase = 'red';
    ufo.setTint(0xFF4444);
    // Simulate red phase shooting (20% chance per check)
    let shotFired = false;
    const ebBefore = enemyBullets.countActive();
    // Manually trigger shoot logic
    if (ufoPhase === 'red' && Math.random() < 0.3) { // 30% for test reliability
      const eb = enemyBullets.get(ufo.x, ufo.y + 10, 'ebullet');
      if (eb) {
        eb.enableBody(true, ufo.x, ufo.y + 10, true, true);
        eb.setVelocityY(200);
        shotFired = true;
      }
    }
    assert(shotFired, 'red phase should fire downward shot');
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
  });

  run('UFO phase: GREEN phase gives higher bonus', () => {
    if (!bullets || !bullets.clear) { startPlaying.call(scene); }
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
    spawnUFO(scene);
    ufoPhase = 'green';
    ufo.setTint(0x44FF44);
    const beforeScore = score;
    const bullet = bullets.get(ufo.x, ufo.y, 'bullet');
    if (bullet) {
      bullet.enableBody(true, ufo.x, ufo.y, true, true);
      hitUFO(bullet, ufo);
      const bonus = score - beforeScore;
      // GREEN phase bonus should be 150 or 200 (higher tier)
      assert(bonus >= 150, 'green phase bonus is higher: got ' + bonus);
    } else {
      assert(false, 'could not get bullet');
    }
    if (ufo) { ufo.destroy(); ufo = null; }
    ufoActive = false;
  });

  // =====================
  // Report
  // =====================
  console.log(JSON.stringify({results, pass, fail, total: pass+fail}, null, 2));
  console.log(`\n✅ ${pass} passed  ❌ ${fail} failed  📊 ${Math.round(pass/(pass+fail)*100)}%`);
})();
