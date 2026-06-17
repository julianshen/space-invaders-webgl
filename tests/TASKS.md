# Space Invaders — Test Plan

## Pure Logic Tests (no Phaser needed)

### Task: buildScoreText formatting [R]
**Acceptance Criteria:**
- Given wave=1, score=0, highScore=500
- When buildScoreText() is called
- Then returns "WAVE 1   SCORE: 00000   HI: 00500"

### Task: buildScoreText padding [R]
**Acceptance Criteria:**
- Given wave=12, score=99999, highScore=99999
- When buildScoreText() is called
- Then returns "WAVE 12   SCORE: 99999   HI: 99999"

### Task: saveHighScore — updates when beat [R]
**Acceptance Criteria:**
- Given score=1000, highScore=500
- When saveHighScore() is called
- Then highScore becomes 1000
- And localStorage has the updated value

### Task: saveHighScore — no update when lower [R]
**Acceptance Criteria:**
- Given score=300, highScore=500
- When saveHighScore() is called
- Then highScore remains 500

### Task: SoundManager.init — creates AudioContext
**Acceptance Criteria:**
- Given SoundManager.inited is false
- When SoundManager.init() is called
- Then SoundManager.ctx is not null
- And SoundManager.masterGain is not null
- And SoundManager.inited is true

### Task: SoundManager.init — idempotent
**Acceptance Criteria:**
- Given SoundManager.inited is true
- When SoundManager.init() is called again
- Then returns early without error

## Game State Tests (need Phaser/browser)

### Task: restartGame resets all state [R]
**Acceptance Criteria:**
- Given game has been played (score>0, lives<3, wave>1, gameOver=true)
- When restartGame() is called
- Then gameOver is false
- Then score is 0
- Then wave is 1
- Then lives is 3
- Then playerDead is false

### Task: freezeField stops all objects [R]
**Acceptance Criteria:**
- Given active invaders and bullets with velocity
- When freezeField() is called
- Then all objects have velocity 0

### Task: hitPlayer with lives>1 triggers respawn
**Acceptance Criteria:**
- Given lives=3, not invulnerable, not gameOver
- When hitPlayer() is called with enemy bullet
- Then lives becomes 2
- Then playerDead is true
- Then gameOver is false

### Task: hitPlayer with lives=1 triggers game over
**Acceptance Criteria:**
- Given lives=1, not invulnerable, not gameOver
- When hitPlayer() is called with enemy bullet
- Then lives becomes 0
- Then gameOver is true
- Then enemy bullet is recycled

### Task: shoot respects 180ms cooldown
**Acceptance Criteria:**
- Given lastShot is within 180ms of now
- When shoot() is called
- Then no new bullet is created

### Task: hitInvader scores 100 per kill
**Acceptance Criteria:**
- Given score=0, active invader
- When hitInvader() is called
- Then score becomes 100

### Task: hitInvader with 0 remaining triggers wave complete
**Acceptance Criteria:**
- Given 1 invader remains active
- When hitInvader() is called (killing last invader)
- Then wave increments
- Then waveComplete sound plays

### Task: createWave creates correct enemy count
**Acceptance Criteria:**
- Given waveNum=1 (4 rows, 8 cols)
- When createWave(1) is called
- Then 32 active invaders exist

### Task: update() spawns enemy bullets periodically
**Acceptance Criteria:**
- Given game is active, lastEnemyShot is old enough
- When update() is called
- Then an enemy bullet is spawned from a front-row invader

### Task: enemy reaches bottom costs a life [R]
**Acceptance Criteria:**
- Given active invader at y>530
- When update boundary check runs
- Then lives decreases by 1
