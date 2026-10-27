/** Parses numbers as TWSE / TPEx print them: "1,234.50", "-1,618,431", "--", "---". */
export function parseTwNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const s = raw.replace(/,/g, "").trim();
  if (s === "" || /^-+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "20261027" → "2026-10-27" */
export function compactToIsoDate(compact: string): string {
  if (!/^\d{8}$/.test(compact)) throw new Error(`invalid compact date: ${compact}`);
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

/** "2026-10-27" → "20261027" */
export function isoToCompactDate(iso: string): string {
  return iso.replaceAll("-", "");
}

/** "2026-10-27" → "2026/10/27" (TPEx query format) */
export function isoToSlashDate(iso: string): string {
  return iso.replaceAll("-", "/");
}

/** Industry codes used by both TWSE (產業別) and TPEx (SecuritiesIndustryCode). */
export const TW_INDUSTRIES: Record<string, string> = {
  "01": "水泥工業",
  "02": "食品工業",
  "03": "塑膠工業",
  "04": "紡織纖維",
  "05": "電機機械",
  "06": "電器電纜",
  "08": "玻璃陶瓷",
  "09": "造紙工業",
  "10": "鋼鐵工業",
  "11": "橡膠工業",
  "12": "汽車工業",
  "14": "建材營造",
  "15": "航運業",
  "16": "觀光餐旅",
  "17": "金融保險",
  "18": "貿易百貨",
  "19": "綜合",
  "20": "其他",
  "21": "化學工業",
  "22": "生技醫療業",
  "23": "油電燃氣業",
  "24": "半導體業",
  "25": "電腦及週邊設備業",
  "26": "光電業",
  "27": "通信網路業",
  "28": "電子零組件業",
  "29": "電子通路業",
  "30": "資訊服務業",
  "31": "其他電子業",
  "32": "文化創意業",
  "33": "農業科技業",
  "34": "電子商務",
  "35": "綠能環保",
  "36": "數位雲端",
  "37": "運動休閒",
  "38": "居家生活",
  "91": "存託憑證",
};
