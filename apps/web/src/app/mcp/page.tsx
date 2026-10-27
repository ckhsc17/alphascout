import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "MCP" };

const ENDPOINT = "https://alphascout-bowens-projects-f3ea0750.vercel.app/api/mcp";

const TOOLS = [
  ["list_datasets / describe_dataset / query_dataset", "探索並查詢所有資料集（15 個）"],
  ["search_securities", "用代號或名稱找台股"],
  ["get_stock_overview", "台股個股一次看：技術面、三大法人、千張大戶、月營收"],
  ["screen_tw_stocks", "用條件或預設策略篩選台股"],
  ["get_investor_moves", "大佬 13F 季度新建倉、加碼、減碼、清倉"],
  ["get_consensus_picks", "多位大佬同時買進或持有的標的"],
  ["get_insider_activity", "美股內部人交易與集體買進"],
];

const EXAMPLES = [
  "今天投信連買又剛站上月線的台股有哪些？",
  "幫我分析 2330 的籌碼和營收動能",
  "巴菲特上一季新買了什麼、賣掉了什麼？",
  "最近 30 天哪些美股公司有多位內部人一起買進？",
  "找出營收 YoY 超過 30%、外資連買 3 天以上的半導體股",
];

export default function McpPage() {
  return (
    <main className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">用你自己的 AI 查 AlphaScout</h1>
        <p className="mt-1 text-sm text-muted">
          AlphaScout 提供 MCP（Model Context Protocol）server。把它加進 Claude、Cursor 等支援遠端
          MCP 的 AI，就能直接用自然語言查詢資料，不需要打開網頁。目前不需要登入，也不需要 API key。
        </p>
      </div>

      <Card title="連線網址">
        <code className="block overflow-x-auto rounded-md bg-background px-3 py-2 text-sm">
          {ENDPOINT}
        </code>
      </Card>

      <Card title="設定方式">
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-medium">Claude.ai / Claude Desktop</h3>
            <p className="mt-1 text-muted">
              設定 → Connectors → Add custom connector，貼上上面的網址。
            </p>
          </div>
          <div>
            <h3 className="font-medium">Claude Code</h3>
            <pre className="mt-1 overflow-x-auto rounded-md bg-background px-3 py-2 text-xs">
              {`claude mcp add --transport http alphascout ${ENDPOINT}`}
            </pre>
          </div>
          <div>
            <h3 className="font-medium">Cursor 及其他使用 JSON 設定的 client</h3>
            <pre className="mt-1 overflow-x-auto rounded-md bg-background px-3 py-2 text-xs">
              {JSON.stringify({ mcpServers: { alphascout: { url: ENDPOINT } } }, null, 2)}
            </pre>
          </div>
        </div>
      </Card>

      <Card title="可以這樣問">
        <ul className="list-inside list-disc space-y-1 text-sm">
          {EXAMPLES.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </Card>

      <Card title="Tools">
        <dl className="space-y-2 text-sm">
          {TOOLS.map(([name, desc]) => (
            <div key={name}>
              <dt className="font-mono text-xs">{name}</dt>
              <dd className="text-muted">{desc}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <p className="text-xs text-muted">
        使用限制：每個 IP 每分鐘最多 120 次請求。資料僅供研究與教育用途，不構成投資建議。
      </p>
    </main>
  );
}
