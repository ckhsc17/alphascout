const features = [
  {
    title: "台股雷達",
    body: "技術面、三大法人、千張大戶、內部人轉讓、月營收，搭配策略篩選。",
  },
  {
    title: "美股大佬追蹤",
    body: "13F 機構持倉季對季變化，以及 Form 4 內部人公開市場買進。",
  },
  {
    title: "MCP Server",
    body: "在 Claude、ChatGPT、Cursor 裡直接查資料，不必打開網頁。",
  },
  {
    title: "AI-native Dashboard",
    body: "跟你的 AI 說想看什麼，它會透過 MCP 幫你建好每天自動更新的 dashboard。",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">AlphaScout</h1>
      <p className="mt-4 text-lg text-foreground/70">
        開源的投資研究資料整合與視覺化中心。用你自己的 AI 查詢資料、建立 dashboard。
      </p>
      <p className="mt-2 text-sm text-foreground/50">開發中 — Phase 0</p>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <li key={f.title} className="rounded-lg border border-foreground/10 p-5">
            <h2 className="font-medium">{f.title}</h2>
            <p className="mt-2 text-sm text-foreground/70">{f.body}</p>
          </li>
        ))}
      </ul>

      <a
        href="https://github.com/ckhsc17/alphascout"
        className="mt-12 inline-block text-sm underline underline-offset-4"
      >
        GitHub
      </a>
    </main>
  );
}
