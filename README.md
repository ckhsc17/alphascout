# AlphaScout

開源的投資研究資料整合與視覺化中心，**AI-native**：用你自己的 AI，透過 MCP 查詢台股籌碼、美股大佬持倉與內部人交易，還能讓 AI 幫你建一個每天自動更新的客製 Dashboard。

> ⚠️ 本專案僅供研究與教育用途，所有內容不構成投資建議。投資有風險，請自行判斷。

## 功能（開發中）

- **台股雷達**：技術面、三大法人、千張大戶、內部人轉讓、月營收，搭配策略篩選
- **美股大佬追蹤**：13F 機構持倉季對季變化（Berkshire、Scion、Bridgewater…），以及 Form 4 內部人買進
- **MCP Server**：在 Claude / ChatGPT / Cursor 裡直接查資料
- **AI-native Dashboard**：跟你的 AI 說想看什麼，它透過 MCP 幫你建好 dashboard

AlphaScout 本身不跑 LLM，所以不需要我們的 API key，你用的是你自己的 AI。

## 文件

- [架構設計](docs/ARCHITECTURE.md)
- [資料來源](docs/DATA_SOURCES.md)
- [MCP Server](docs/MCP.md)
- [AI-native Dashboard](docs/DASHBOARDS.md)
- [Roadmap](docs/ROADMAP.md)

## Tech Stack

TypeScript · Next.js · MCP · Supabase（Postgres + Auth）· Drizzle · Tailwind + shadcn/ui · Lightweight Charts · Recharts · Turborepo · GitHub Actions · Vercel

## 開發

```bash
corepack enable          # 啟用 pnpm
pnpm install
cp .env.example .env.local
pnpm dev
```

## License

[MIT](LICENSE)
