import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "MCP" };

const ENDPOINT = "https://alphascout-tw.vercel.app/api/mcp";
const ACCOUNT_ENDPOINT = `${ENDPOINT}/account`;

const TOOLS = [
  ["list_datasets / describe_dataset / query_dataset", "探索並查詢所有資料集（15 個）"],
  ["search_securities", "用代號或名稱找台股"],
  ["get_stock_overview", "台股個股一次看：技術面、三大法人、千張大戶、月營收"],
  ["screen_tw_stocks", "用條件或預設策略篩選台股"],
  ["get_investor_moves", "大佬 13F 季度新建倉、加碼、減碼、清倉"],
  ["get_consensus_picks", "多位大佬同時買進或持有的標的"],
  ["get_insider_activity", "美股內部人交易與集體買進"],
];

const DASHBOARD_TOOLS = [
  ["list_viz_types", "可用的圖表類型與 spec 範例"],
  ["list_dashboards / get_dashboard", "查看你的 dashboards"],
  ["create_dashboard / update_dashboard / delete_dashboard", "建立、改名、改公開設定、刪除"],
  ["add_widget / update_widget / remove_widget", "用任一資料集加圖表，AI 會自動排版"],
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
          MCP 的 AI，就能直接用自然語言查詢資料，不需要打開網頁。查資料不需要登入；想讓 AI 幫你建
          dashboard，再用 GitHub 登入即可。
        </p>
      </div>

      <Card title="連線網址">
        <div className="space-y-3 text-sm">
          <div>
            <h3 className="font-medium">公開版：只查資料，免登入</h3>
            <code className="mt-1 block overflow-x-auto rounded-md bg-background px-3 py-2">
              {ENDPOINT}
            </code>
          </div>
          <div>
            <h3 className="font-medium">帳號版：查資料＋讓 AI 建 dashboard</h3>
            <code className="mt-1 block overflow-x-auto rounded-md bg-background px-3 py-2">
              {ACCOUNT_ENDPOINT}
            </code>
            <p className="mt-1 text-muted">
              第一次連線時，AI client 會開啟瀏覽器讓你用 GitHub
              登入並授權。下面的設定方式兩個網址都適用。
            </p>
          </div>
        </div>
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

      <Card title="Dashboard tools（帳號版）">
        <dl className="space-y-2 text-sm">
          {DASHBOARD_TOOLS.map(([name, desc]) => (
            <div key={name}>
              <dt className="font-mono text-xs">{name}</dt>
              <dd className="text-muted">{desc}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted">
          試試看：「幫我建一個 dashboard，放 2330 的 K 線、外資買賣超，還有月營收 YoY」
        </p>
      </Card>

      <p className="text-xs text-muted">
        使用限制：每個 IP 每分鐘最多 120 次請求。資料僅供研究與教育用途，不構成投資建議。
      </p>
    </main>
  );
}
