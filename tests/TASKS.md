# TASKS.md — Star Wars Opening Crawl + 風格改造

> 改造範圍：片頭動畫 → Star Wars opening crawl。不碰核心遊戲邏輯。

---

## Task 1: Star Wars Opening Crawl 片頭 [R]

**Acceptance Criteria:**
- **Given** 遊戲啟動，gamePhase = 'intro'
- **When** runIntro() 執行
- **Then** 三階段依序播放：
  1. 藍色 "A long time ago in a galaxy far, far away...." 淡入→淡出（~3 秒）
  2. 黃色大字 "SPACE INVADERS" 淡入→淡出（~3 秒）
  3. 黃色 crawl 文字從畫面底部往上捲，底部文字較大（scale 1.0），頂部文字較小（scale 0.4），模擬透視效果
- **Given** crawl 播放完畢
- **When** 動畫結束
- **Then** 回到階段 1 循環
- **Given** 片頭播放中
- **When** 玩家按任意鍵（空白鍵）
- **Then** skipIntro() → 進入 countdown → gameplay（行為不變）

## Task 2: rebuildIntro() 重建 Star Wars 片頭 [R]

**Acceptance Criteria:**
- **Given** gamePhase 從 demo 回到 intro
- **When** rebuildIntro() 被呼叫
- **Then** intro 元素被正確重建，包含 crawl 所需的文字群組
- **Given** rebuildIntro() 完成
- **When** runIntro() 執行
- **Then** crawl 動畫正常播放（與初次載入行為一致）

## Task 3: enterDemo() 清理新 intro 元素

**Acceptance Criteria:**
- **Given** gamePhase = 'gameover'，20 秒後進入 demo
- **When** enterDemo() 被呼叫
- **Then** 所有 intro crawl 元素被正確銷毀，不殘留在 demo 畫面

## Task 4: Demo 排行榜標題 Star Wars 化

**Acceptance Criteria:**
- **Given** gamePhase = 'demo'
- **When** enterDemo() 渲染排行榜
- **Then** 標題為黃色 Star Wars 風格文字
- **Given** 排行榜有分數
- **When** demo 顯示
- **Then** 排名列表正常顯示，樣式一致

## Task 5: 回歸測試 [R]

**Acceptance Criteria:**
- **Given** 所有現有測試（25 個）
- **When** 執行 test-suite.js
- **Then** 全部通過，無 console error
