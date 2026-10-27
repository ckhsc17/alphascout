# AlphaScout 架構設計

> 開源的投資研究**資料整合與視覺化中心**，以 AI-native 的方式操作：使用者用自己的 AI（Claude、ChatGPT、Cursor…）透過 MCP 查資料，並且讓 AI 幫自己組出客製化的 Dashboard。
>
> ⚠️ 本專案僅供研究與教育用途，不構成任何投資建議。

---

## 1. 定位

AlphaScout **本身不跑 LLM**。我們只做三件事：

1. **資料整合**：把台股的價量、籌碼、大戶、內部人資料，以及美股的 13F 機構持倉、Form 4 內部人交易，清洗成一致、可查詢的格式。
2. **視覺化**：預設 Dashboard、個股頁，以及使用者自己的客製 Dashboard。
3. **AI 介面**：MCP Server 是一級公民，查資料和建 Dashboard 都能透過它完成。

「智慧」由使用者自己的 AI 提供，token 也由使用者自己付。這帶來的好處：

- 營運成本只有資料庫和 hosting，沒有 LLM 帳單，也不用管 API key。
- 使用者可以用最習慣、最強的 AI，不被我們選的模型綁住。
- 專案專心把資料做對、做完整，這才是真正難、有護城河的部分。

網站上的聊天功能放到最後才做，而且只支援 BYOK（使用者自帶 key，只存在他的瀏覽器）。

## 2. 設計原則

1. **數字由程式算，AI 只負責解讀。** 指標、篩選、持倉差異全部是 deterministic 的 TypeScript / SQL，回傳給 AI 的都是算好的數字。
2. **重運算離線做，線上只讀。** 抓資料、算指標、算 13F 差異都在 GitHub Actions 排程裡完成並寫入資料庫。Vercel 上只做讀取和輕量查詢。
3. **一套 Dataset，三個出口。** `packages/core/datasets` 定義所有資料集（參數與輸出都是 Zod schema）。網站的圖表、MCP 的 tools、使用者的 Dashboard widget 都查同一份 dataset，這是整個系統的核心抽象。
4. **AI 只輸出宣告式 JSON，不輸出 SQL 或程式碼。** 篩選條件和 Dashboard widget 都是經過 Zod 驗證的 JSON，由後端編譯成參數化查詢，或交給前端固定的元件渲染。
5. **Widget 存的是查詢，不是資料。** Dashboard 每次打開都是最新數據，AI 建一次之後就會自動更新。

---

## 3. 系統總覽

```
 ┌───────────────────────────────┐
 │  使用者自己的 AI                 │  「幫我建一個追蹤巴菲特和投信連買的 dashboard」
 │  (Claude / ChatGPT / Cursor)   │
 └──────────────┬────────────────┘
                │ MCP (Streamable HTTP)：查資料、建/改 dashboard
                ▼
 ┌──────────────────────────────────────────┐       ┌──────────────┐
 │ apps/web  (Next.js on Vercel)             │◀──────│   瀏覽器       │
 │  ├─ /                 預設 Dashboard       │──────▶│ 看 dashboard │
 │  ├─ /s/[symbol]       個股頁               │       └──────────────┘
 │  ├─ /investors/[id]   大佬持倉頁            │
 │  ├─ /d/[id]           使用者客製 Dashboard   │
 │  ├─ /api/v1/*         REST（給圖表/外部用）   │
 │  └─ /api/mcp          MCP Server           │
 └──────────────┬───────────────────────────┘
                │ packages/core：datasets、screener、widget spec
                ▼
 ┌──────────────────────────────────────────┐
 │ Neon Postgres（經 Vercel Marketplace）       │
 │ 市場資料 / 指標快照 / 13F / 內部人 /          │
 │ users / api_keys / dashboards / widgets   │
 └──────────────▲───────────────────────────┘
                │ 寫入
 ┌──────────────┴───────────────────────────┐
 │ jobs/  (GitHub Actions cron)              │
 │  tw-daily    價量、法人 → 指標快照 → 策略      │
 │  tw-weekly   集保股權分散                    │
 │  tw-monthly  月營收                         │
 │  us-insider  Form 4（每日）                  │
 │  us-13f      13F（申報季每日掃描）             │
 └──────────────▲───────────────────────────┘
                │
   TWSE / TPEx / MOPS / TDCC / FinMind / SEC EDGAR / OpenFIGI
```

### 為什麼 ingestion 放 GitHub Actions 而不是 Vercel Cron？

- Vercel function 有執行時間上限，Hobby 方案的 Cron 頻率也受限，一次抓全市場容易超時。
- 公開 repo 的 GitHub Actions 免費、可以跑很久，log 也是公開的，大家都看得到資料怎麼來。
- 失敗可以手動重跑（`workflow_dispatch`），contributor 在本地也能用同一支 script 跑。

---

## 4. Tech Stack

| 層                     | 選擇                                                                  | 理由                                                                                         |
| ---------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 語言                   | **TypeScript（全專案）**                                              | 型別從 DB schema 一路貫穿到 dataset、MCP tool、widget。指標自己實作，不依賴 TA-Lib 的 C 擴充 |
| Monorepo               | **pnpm workspaces + Turborepo**                                       | 標準、快、Vercel 原生支援                                                                    |
| Web                    | **Next.js（App Router）**                                             | Vercel 一等公民；RSC 直接讀 DB                                                               |
| UI                     | **Tailwind CSS + shadcn/ui**                                          | 開源專案友善                                                                                 |
| 圖表                   | **TradingView Lightweight Charts**（K 線）＋ **Recharts**（一般圖表） | K 線專業；其餘 widget 型別用 Recharts 涵蓋                                                   |
| Dashboard 版面         | **react-grid-layout**                                                 | 可拖拉、可縮放，PostHog 式的格狀版面                                                         |
| MCP                    | **`mcp-handler` + `@modelcontextprotocol/sdk`**                       | 掛在 Next.js route，和網站同一個部署                                                         |
| 驗證                   | **Zod**                                                               | dataset 參數、篩選 DSL、widget spec、API 邊界共用                                            |
| DB                     | **Neon Postgres**（透過 Vercel Marketplace）                          | serverless Postgres，免費額度夠 MVP；env 自動注入 Vercel；之後新聞 RAG 可開 `pgvector`       |
| Auth                   | **Better Auth**（GitHub 登入）＋ MCP OAuth plugin                     | 開源、資料存在自己的 Postgres；內建 MCP OAuth 支援，讓 Claude.ai / ChatGPT 能登入            |
| ORM                    | **Drizzle ORM + drizzle-kit**                                         | 型別安全，migration 用檔案管理                                                               |
| XML 解析               | **fast-xml-parser**                                                   | 解析 13F information table 與 Form 4                                                         |
| Rate limit             | **Upstash Redis**（Vercel Marketplace）                               | serverless 友善                                                                              |
| 測試 / Lint            | **Vitest** / **Biome**                                                | 指標、DSL、13F 差異計算都要有單元測試                                                        |
| CI / 排程              | **GitHub Actions**                                                    |                                                                                              |
| 聊天（最後一個 phase） | **Vercel AI SDK**，BYOK                                               | 只在瀏覽器端用使用者的 key，伺服器不經手                                                     |

---

## 5. Repo 結構

```
alphascout/
├── apps/
│   └── web/                  Next.js：頁面、REST、/api/mcp
├── packages/
│   ├── core/                 純邏輯，不依賴框架
│   │   ├── providers/        資料源 adapter（twse, tpex, mops, tdcc, finmind, edgar, openfigi）
│   │   ├── indicators/       SMA/EMA/RSI/MACD/BBands/ATR + 測試
│   │   ├── datasets/         ★ 資料集註冊表：params schema、output schema、query
│   │   ├── screener/         篩選 DSL：schema + SQL 編譯器
│   │   ├── dashboards/       widget spec schema、驗證
│   │   └── mcp/              MCP tools / resources / prompts（薄薄一層包 datasets）
│   └── db/                   Drizzle schema、client、migrations
├── jobs/                     ingestion 與計算腳本
├── docs/
└── .github/workflows/
```

---

## 6. Datasets：核心抽象

每個 dataset 是一個具名、有參數、回傳表格資料的查詢：

```ts
defineDataset({
  id: "tw.institutional_flows",
  description: "台股個股三大法人每日買賣超（張）",
  params: z.object({ symbol: z.string(), days: z.number().int().max(250).default(60) }),
  columns: { date: "date", foreign_net: "number", trust_net: "number", dealer_net: "number" },
  query: (db, params) => ...,
});
```

初版 dataset 清單：

| 市場 | Dataset                  | 內容                                                |
| ---- | ------------------------ | --------------------------------------------------- |
| TW   | `tw.prices`              | 日 K                                                |
| TW   | `tw.technicals`          | 指標快照時間序列                                    |
| TW   | `tw.institutional_flows` | 三大法人                                            |
| TW   | `tw.major_holders`       | 集保股權分散：千張大戶持股比例、人數（每週）        |
| TW   | `tw.insider_transfers`   | 內部人持股轉讓申報                                  |
| TW   | `tw.monthly_revenue`     | 月營收、YoY、MoM                                    |
| TW   | `tw.screen`              | 執行篩選 DSL                                        |
| TW   | `tw.leaderboard`         | 排行（法人連買、大戶增幅、營收創新高…）             |
| US   | `us.investors`           | 追蹤中的機構（Berkshire、Scion、Bridgewater、ARK…） |
| US   | `us.13f_holdings`        | 某機構某季持倉                                      |
| US   | `us.13f_changes`         | 季對季差異：新建倉 / 清倉 / 加碼 / 減碼             |
| US   | `us.13f_consensus`       | 多位大佬同時持有或同時加碼的標的                    |
| US   | `us.insider_trades`      | Form 4 交易（可篩選只看公開市場買進，代碼 `P`）     |
| US   | `us.insider_clusters`    | 同一家公司短期內多位內部人一起買進                  |

MCP、REST、widget 全部透過 dataset id + params 取資料，所以**新增一個 dataset，三個出口會同時拿到它**。

---

## 7. 篩選 DSL

```jsonc
{
  "market": "TW",
  "all": [
    { "field": "close", "op": "crosses_above", "ref": "sma20" },
    { "field": "trust_net_buy_streak", "op": ">=", "value": 3 },
    { "field": "major_holder_pct_change_4w", "op": ">", "value": 1 },
    { "field": "avg_volume_20d", "op": ">", "value": 1000 }
  ],
  "sort": { "field": "rsi14", "dir": "asc" },
  "limit": 30
}
```

- `field` 有白名單（對應 `tw_indicator_snapshots` 的欄位），不在白名單內直接被 Zod 拒絕，錯誤訊息會列出可用的欄位，讓 AI 自己修正。
- 支援 `all` / `any` 巢狀條件、比較運算子、`crosses_above/below`。
- `limit` 有上限。

---

## 8. AI-native Dashboard

詳見 [DASHBOARDS.md](./DASHBOARDS.md)。概念上類似 PostHog：使用者跟自己的 AI 說「幫我做一個追蹤半導體股投信動向的 dashboard」，AI 透過 MCP 呼叫 `create_dashboard` 和 `add_widget`，回傳網址，打開就能看，而且每天自動更新。

---

## 9. MCP Server

詳見 [MCP.md](./MCP.md)。

- 讀取類 tools：匿名就能用，有 rate limit。
- Dashboard 讀寫類 tools：需要登入。Claude.ai、ChatGPT 等走 MCP OAuth；開發者工具可以用 API key。

---

## 10. 資料模型（初版）

**台股**

| 表                       | 主鍵                      | 內容                                                                                                                     |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `securities`             | `id`                      | market(TW/US), symbol, name, industry, board, cusip?, cik?, is_active                                                    |
| `tw_daily_prices`        | (security_id, date)       | OHLCV、成交金額                                                                                                          |
| `tw_institutional_flows` | (security_id, date)       | foreign_net, trust_net, dealer_net                                                                                       |
| `tw_shareholding_dist`   | (security_id, week_date)  | 各級距持股人數與比例；衍生欄位：千張大戶比例                                                                             |
| `tw_insider_transfers`   | `id`                      | 申報人、身分、轉讓方式、股數、申報日                                                                                     |
| `tw_monthly_revenue`     | (security_id, year_month) | revenue, mom, yoy                                                                                                        |
| `tw_indicator_snapshots` | (security_id, date)       | 均線、RSI、MACD、BB、ATR、量能、52 週高低、法人連買天數、大戶變化、營收 YoY…（**篩選唯一查詢來源**，刻意反正規化成寬表） |

**美股：大佬追蹤**

| 表                  | 主鍵                            | 內容                                                                                         |
| ------------------- | ------------------------------- | -------------------------------------------------------------------------------------------- |
| `us_investors`      | `cik`                           | 名稱、經理人、類型、是否在預設追蹤名單                                                       |
| `us_13f_filings`    | `accession_no`                  | cik, period_of_report, filed_at, total_value, is_amendment                                   |
| `us_13f_holdings`   | (accession_no, cusip, put_call) | issuer, class, value, shares                                                                 |
| `us_13f_changes`    | (cik, period, cusip)            | 預先算好：action(new/exit/add/trim)、股數與比例變化、佔投組權重                              |
| `cusip_map`         | `cusip`                         | ticker、figi、來源（OpenFIGI）——13F 只有 CUSIP，需要對應成 ticker                            |
| `us_insider_trades` | (accession_no, line)            | issuer_cik, ticker, insider, role, txn_date, code(P/S/…), shares, price, value, shares_after |

**平台**

| 表                                | 內容                                                                      |
| --------------------------------- | ------------------------------------------------------------------------- |
| `screens` / `screen_results`      | 預設策略與每日結果                                                        |
| `user` / `session` / `account` 等 | Better Auth 管理的帳號表（GitHub 登入）                                   |
| `api_keys`                        | user_id、key 的 hash、prefix、last_used_at、revoked_at                    |
| `dashboards`                      | owner_id、title、description、visibility(private/unlisted/public)、layout |
| `widgets`                         | dashboard_id、spec(jsonb, 已驗證)、position                               |
| `ingest_runs`                     | job、狀態、筆數、錯誤，用來顯示資料新鮮度                                 |

---

## 11. 安全與合規

- **免責聲明**：網站頁尾、MCP server 說明、大佬追蹤頁（「13F 有最多 45 天延遲，且只含美股多頭部位」）都要放。
- **資料授權**：只用官方開放資料或允許再散布的來源，詳見 [DATA_SOURCES.md](./DATA_SOURCES.md)。
- **SEC 存取規範**：requests 必須帶有聯絡資訊的 `User-Agent`，並且遵守每秒 10 次的請求上限。
- **Secrets**：`DATABASE_URL` 與 auth secret 只放在 GitHub Actions secrets 和 Vercel server env。
- **存取控制**：瀏覽器永遠不直接連資料庫，所有存取都經過伺服器端。jobs 用可寫入的連線；網站與 MCP 讀取市場資料時用唯讀角色；dashboards 依 owner 與 visibility 在應用層檢查權限。
- **API key**：只存 hash，可以撤銷。
- **Widget 安全**：widget spec 是純宣告式 JSON，前端只用固定元件渲染，不執行任何使用者或 AI 提供的程式碼。
