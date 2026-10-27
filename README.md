<p align="center">
  <img src="docs/assets/wordmark-light.svg" alt="AlphaScout" width="480">
</p>

# AlphaScout

網站：<https://alphascout-tw.vercel.app>

開源的投資研究資料整合與視覺化中心，**AI-native**：用你自己的 AI，透過 MCP 查詢台股籌碼、美股大佬持倉與內部人交易，還能讓 AI 幫你建一個每天自動更新的客製 Dashboard。

> ⚠️ 本專案僅供研究與教育用途，所有內容不構成投資建議。投資有風險，請自行判斷。

## 功能（開發中）

- **台股雷達**：技術面、三大法人、千張大戶、內部人轉讓、月營收，搭配策略篩選
- **美股大佬追蹤**：13F 機構持倉季對季變化（Berkshire、Scion、Bridgewater…），以及 Form 4 內部人買進
- **MCP Server**：在 Claude / ChatGPT / Cursor 裡直接查資料
- **AI-native Dashboard**：跟你的 AI 說想看什麼，它透過 MCP 幫你建好 dashboard

AlphaScout 本身不跑 LLM，所以不需要我們的 API key，你用的是你自己的 AI。

## 用你的 AI 連上 AlphaScout（MCP）

在支援遠端 MCP 的 client（Claude Code、Claude Desktop、Cursor…）加入：

```json
{
  "mcpServers": {
    "alphascout": { "url": "https://alphascout-tw.vercel.app/api/mcp" }
  }
}
```

想讓 AI 幫你建 dashboard，改用帳號版網址 `https://alphascout-tw.vercel.app/api/mcp/account`，第一次連線時會跳出 GitHub 登入授權。

然後直接問：「今天投信連買又剛站上月線的台股有哪些？」「巴菲特上一季新買了什麼？」「最近 30 天有哪些美股公司出現多位內部人一起買進？」

| Tool                                                   | 用途                                         |
| ------------------------------------------------------ | -------------------------------------------- |
| `list_datasets` / `describe_dataset` / `query_dataset` | 探索並查詢所有資料集                         |
| `search_securities`                                    | 以代號或名稱找台股                           |
| `get_stock_overview`                                   | 台股個股：技術面、三大法人、千張大戶、月營收 |
| `screen_tw_stocks`                                     | 用條件或預設策略篩選台股                     |
| `get_investor_moves`                                   | 大佬 13F 季度增減持                          |
| `get_consensus_picks`                                  | 多位大佬同時買進／持有的標的                 |
| `get_insider_activity`                                 | 美股內部人交易與集體買進                     |

## 文件

- [架構設計](docs/ARCHITECTURE.md)
- [資料來源](docs/DATA_SOURCES.md)
- [MCP Server](docs/MCP.md)
- [AI-native Dashboard](docs/DASHBOARDS.md)
- [Roadmap](docs/ROADMAP.md)

## Tech Stack

TypeScript · Next.js · MCP · Neon Postgres · Better Auth · Drizzle · Tailwind + shadcn/ui · Lightweight Charts · Recharts · Turborepo · GitHub Actions · Vercel

## 開發

```bash
corepack enable          # 啟用 pnpm
pnpm install
vercel env pull .env.local   # 或 cp .env.example .env.local 自行填入
pnpm dev
```

## License

[MIT](LICENSE)
