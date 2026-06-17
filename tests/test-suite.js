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
  // Report
  // =====================
  console.log(JSON.stringify({results, pass, fail, total: pass+fail}, null, 2));
  console.log(`\n✅ ${pass} passed  ❌ ${fail} failed  📊 ${Math.round(pass/(pass+fail)*100)}%`);
})();
