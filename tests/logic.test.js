// Unit tests for game-logic.js — run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game-logic.js');

test('pad5', () => {
  assert.equal(G.pad5(0), '00000');
  assert.equal(G.pad5(42), '00042');
  assert.equal(G.pad5(99999), '99999');
  assert.equal(G.pad5(123456), '123456'); // no truncation
});

test('formatScoreText', () => {
  assert.equal(G.formatScoreText(1, 0, 500, 3), 'WAVE 1   SCORE: 00000   HI: 00500   NUKE: 3');
  assert.equal(G.formatScoreText(12, 99999, 99999, 0), 'WAVE 12   SCORE: 99999   HI: 99999   NUKE: 0');
});

test('waveRowCount scales and caps at 6', () => {
  assert.equal(G.waveRowCount(1), 4);
  assert.equal(G.waveRowCount(3), 5);
  assert.equal(G.waveRowCount(6), 6);
  assert.equal(G.waveRowCount(99), 6); // capped
});

test('formationDir alternates by parity', () => {
  assert.equal(G.formationDir(1), -1);
  assert.equal(G.formationDir(2), 1);
  assert.equal(G.formationDir(3), -1);
});

test('formationSpeed ramps with wave', () => {
  assert.equal(G.formationSpeed(1, 80), 80);
  assert.equal(G.formationSpeed(3, 80), 116);
});

test('steppedDrop increases per row', () => {
  assert.equal(G.steppedDrop(0), 6);
  assert.equal(G.steppedDrop(2), 9);
});

test('bounceSpeed adds 2 and caps at 220', () => {
  assert.equal(G.bounceSpeed(100), 102);
  assert.equal(G.bounceSpeed(219), 220);
  assert.equal(G.bounceSpeed(220), 220);
});

test('fireInterval shrinks with wave, floored at 600', () => {
  assert.equal(G.fireInterval(1), 1850);
  assert.equal(G.fireInterval(9), 650);
  assert.equal(G.fireInterval(20), 600); // floored
});

test('enemyBulletSpeed ramps with wave', () => {
  assert.equal(G.enemyBulletSpeed(1), 195);
  assert.equal(G.enemyBulletSpeed(10), 330);
});

test('volleyCount — single shot for waves <= 3', () => {
  for (const w of [1, 2, 3]) assert.equal(G.volleyCount(w, () => 0), 1);
});

test('volleyCount — wave > 3 single when roll < 0.5', () => {
  assert.equal(G.volleyCount(4, () => 0.4), 1);
});

test('volleyCount — wave > 3 multi (2..4) when roll >= 0.5', () => {
  // first rnd >= 0.5 picks multi; second rnd scales 2 + floor(rnd*3)
  assert.equal(G.volleyCount(4, seq([0.5, 0.0])), 2);
  assert.equal(G.volleyCount(4, seq([0.9, 0.5])), 3);
  assert.equal(G.volleyCount(4, seq([0.9, 0.99])), 4);
});

test('volleyCount — defaults to Math.random when no rnd', () => {
  const v = G.volleyCount(1); // wave<=3 → always 1, independent of RNG
  assert.equal(v, 1);
});

test('clampVolley / shooterPoolSize', () => {
  assert.equal(G.clampVolley(4, 2), 2);
  assert.equal(G.clampVolley(2, 8), 2);
  assert.equal(G.shooterPoolSize(1, 8), 3); // min pool 3
  assert.equal(G.shooterPoolSize(4, 8), 8); // volley*2
  assert.equal(G.shooterPoolSize(4, 5), 5); // capped by active
});

test('reformThresholdCount', () => {
  assert.equal(G.reformThresholdCount(32), 20);   // ceil(19.2)
  assert.equal(G.reformThresholdCount(40), 24);
  assert.equal(G.reformThresholdCount(10, 0.5), 5);
});

test('isReformEligible — happy path', () => {
  assert.equal(G.isReformEligible({
    wave: 3, reformCount: 0, active: 18, initial: 32,
    now: 10000, lastReformTime: 0, cooldown: 5000, maxPerWave: 2, threshold: 0.6,
  }), true);
});

test('isReformEligible — each guard blocks', () => {
  const base = { wave: 3, reformCount: 0, active: 18, initial: 32, now: 10000, lastReformTime: 0, cooldown: 5000, maxPerWave: 2, threshold: 0.6 };
  assert.equal(G.isReformEligible({ ...base, wave: 2 }), false);          // too early
  assert.equal(G.isReformEligible({ ...base, reformCount: 2 }), false);   // cap reached
  assert.equal(G.isReformEligible({ ...base, active: 0 }), false);        // none left
  assert.equal(G.isReformEligible({ ...base, active: 20 }), false);       // not below 60%
  assert.equal(G.isReformEligible({ ...base, now: 3000 }), false);        // cooldown
});

test('reformSlot lays out an 8-wide grid from the top', () => {
  assert.deepEqual(G.reformSlot(0), { row: 0, col: 0, x: 110, y: 90 });
  assert.deepEqual(G.reformSlot(7), { row: 0, col: 7, x: 110 + 7 * 68, y: 90 });
  assert.deepEqual(G.reformSlot(8), { row: 1, col: 0, x: 110, y: 145 });
  assert.deepEqual(G.reformSlot(0, { startX: 0, topY: 0, cols: 4, spacingX: 10, rowSpacing: 20 }), { row: 0, col: 0, x: 0, y: 0 });
  assert.deepEqual(G.reformSlot(5, { cols: 4, spacingX: 10, startX: 0, topY: 0, rowSpacing: 20 }), { row: 1, col: 1, x: 10, y: 20 });
});

test('shouldReloadNukes every 5 waves, once per wave', () => {
  assert.equal(G.shouldReloadNukes(5, 0), true);
  assert.equal(G.shouldReloadNukes(10, 5), true);
  assert.equal(G.shouldReloadNukes(5, 5), false);  // already reloaded this wave
  assert.equal(G.shouldReloadNukes(4, 0), false);
  assert.equal(G.shouldReloadNukes(7, 5), false);
});

test('withinBlast radius check', () => {
  assert.equal(G.withinBlast(0, 0, 0, 100, 110), true);
  assert.equal(G.withinBlast(0, 0, 0, 110, 110), true);  // exactly on edge
  assert.equal(G.withinBlast(0, 0, 0, 111, 110), false);
  assert.equal(G.withinBlast(100, 100, 160, 180, 110), true); // 60,80 -> 100
});

test('ufoSpawnInterval within [15000, 30000)', () => {
  assert.equal(G.ufoSpawnInterval(() => 0), 15000);
  assert.equal(G.ufoSpawnInterval(() => 0.5), 22500);
  assert.equal(G.ufoSpawnInterval(() => 0.999), 29985); // 15000 + floor(0.999*15000)
  const v = G.ufoSpawnInterval(); // default RNG
  assert.ok(v >= 15000 && v < 30000);
});

test('leaderboardInsert — sorts desc and caps', () => {
  assert.deepEqual(G.leaderboardInsert([], 100), [100]);
  assert.deepEqual(G.leaderboardInsert([500, 200], 300), [500, 300, 200]);
  assert.deepEqual(G.leaderboardInsert([5, 4, 3], 10, 3), [10, 5, 4]); // capped to 3
});

test('leaderboardInsert — ignores non-positive scores', () => {
  assert.deepEqual(G.leaderboardInsert([100], 0), [100]);
  assert.deepEqual(G.leaderboardInsert([100], -5), [100]);
  assert.deepEqual(G.leaderboardInsert(null, 0), []);   // bad board -> empty
  assert.deepEqual(G.leaderboardInsert('nope', 50), [50]); // non-array board tolerated
});

// helper: deterministic RNG returning a fixed sequence
function seq(values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}
