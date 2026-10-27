import { describe, expect, it } from "vitest";
import {
  mopsRevenueUrl,
  parseMopsRevenueHtml,
  parseTdccCsv,
  parseTpexDailyQuotes,
  parseTpexInstitutional,
  parseTwInsiderTransfers,
  parseTwNumber,
  parseTwseDailyQuotes,
  parseTwseInstitutional,
} from "./index.ts";

// Trimmed from real responses for 2026-10-27.

const TWSE_QUOTES = {
  tables: [
    { title: "115年10月27日 價格指數(臺灣證券交易所)", fields: [], data: [] },
    {
      title: "115年10月27日 每日收盤行情(全部(不含權證、牛熊證、可展延牛熊證))",
      fields: [
        "證券代號",
        "證券名稱",
        "成交股數",
        "成交筆數",
        "成交金額",
        "開盤價",
        "最高價",
        "最低價",
        "收盤價",
        "漲跌(+/-)",
        "漲跌價差",
        "最後揭示買價",
        "最後揭示買量",
        "最後揭示賣價",
        "最後揭示賣量",
        "本益比",
      ],
      data: [
        [
          "2330",
          "台積電",
          "36,005,147",
          "133,461",
          "86,126,847,595",
          "2,380.00",
          "2,405.00",
          "2,380.00",
          "2,400.00",
          "<p style= color:red>+</p>",
          "15.00",
          "2,395.00",
          "31",
          "2,400.00",
          "399",
          "27.82",
        ],
        [
          "00625K",
          "富邦上証+R",
          "0",
          "0",
          "0",
          "--",
          "--",
          "--",
          "--",
          "<p> </p>",
          "0.00",
          "7.75",
          "5",
          "7.83",
          "10",
          "0.00",
        ],
      ],
    },
  ],
};

const TWSE_T86 = {
  stat: "OK",
  date: "20261027",
  fields: [
    "證券代號",
    "證券名稱",
    "外陸資買進股數(不含外資自營商)",
    "外陸資賣出股數(不含外資自營商)",
    "外陸資買賣超股數(不含外資自營商)",
    "外資自營商買進股數",
    "外資自營商賣出股數",
    "外資自營商買賣超股數",
    "投信買進股數",
    "投信賣出股數",
    "投信買賣超股數",
    "自營商買賣超股數",
    "自營商買進股數(自行買賣)",
    "自營商賣出股數(自行買賣)",
    "自營商買賣超股數(自行買賣)",
    "自營商買進股數(避險)",
    "自營商賣出股數(避險)",
    "自營商買賣超股數(避險)",
    "三大法人買賣超股數",
  ],
  data: [
    [
      "2330",
      "台積電          ",
      "23,264,210",
      "24,882,641",
      "-1,618,431",
      "0",
      "0",
      "0",
      "2,493,000",
      "72,220",
      "2,420,780",
      "1,907,049",
      "108,500",
      "203,000",
      "-94,500",
      "2,135,505",
      "133,956",
      "2,001,549",
      "2,709,398",
    ],
  ],
};

const TPEX_QUOTES = {
  date: "20261027",
  tables: [
    {
      title: "上櫃股票行情",
      fields: [
        "代號",
        "名稱",
        "收盤",
        "漲跌",
        "開盤",
        "最高",
        "最低",
        "均價",
        "成交股數",
        "成交金額(元)",
        "成交筆數",
        "最後買價",
        "最後買量(張數)",
        "最後賣價",
        "最後賣量(張數)",
        "發行股數",
        "次日 參考價",
        "次日 漲停價",
        "次日 跌停價",
      ],
      data: [
        [
          "5347",
          "世界",
          "161.50",
          "+0.50",
          "162.00",
          "164.00",
          "158.00",
          "161.28",
          "12,645,260",
          "2,039,462,504",
          "9,027",
          "161.00",
          "90",
          "161.50",
          "131",
          "1,878,502,192",
          "161.50",
          "177.50",
          "145.50",
        ],
        [
          "00870B",
          "元大15年EM主權債",
          " ---",
          "--- ",
          "---",
          "---",
          "---",
          "26.83",
          "99",
          "2,656",
          "1",
          "26.88",
          "10",
          "26.93",
          "1",
          "564,151,000",
          "26.88",
          "9999.95",
          "0.01",
        ],
      ],
    },
  ],
};

const TPEX_INSTITUTIONAL = {
  date: "20261027",
  tables: [
    {
      title: "三大法人買賣明細資訊",
      fields: [
        "代號",
        "名稱",
        ...Array.from({ length: 7 }, () => ["買進股數", "賣出股數", "買賣超股數"]).flat(),
        "三大法人買賣超股數合計",
      ],
      data: [
        [
          "5347",
          "世界",
          "8,740,622",
          "10,107,166",
          "-1,366,544",
          "0",
          "0",
          "0",
          "8,740,622",
          "10,107,166",
          "-1,366,544",
          "822,211",
          "0",
          "822,211",
          "35,000",
          "2,000",
          "33,000",
          "108,847",
          "56,537",
          "52,310",
          "143,847",
          "58,537",
          "85,310",
          "-459,023",
        ],
      ],
    },
  ],
};

describe("parseTwNumber", () => {
  it.each([
    ["1,234.50", 1234.5],
    ["-1,618,431", -1618431],
    [" 0 ", 0],
    ["--", null],
    [" ---", null],
    ["", null],
    [undefined, null],
  ])("%j → %j", (raw, expected) => {
    expect(parseTwNumber(raw)).toBe(expected);
  });
});

describe("TWSE", () => {
  it("parses daily quotes and skips securities without trades", () => {
    expect(parseTwseDailyQuotes(TWSE_QUOTES, "2026-10-27")).toEqual([
      {
        symbol: "2330",
        date: "2026-10-27",
        open: 2380,
        high: 2405,
        low: 2380,
        close: 2400,
        volume: 36005147,
        turnover: 86126847595,
        transactions: 133461,
      },
    ]);
  });

  it("returns nothing on a non-trading day", () => {
    expect(parseTwseDailyQuotes({ stat: "很抱歉，沒有符合條件的資料!" }, "2026-10-26")).toEqual([]);
    expect(parseTwseInstitutional({ stat: "很抱歉，沒有符合條件的資料!" })).toEqual([]);
  });

  it("combines both foreign investor columns", () => {
    const [flow] = parseTwseInstitutional(TWSE_T86);
    expect(flow).toEqual({
      symbol: "2330",
      date: "2026-10-27",
      foreignNet: -1618431,
      trustNet: 2420780,
      dealerNet: 1907049,
    });
    // Sanity check against the reported 三大法人 total.
    expect(flow && flow.foreignNet + flow.trustNet + flow.dealerNet).toBe(2709398);
  });
});

describe("TPEx", () => {
  it("parses daily quotes and skips securities without trades", () => {
    expect(parseTpexDailyQuotes(TPEX_QUOTES)).toEqual([
      {
        symbol: "5347",
        date: "2026-10-27",
        open: 162,
        high: 164,
        low: 158,
        close: 161.5,
        volume: 12645260,
        turnover: 2039462504,
        transactions: 9027,
      },
    ]);
  });

  it("uses the group totals for foreign investors and dealers", () => {
    const [flow] = parseTpexInstitutional(TPEX_INSTITUTIONAL);
    expect(flow).toEqual({
      symbol: "5347",
      date: "2026-10-27",
      foreignNet: -1366544,
      trustNet: 822211,
      dealerNet: 85310,
    });
    expect(flow && flow.foreignNet + flow.trustNet + flow.dealerNet).toBe(-459023);
  });

  it("fails loudly when the column layout changes", () => {
    const broken: typeof TPEX_QUOTES = JSON.parse(JSON.stringify(TPEX_QUOTES));
    broken.tables[0]?.fields.splice(2, 1);
    expect(() => parseTpexDailyQuotes(broken)).toThrow(/column 2/);
  });
});

describe("MOPS monthly revenue", () => {
  it("parses the summary table rows", () => {
    // Trimmed from the 115年8月 listed-company page.
    const html =
      "<table><tr><th>公司代號</th></tr>" +
      "<tr align=right><td align=center>2330</td><td align=left>台積電</td><td nowrap> 514,805,337</td><td nowrap> 467,580,548</td><td nowrap> 335,771,691</td><td nowrap> 10.09</td><Td nowrap> 53.32</td><td nowrap> 3,386,869,575</td><td nowrap> 2,431,982,931</td><td nowrap> 39.26</td><td align=left>因先進製程產品需求增加所致。</td></tr>" +
      "<tr align=right><td align=center>合計</td><td></td><td nowrap> 1</td></tr></table>";
    expect(parseMopsRevenueHtml(html, "2026-08-01")).toEqual([
      { symbol: "2330", month: "2026-08-01", revenue: 514805337, mom: 10.09, yoy: 53.32 },
    ]);
  });

  it("builds ROC-year URLs per board", () => {
    expect(mopsRevenueUrl("TWSE", 2026, 8)).toBe(
      "https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_115_8_0.html",
    );
    expect(mopsRevenueUrl("TPEx", 2026, 8)).toContain("/otc/t21sc03_115_8_0.html");
  });
});

describe("TDCC shareholding distribution", () => {
  it("keeps only the stored tiers", () => {
    const csv = [
      "﻿資料日期,證券代號,持股分級,人數,股數,占集保庫存數比例%",
      "20261022,2330  ,1,2594858,303612546,1.17",
      "20261022,2330  ,15,1476,21893080824,84.42",
      "20261022,2330  ,17,3166709,25932370067,100.00",
    ].join("\n");
    expect(parseTdccCsv(csv)).toEqual([
      {
        symbol: "2330",
        weekDate: "2026-10-22",
        tier: 15,
        holders: 1476,
        shares: 21893080824,
        pct: 84.42,
      },
      {
        symbol: "2330",
        weekDate: "2026-10-22",
        tier: 17,
        holders: 3166709,
        shares: 25932370067,
        pct: 100,
      },
    ]);
  });
});

describe("insider transfer reports", () => {
  it("parses TWSE rows and skips TPEx placeholder rows", () => {
    const twse = {
      出表日期: "1151022",
      公司代號: "2883",
      公司名稱: "凱基金",
      申報人身分: "子公司經理人本人",
      姓名: "鄧述慧",
      "預定轉讓方式及股數-轉讓方式": " 一般交易(每日得轉讓股數限制)",
      "預定轉讓方式及股數-轉讓股數": " 100000",
      "預定轉讓總股數-自有持股": "100000",
    };
    const tpexEmpty = { Date: "1151022", SecuritiesCompanyCode: "", 姓名: "" };
    expect(parseTwInsiderTransfers([twse, tpexEmpty])).toEqual([
      {
        symbol: "2883",
        reportedOn: "2026-10-22",
        insiderName: "鄧述慧",
        role: "子公司經理人本人",
        method: "一般交易(每日得轉讓股數限制)",
        shares: 100000,
        sourceKey: "2026-10-22|2883|鄧述慧|一般交易(每日得轉讓股數限制)|100000",
      },
    ]);
  });
});
