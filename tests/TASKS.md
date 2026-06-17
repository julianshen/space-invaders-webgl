### Task: 片頭循環播放 [R]
**Acceptance Criteria:**
- Given 遊戲剛載入
- When 5.5 秒後
- Then gamePhase 仍是 'intro'
- And introAliens 長度仍為 8
- And introStartTime 被重設（回到接近 scene.time.now）

### Task: 空白鍵跳過片頭進倒數
**Acceptance Criteria:**
- Given gamePhase 為 'intro'
- When skipIntro() 被呼叫
- Then gamePhase 變為 'countdown'
- And countdownTexts.ready 存在
- And countdownTexts.go 存在
- And introAliens 被清空
- And introTexts 被清空

### Task: 倒數 READY? → GO! → 遊戲開始 [R]
**Acceptance Criteria:**
- Given gamePhase 為 'countdown'，countdownStart 為 2.5 秒前
- When runCountdown() 被呼叫
- Then gamePhase 變為 'playing'
- And player 存在
- And invaders 群組有活躍敵人
- And countdownTexts 被清空

### Task: 遊戲中按空白鍵不會觸發倒數
**Acceptance Criteria:**
- Given gamePhase 為 'playing'
- When 空白鍵被按下
- Then gamePhase 仍為 'playing'（不進 countdown）
