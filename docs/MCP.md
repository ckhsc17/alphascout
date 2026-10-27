# MCP Server 設計

MCP 是 AlphaScout 的主要介面，不是附加功能。使用者用自己的 AI 查資料、做分析、建 Dashboard。

- 公開 endpoint：`https://alphascout-tw.vercel.app/api/mcp`（Streamable HTTP，免登入，只有讀取 tools）
- 帳號 endpoint：`https://alphascout-tw.vercel.app/api/mcp/account`（OAuth 2.1，讀取 ＋ Dashboard tools）
- 實作：Next.js route handler + `mcp-handler`，與網站同一個部署
- Server 端**不呼叫 LLM**，也不提供任何下單功能

## 認證

| 等級    | 方式                                                       | 能做什麼                               |
| ------- | ---------------------------------------------------------- | -------------------------------------- |
| 匿名    | 無                                                         | 所有讀取類 tools，依 IP 限流           |
| OAuth   | MCP 規範的 OAuth 流程，由 Better Auth 提供（GitHub 登入）  | 讀取額度較高 ＋ Dashboard 讀寫         |
| API key | `Authorization: Bearer as_...`（網站登入後產生，尚未實作） | 同 OAuth，給能自訂 header 的開發者工具 |

連到帳號 endpoint 時，server 回 401 並在 `WWW-Authenticate` 指向 `/.well-known/oauth-protected-resource/api/mcp/account`。Client 依此找到授權伺服器（`/api/auth`），支援 Client ID Metadata Document 與動態註冊，使用者在瀏覽器用 GitHub 登入、同意授權後取得 token。

OAuth 是主要方式：Claude.ai、Claude Desktop、ChatGPT 等介面加入遠端 MCP 時走 OAuth，無法自帶 header。API key 給 Claude Code、Cursor、腳本等開發者工具。

## Tools

### 探索

| Tool                | 說明                                     |
| ------------------- | ---------------------------------------- |
| `list_datasets`     | 列出所有 dataset 與一句話說明            |
| `describe_dataset`  | 參數 schema、欄位、範例                  |
| `query_dataset`     | 通用查詢：dataset id + params → 表格資料 |
| `search_securities` | 用代號或名稱找標的（台股、美股）         |

### 常用捷徑（底層都是 `query_dataset`，但對 AI 更好用）

| Tool                   | 說明                                                   |
| ---------------------- | ------------------------------------------------------ |
| `get_stock_overview`   | 一次拿到個股的技術面快照、法人、大戶、營收／內部人摘要 |
| `screen_tw_stocks`     | 執行篩選 DSL                                           |
| `get_investor_moves`   | 某位大佬最新一季的新建倉、清倉、加碼、減碼             |
| `get_insider_activity` | 美股內部人交易，可篩選只看公開市場買進、集體買進       |
| `get_consensus_picks`  | 多位大佬同時持有或同時加碼的標的                       |

### Dashboard（帳號 endpoint 專用）

| Tool                                             | 說明                                                |
| ------------------------------------------------ | --------------------------------------------------- |
| `list_dashboards`                                | 我的 dashboards                                     |
| `get_dashboard`                                  | 取得 dashboard 與所有 widget spec                   |
| `create_dashboard`                               | title、description、visibility → 回傳 id 與網址     |
| `update_dashboard` / `delete_dashboard`          | 改名、改公開設定、刪除                              |
| `add_widget` / `update_widget` / `remove_widget` | widget spec 規格見 [DASHBOARDS.md](./DASHBOARDS.md) |
| `list_viz_types`                                 | 可用的圖表類型與設定說明                            |

## Resources

- `alphascout://datasets` — 所有 dataset 的完整說明
- `alphascout://screener/fields` — 可篩選欄位
- `alphascout://investors` — 預設追蹤的大佬名單與 CIK
- `alphascout://widget-spec` — widget JSON schema

## Prompts

- `analyze_stock(symbol)` — 技術面、籌碼面、基本面，整理多空理由與風險
- `investor_quarterly_review(investor)` — 大佬本季動向解讀
- `build_dashboard(goal)` — 引導 AI 依目標規劃並建立 dashboard

## 回傳設計規則

- 每個回傳都帶有 `as_of`（資料日期）與 `source`。
- 數字先四捨五入並附上單位，list 型回傳有筆數上限，節省使用者端的 context。
- 錯誤訊息要能讓 AI 自己修正，例如：「field `rsi` 不存在，可用：rsi14, …」。

## 使用者端設定

```jsonc
{
  "mcpServers": {
    "alphascout": {
      "url": "https://alphascout-tw.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer as_xxx" } // 選填，只查資料可以不用
    }
  }
}
```
