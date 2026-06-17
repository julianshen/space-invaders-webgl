// Space Invaders — Pure Logic Tests
// 不依賴 Phaser，只測純 JS 邏輯
// Run in browser console or with Node (mocking DOM APIs as needed)

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEquals(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function runAll() {
  const results = [];
  for (const t of tests) {
    try {
      t.fn();
      results.push({ name: t.name, status: 'PASS' });
      passed++;
    } catch (e) {
      results.push({ name: t.name, status: 'FAIL', error: e.message });
      failed++;
    }
  }
  return results;
}

// =====================
// SoundManager.init (requires Web Audio API — browser only)
// =====================
test('SoundManager.init — creates AudioContext', () => {
  // Reset
  SoundManager.inited = false;
  SoundManager.ctx = null;
  SoundManager.masterGain = null;
  
  SoundManager.init();
  
  assert(SoundManager.ctx !== null, 'ctx should not be null');
  assert(SoundManager.masterGain !== null, 'masterGain should not be null');
  assert(SoundManager.inited === true, 'inited should be true');
});

test('SoundManager.init — idempotent', () => {
  SoundManager.inited = true;
  const ctxBefore = SoundManager.ctx;
  
  SoundManager.init();
  
  assert(SoundManager.ctx === ctxBefore, 'ctx should not change on second init');
});

// =====================
// buildScoreText
// =====================
test('buildScoreText — basic formatting', () => {
  wave = 1;
  score = 0;
  highScore = 500;
  
  const result = buildScoreText();
  
  assertEquals(result, 'WAVE 1   SCORE: 00000   HI: 00500');
});

test('buildScoreText — padding at max values', () => {
  wave = 12;
  score = 99999;
  highScore = 99999;
  
  const result = buildScoreText();
  
  assertEquals(result, 'WAVE 12   SCORE: 99999   HI: 99999');
});

test('buildScoreText — zero high score', () => {
  wave = 3;
  score = 2500;
  highScore = 0;
  
  const result = buildScoreText();
  
  assertEquals(result, 'WAVE 3   SCORE: 02500   HI: 00000');
});

// =====================
// saveHighScore
// =====================
test('saveHighScore — updates when beat', () => {
  score = 1000;
  highScore = 500;
  localStorage.removeItem('spaceInvadersHighScore');
  
  saveHighScore();
  
  assertEquals(highScore, 1000, 'highScore should update to 1000');
  assertEquals(localStorage.getItem('spaceInvadersHighScore'), '1000');
});

test('saveHighScore — no update when lower', () => {
  score = 300;
  highScore = 500;
  localStorage.setItem('spaceInvadersHighScore', '500');
  
  saveHighScore();
  
  assertEquals(highScore, 500, 'highScore should remain 500');
  assertEquals(localStorage.getItem('spaceInvadersHighScore'), '500');
});

test('saveHighScore — first score always saves', () => {
  score = 200;
  highScore = 0;
  localStorage.removeItem('spaceInvadersHighScore');
  
  saveHighScore();
  
  assertEquals(highScore, 200, 'first score should set highScore');
  assertEquals(localStorage.getItem('spaceInvadersHighScore'), '200');
});

// =====================
// Game State — restartGame (needs Phaser, skip in Node)
// =====================
test('restartGame — state variables reset', () => {
  if (typeof game === 'undefined') {
    console.log('  [SKIP] Phaser not available');
    return; // Skip in non-browser env
  }
  
  // Set dirty state
  gameOver = true;
  score = 5000;
  wave = 5;
  lives = 0;
  playerDead = true;
  
  restartGame();
  
  assertEquals(gameOver, false, 'gameOver should be false');
  assertEquals(score, 0, 'score should be 0');
  assertEquals(wave, 1, 'wave should be 1');
  assertEquals(lives, 3, 'lives should be 3');
  assertEquals(playerDead, false, 'playerDead should be false');
});

// =====================
// freezeField (needs Phaser physics)
// =====================
test('freezeField — stops player velocity', () => {
  if (typeof game === 'undefined' || !player || !player.body) {
    console.log('  [SKIP] Phaser game not ready');
    return;
  }
  
  player.setVelocity(100, 0);
  freezeField();
  
  assertEquals(player.body.velocity.x, 0, 'player velocity.x should be 0');
  assertEquals(player.body.velocity.y, 0, 'player velocity.y should be 0');
});

console.log(JSON.stringify(runAll(), null, 2));
console.log(`\n${passed}/${passed + failed} passed`);
