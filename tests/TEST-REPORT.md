# TEST REPORT: Space Invaders

Generated: 2026-06-17

| Metric     | Value |
|------------|-------|
| Total      | 25    |
| Passed     | 25    |
| Failed     | 0     |
| Regression | 11/11 ✅ |

## Pure Logic Tests (6/6)

| # | Test | Status |
|---|------|--------|
| 1 | buildScoreText basic formatting | ✅ PASS |
| 2 | buildScoreText max padding | ✅ PASS |
| 3 | saveHighScore — updates when beat | ✅ PASS |
| 4 | saveHighScore — no update when lower | ✅ PASS |
| 5 | SoundManager.init — creates AudioContext | ✅ PASS |
| 6 | SoundManager.init — idempotent | ✅ PASS |

## Game State Tests (7/7)

| # | Test | Status |
|---|------|--------|
| 7 | restartGame resets all state | ✅ PASS |
| 8 | freezeField stops player velocity | ✅ PASS |
| 9 | shoot cooldown blocks firing | ✅ PASS |
| 10 | shoot fires after cooldown passed | ✅ PASS |
| 11 | hitInvader scores +100 per kill | ✅ PASS |
| 12 | hitPlayer invulnerable guard | ✅ PASS |
| 13 | createWave creates 32 enemies (wave 1) | ✅ PASS |

## Regression Guards (5/5)

| # | Test | Status |
|---|------|--------|
| 14 | reg: null player guard fallback (setVelocityY) | ✅ PASS |
| 15 | reg: hitInvader gameOver guard | ✅ PASS |
| 16 | reg: restartGame clears stale events | ✅ PASS |
| 17 | reg: freezeField all groups stopped | ✅ PASS |
| 18 | reg: object pool size ≤ maxSize | ✅ PASS |

## Intro & Countdown (BDD) — 3/3

| # | Test | Status |
|---|------|--------|
| 19 | intro loops after 5.5s | ✅ PASS |
| 20 | skipIntro → countdown phase | ✅ PASS |
| 21 | countdown ends → game starts | ✅ PASS |

##### Demo & Leaderboard (BDD) — 4/4

| # | Test | Status |
|---|------|--------|
| 22 | leaderboard save/sort (top 10, localStorage) | ✅ PASS |
| 23 | enterDemo creates HIGH SCORES UI | ✅ PASS |
| 24 | demo keypress → back to intro | ✅ PASS |
| 25 | gameOver idle timer < 20s | ✅ PASS |

## Coverage Notes

- **Pure logic**: 100% — buildScoreText, saveHighScore, SoundManager.init
- **Game state**: Core transitions covered — restart, shoot, hit, freeze, createWave
- **Regression guards**: All 5 major bugs from 2026-06-16 covered

## Missing Coverage (future work)

- hitPlayer game over path (full death, score save, UI visibility)
- enemy reaches bottom → life loss → game over path
- Touch control state machine
- Wave completion → next wave delayedCall timing
- Enemy bullet aiming (moveToObject vs fallback)
