### Task: Game Over 20 秒無動作 → 進 demo [R]
**Acceptance Criteria:**
- Given gamePhase 為 'gameover' 且已過 20 秒無按鍵
- When update() 執行
- Then gamePhase 變為 'demo'
- And demo 畫面顯示排行榜

### Task: Game Over 期間有按鍵 → 重設 idle timer [R]
**Acceptance Criteria:**
- Given gamePhase 為 'gameover'，idle 了 15 秒
- When 使用者按空白鍵
- Then idle timer 被重設為 0
- And 觸發 restartGame()

### Task: 排行榜存 localStorage [R]
**Acceptance Criteria:**
- Given 本次 score=5000，localStorage 已有分數 [1000, 800, 300]
- When saveHighScore() 被呼叫
- Then 排行榜前 10 名包含 5000 且排序正確

### Task: Demo 畫面顯示排行榜
**Acceptance Criteria:**
- Given 排行榜有 5 筆分數
- When demo 畫面顯示
- Then 畫面出現 "HIGH SCORES" 標題
- And 顯示排名 1~5 的分數

### Task: Demo 期間按鍵 → 回 intro
**Acceptance Criteria:**
- Given gamePhase 為 'demo'
- When 按任意鍵
- Then gamePhase 變為 'intro'
- And demo 文字被清除
