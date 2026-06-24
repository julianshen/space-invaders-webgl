# Koi Play Presents — 製作商動畫規格

## 概述
在遊戲開場動畫（Star Wars style crawl）之前，插入一段 3 秒的「Koi play presents」製作商動畫。

## 基本規格

| 項目 | 內容 |
|------|------|
| **動畫名稱** | KoiPlayPresents |
| **總長度** | 3 秒 |
| **播放時機** | 遊戲啟動後最一開始 |
| **結束後** | 直接進入現有 `intro` 階段 |

## 角色動畫

- **素材**：`assets/koi-sprite.png`（4×4 sprite sheet，共 16 幀）
- **動作類型**：扭捏 / 害羞 idle（fidgety shy idle）
- **建議使用幀**（0-based）：
  - 正面：`0, 1, 2, 3, 4, 5, 6, 8, 9`
  - 背面輕轉：`12, 13, 14, 15`
- **Frame rate**：9 fps
- **動畫循環**：3 秒內播 2–3 次

## 文字動畫

- **文字內容**：`Koi play presents`
- **位置**：角色右手邊
- **字體**：monospace，28px，金黃色 `#ffdd00`
- **動畫效果**：
  - 角色淡入時，文字開始打字機效果
  - 打字速度：約 90ms / 字
  - 總共 18 字，約 1.6 秒打完

## 構圖

- **背景**：純黑 `#000000`
- **角色**：置中偏左（約畫面 35% 位置）
- **文字**：角色右手邊，垂直置中
- **角色放大**：建議 3x（因 sprite 尺寸較小）

## 時序表

| 時間 | 事件 |
|------|------|
| 0.0s | 角色從左側淡入，開始播放扭捏動畫 |
| 0.0–0.3s | 文字淡入 + 開始打字機 |
| 0.3–2.8s | 角色持續扭捏 idle |
| 2.8–3.0s | 角色與文字同時淡出 |
| 3.0s+ | 進入現有 `intro` 階段 |

## 技術實作

- **狀態機**：新增 `gamePhase = 'koi-presents'`
- **函數**：`runKoiPresents(scene)`
- **全域變數**：
  - `koiSprite`
  - `koiText`
  - `koiPresentsStart`
  - `koiTypingEvent`

## 檔案位置

- **Sprite sheet**：`assets/koi-sprite.png`
- **需求文件**：`references/koi-play-presents-spec.md`
- **實作程式碼**：`script.js`（`preload`、`create`、`update`、`runKoiPresents`）

## 更新日期
2026-06-23
