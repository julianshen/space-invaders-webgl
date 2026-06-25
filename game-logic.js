// Space Invaders — pure game logic
//
// Deterministic, side-effect-free decision functions shared by the game
// (script.js, via window.GameLogic) and the Node unit tests (require()).
// Keeping these out of the Phaser-coupled code makes the rules unit-testable
// and gives meaningful coverage. Randomness is injected (rnd) so tests are
// deterministic.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // Node
  if (typeof window !== 'undefined') window.GameLogic = api;                 // browser
})(this, function () {
  'use strict';

  const pad5 = (n) => String(n).padStart(5, '0');

  // ===== HUD =====
  function formatScoreText(wave, score, highScore, nukeAmmo) {
    return `WAVE ${wave}   SCORE: ${pad5(score)}   HI: ${pad5(highScore)}   NUKE: ${nukeAmmo}`;
  }

  // ===== Wave / formation scaling =====
  function waveRowCount(waveNum) {
    return Math.min(4 + Math.floor(waveNum / 3), 6);
  }
  function formationDir(waveNum) {
    return (waveNum % 2 === 0) ? 1 : -1;
  }
  function formationSpeed(waveNum, base) {
    return base + (waveNum - 1) * 18;
  }
  function steppedDrop(row) {
    return 6 + row * 1.5;
  }
  function bounceSpeed(currentSpeed) {
    return Math.min(currentSpeed + 2, 220);
  }

  // ===== Enemy fire =====
  function fireInterval(wave) {
    return Math.max(600, 2000 - wave * 150);
  }
  function enemyBulletSpeed(wave) {
    return 180 + wave * 15;
  }
  // After wave 3: ~50% single shot, else a 2-4 shot volley. rnd() in [0,1).
  function volleyCount(wave, rnd) {
    const r = rnd || Math.random;
    if (wave > 3) return (r() < 0.5) ? 1 : (2 + Math.floor(r() * 3));
    return 1;
  }
  function clampVolley(volley, activeLen) {
    return Math.min(volley, activeLen);
  }
  function shooterPoolSize(volley, activeLen) {
    return Math.min(activeLen, Math.max(3, volley * 2));
  }

  // ===== Formation re-form =====
  function reformThresholdCount(initial, threshold) {
    return Math.ceil(initial * (threshold == null ? 0.6 : threshold));
  }
  // Eligibility for a re-form attempt (excludes the random roll itself).
  function isReformEligible(opts) {
    const { wave, reformCount, active, initial, now, lastReformTime,
            cooldown, maxPerWave, threshold } = opts;
    if (wave <= 2) return false;
    if (reformCount >= maxPerWave) return false;
    if (active === 0) return false;
    if (active >= reformThresholdCount(initial, threshold)) return false;
    if (now - lastReformTime < cooldown) return false;
    return true;
  }
  // Target grid slot for the i-th survivor when re-forming.
  function reformSlot(index, opts) {
    const o = opts || {};
    const cols = o.cols == null ? 8 : o.cols;
    const spacingX = o.spacingX == null ? 68 : o.spacingX;
    const startX = o.startX == null ? 110 : o.startX;
    const topY = o.topY == null ? 90 : o.topY;
    const rowSpacing = o.rowSpacing == null ? 55 : o.rowSpacing;
    const row = Math.floor(index / cols);
    const col = index % cols;
    return { row, col, x: startX + col * spacingX, y: topY + row * rowSpacing };
  }

  // ===== Nukes =====
  function shouldReloadNukes(waveNum, lastReloadWave) {
    return waveNum % 5 === 0 && lastReloadWave !== waveNum;
  }
  function withinBlast(x, y, ix, iy, radius) {
    return Math.hypot(ix - x, iy - y) <= radius;
  }

  // ===== UFO =====
  function ufoSpawnInterval(rnd) {
    const r = rnd || Math.random;
    return 15000 + Math.floor(r() * 15000);
  }

  // ===== Leaderboard =====
  // Pure version of saveScoreToLeaderboard: non-positive scores are ignored;
  // returns a new descending top-`size` list.
  function leaderboardInsert(board, score, size) {
    const cap = size == null ? 10 : size;
    const list = Array.isArray(board) ? board.slice() : [];
    if (!score || score <= 0) return list.slice(0, cap);
    list.push(score);
    list.sort((a, b) => b - a);
    return list.slice(0, cap);
  }

  return {
    pad5,
    formatScoreText,
    waveRowCount, formationDir, formationSpeed, steppedDrop, bounceSpeed,
    fireInterval, enemyBulletSpeed, volleyCount, clampVolley, shooterPoolSize,
    reformThresholdCount, isReformEligible, reformSlot,
    shouldReloadNukes, withinBlast,
    ufoSpawnInterval,
    leaderboardInsert,
  };
});
