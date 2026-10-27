# AI-native Dashboard

目標：使用者不需要學任何 UI，跟自己的 AI 說一句話，就能拿到一個會每天自動更新的 Dashboard。

```
使用者：「幫我做一個 dashboard：巴菲特和 Burry 最新一季的動作、
        美股近 30 天內部人集體買進、還有台股投信連買前 20 名」

AI（透過 MCP）：
  1. list_datasets / describe_dataset   → 了解有哪些資料可用
  2. query_dataset（試查）               → 確認資料長相，選擇適合的圖表
  3. create_dashboard                   → 建立 dashboard
  4. add_widget × N                     → 加入 widget
  5. 回傳 https://alphascout.../d/abc123
```

## Widget Spec

Widget = **資料來源（dataset + params）+ 呈現方式（viz）**，全部都是宣告式 JSON：

```jsonc
{
  "title": "Berkshire 本季持倉變化",
  "dataset": "us.13f_changes",
  "params": { "cik": "0001067983", "period": "latest" },
  "viz": {
    "type": "table",
    "columns": ["ticker", "action", "shares_change_pct", "weight"],
    "sort": { "field": "weight", "dir": "desc" }
  }
}
```

### Viz 類型（初版）

| type | 用途 | 必要設定 |
|---|---|---|
| `candlestick` | K 線，可疊加均線 | `overlays?` |
| `line` / `area` | 時間序列 | `x`, `y[]` |
| `bar` | 比較、買賣超 | `x`, `y[]`, `stacked?` |
| `table` | 清單、排行 | `columns`, `sort?` |
| `stat` | 單一數字（KPI） | `value`, `compare?` |
| `heatmap` | 產業／標的強弱 | `x`, `y`, `value` |
| `text` | Markdown 說明（AI 可以寫上這個 dashboard 的解讀） | `markdown` |

驗證規則：
- `params` 必須通過該 dataset 的 Zod schema。
- `viz` 裡引用的欄位必須存在於該 dataset 的 `columns`。
- 驗證失敗時，回傳讓 AI 看得懂、可以自我修正的錯誤訊息。

### 動態參數

params 支援相對值，讓 dashboard 保持最新：`"period": "latest"`、`"date": "today"`、`"days": 30`。

## 權限與分享

| visibility | 誰能看 |
|---|---|
| `private` | 只有 owner（網站登入，或 MCP 帶 owner 的 API key） |
| `unlisted` | 知道網址的人 |
| `public` | 所有人，並可出現在「社群 dashboards」列表 |

預設 `unlisted`，方便 AI 建完直接把連結丟給使用者。

## 網站端

- `/d/[id]`：用 react-grid-layout 排版；登入的 owner 可以拖拉調整版面、刪除 widget。
- 每個 widget 有「複製 spec」按鈕，方便貼給 AI 修改，或分享給別人。
- 「Fork」：把別人公開的 dashboard 複製一份到自己帳號。

## 未來

- **MCP Apps**：在支援的 AI client 裡，widget 直接以互動 UI 顯示在對話中，不必跳出到網站。
- Dashboard 模板（大佬追蹤、籌碼雷達、營收動能），讓 AI 從模板開始改。
