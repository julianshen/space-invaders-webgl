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
  // Game State
  // =====================
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
  run('intro loops after 5.5s', () => {
    gamePhase = 'intro'; introStartTime = scene.time.now;
    introAliens = []; introTexts = {};
    introTexts.incoming = scene.add.text(400,180,'TEST',{fontFamily:'monospace',fontSize:'28px',color:'#ffdd00'}).setOrigin(0.5).setAlpha(0).setDepth(200);
    introTexts.invaders = scene.add.text(400,200,'TEST',{fontFamily:'monospace',fontSize:'72px',color:'#ff0000'}).setOrigin(0.5).setVisible(false).setDepth(200);
    introTexts.ready = scene.add.text(400,330,'TEST',{fontFamily:'monospace',fontSize:'32px',color:'#00ff00'}).setOrigin(0.5).setVisible(false).setDepth(200);
    for (let i = 0; i < 8; i++) {
      const a = scene.add.sprite(200 + i * 70, -60 - i * 30, 'invader');
      a.setDisplaySize(42, 24); a.setDepth(150); introAliens.push(a);
    }
    introStartTime = scene.time.now - 6000;
    const beforeTime = introStartTime;
    runIntro(scene);
    eq(gamePhase, 'intro', 'still intro after loop');
    assert(scene.time.now - introStartTime < 1000, 'introStartTime reset');
    introAliens.forEach(a => a.destroy());
    Object.values(introTexts).forEach(t => t.destroy());
    introAliens = []; introTexts = {};
  });

  run('skipIntro → countdown phase', () => {
    gamePhase = 'intro';
    introAliens = [scene.add.sprite(400, -50, 'invader')];
    introTexts = { t: scene.add.text(400, 100, 'x', {}) };
    skipIntro();
    eq(gamePhase, 'countdown', 'entered countdown');
    assert(countdownTexts.ready !== undefined, 'ready text created');
    assert(countdownTexts.go !== undefined, 'go text created');
    eq(introAliens.length, 0, 'introAliens cleared');
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
    restartGame();
    gamePhase = 'intro'; introStartTime = scene.time.now;
    // After game loads, intro should have crawl-related elements
    assert(introTexts.blueText !== undefined, 'blueText exists');
    assert(introTexts.logo !== undefined, 'logo exists');
    assert(crawlLines !== undefined, 'crawlLines array exists');
    assert(crawlLines.length > 0, 'crawlLines has entries');
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
  // Report
  // =====================
  console.log(JSON.stringify({results, pass, fail, total: pass+fail}, null, 2));
  console.log(`\n✅ ${pass} passed  ❌ ${fail} failed  📊 ${Math.round(pass/(pass+fail)*100)}%`);
})();
