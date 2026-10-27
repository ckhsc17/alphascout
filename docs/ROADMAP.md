# Roadmap

每個 Phase 結束時都是可部署、可展示的狀態。

## Phase 0 — 地基

- [x] Monorepo（pnpm + Turborepo）、Biome、Vitest、CI
- [x] Neon 資料庫（Vercel Marketplace）、Drizzle schema、第一個 migration
- [x] Next.js 部署到 Vercel（空殼頁面 + 免責聲明）

## Phase 1 — 資料層

- [x] 台股：TWSE / TPEx 價量與法人
- [x] 台股：MOPS 月營收、TDCC 股權分散、內部人轉讓（後兩者官方只提供最新一期，從 2026-10 開始逐日累積）
- [x] 美股：EDGAR 13F（22 位大佬）＋ OpenFIGI CUSIP 對照、Form 4
- [x] `indicators` 與指標快照、13F 季對季差異（都要有測試）
- [x] Backfill：台股近 1 年、13F 近 8 季、Form 4 近 1 個月
- [x] GitHub Actions 排程、`ingest_runs` 資料新鮮度紀錄

## Phase 2 — Datasets + 唯讀 MCP + 預設頁面

- [x] `packages/core/datasets` 註冊表（15 個 dataset）
- [x] 篩選 DSL 與 5 個預設策略
- [x] `/api/mcp` 唯讀 tools、resources、prompts
- [x] 網站：首頁雷達、策略頁、個股頁、大佬持倉頁、內部人交易頁、MCP 說明頁

## Phase 3 — AI-native Dashboard

- [x] Better Auth（GitHub 登入）
- [x] MCP OAuth（給 Claude.ai / ChatGPT 等）
- [ ] API key（給開發者工具）
- [x] Widget spec 與渲染元件
- [x] MCP dashboard 讀寫 tools
- [x] `/d/[id]` 頁面：版面編輯、分享、fork

## Phase 4 — 擴充

- [x] 籌碼補充：融資融券、外資持股比例、當沖比（含篩選欄位與「法人默默買、散戶退場」策略）
- [ ] 分點券商進出

- [ ] 策略回測與公開績效
- [ ] 國會議員交易、ARK 每日交易
- [ ] MCP Apps（widget 直接顯示在對話中）
- [ ] Telegram / Discord 推播
- [ ] Heatmap 等更多 viz 類型

## Phase 5 — 網站聊天（BYOK）

- [ ] 瀏覽器端聊天，使用者自帶 LLM key，key 不經過我們的伺服器
- [ ] 用的是和 MCP 相同的 tools
