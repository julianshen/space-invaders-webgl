# TEST REPORT

## Unit tests — pure game logic (`game-logic.js`)

Runner: Node built-in (`node --test`). No external dependencies.

```bash
npm test          # run unit tests
npm run coverage  # run with coverage report
```

| Metric | Value |
|--------|-------|
| Tests | 23 |
| Passed | 23 |
| Failed | 0 |
| Line coverage | 100% |
| Function coverage | 100% |
| Branch coverage | 98.39% |

> The one uncovered branch is the UMD `typeof window` guard in `game-logic.js`,
> which only executes in the browser and cannot run under Node.

### What's covered
The deterministic decision logic extracted from `script.js` into `game-logic.js`
(shared by the game at runtime and by the tests), randomness injected for
determinism:

- HUD formatting (`formatScoreText`, `pad5`)
- Wave/formation scaling (`waveRowCount`, `formationDir`, `formationSpeed`,
  `steppedDrop`, `bounceSpeed`)
- Enemy fire (`fireInterval`, `enemyBulletSpeed`, `volleyCount`, `clampVolley`,
  `shooterPoolSize`)
- Formation re-form (`reformThresholdCount`, `isReformEligible`, `reformSlot`)
- Nukes (`shouldReloadNukes`, `withinBlast`)
- UFO timing (`ufoSpawnInterval`)
- Leaderboard (`leaderboardInsert`)

### Not unit-tested (Phaser-coupled, verified in-browser)
Rendering, physics bodies, input wiring, animations, and the CRT filter are
verified manually / via the browser suites below — they depend on the Phaser
runtime and a WebGL context.

## Browser suites (manual)
`tests/test-suite.js` and `tests/test-pure.js` are pasted into the browser
console after the game loads, to exercise Phaser-dependent behaviour
(SoundManager, restartGame, freezeField, intro/crawl, demo leaderboard).
