import { describe, expect, it } from "vitest";
import {
  parseDayTrades,
  parseTpexForeignHolding,
  parseTpexMargin,
  parseTwseForeignHolding,
  parseTwseMargin,
} from "./index.ts";

// Trimmed from real responses for 2026-10-27.

const TWSE_MARGIN = {
  stat: "OK",
  date: "20261027",
  tables: [
    { title: "115年10月27日 信用交易統計", fields: [], data: [] },
    {
      title: "115年10月27日 融資融券彙總 (全部)",
      fields: [
        "代號",
        "名稱",
        "買進",
        "賣出",
        "現金償還",
        "前日餘額",
        "今日餘額",
        "次一營業日限額",
        "買進",
        "賣出",
        "現券償還",
        "前日餘額",
        "今日餘額",
        "次一營業日限額",
        "資券互抵",
        "註記",
      ],
      data: [
        [
          "2330",
          "台積電",
          "591",
          "1,026",
          "175",
          "35,472",
          "34,862",
          "6,483,092",
          "7",
          "0",
          "0",
          "15",
          "8",
          "6,483,092",
          "1",
          " ",
        ],
      ],
    },
  ],
};

const TPEX_MARGIN = {
  date: "20261027",
  stat: "ok",
  tables: [
    {
      title: "上櫃股票融資融券餘額",
      fields: [
        "代號",
        "名稱",
        "前資餘額(張)",
        "資買",
        "資賣",
        "現償",
        "資餘額",
        "資屬證金",
        "資使用率(%)",
        "資限額",
        "前券餘額(張)",
        "券賣",
        "券買",
        "券償",
        "券餘額",
        "券屬證金",
        "券使用率(%)",
        "券限額",
        "資券相抵(張)",
        "備註",
      ],
      data: [
        [
          "8383",
          "千附",
          "1,991",
          "71",
          "36",
          "1",
          "2,025",
          "56",
          "7.12",
          "28,440",
          "9",
          "0",
          "1",
          "0",
          "8",
          "0",
          "0.02",
          "28,440",
          "0",
          "",
        ],
      ],
    },
  ],
};

describe("margin", () => {
  it("parses TWSE 融資 / 融券 balances in lots", () => {
    expect(parseTwseMargin(TWSE_MARGIN)).toEqual([
      {
        symbol: "2330",
        date: "2026-10-27",
        marginBalance: 34862,
        shortBalance: 8,
        marginShortOffset: 1,
      },
    ]);
  });

  it("parses TPEx balances", () => {
    expect(parseTpexMargin(TPEX_MARGIN)).toEqual([
      {
        symbol: "8383",
        date: "2026-10-27",
        marginBalance: 2025,
        shortBalance: 8,
        marginShortOffset: 0,
      },
    ]);
  });

  it("fails loudly when the column layout changes", () => {
    const shifted = structuredCopy(TPEX_MARGIN);
    shifted.tables[0]?.fields.splice(2, 1);
    expect(() => parseTpexMargin(shifted)).toThrow(/TPEx margin column/);
  });

  it("returns nothing on non-trading days", () => {
    expect(parseTwseMargin({ stat: "很抱歉，沒有符合條件的資料!" })).toEqual([]);
  });
});

describe("foreign holding", () => {
  it("parses the TWSE ratio (already numeric)", () => {
    const res = {
      date: "20261027",
      fields: [
        "證券代號",
        "證券名稱",
        "國際證券編碼",
        "發行股數",
        "外資及陸資尚可投資股數",
        "全體外資及陸資持有股數",
        "外資及陸資尚可投資比率",
        "全體外資及陸資持股比率",
      ],
      data: [
        [
          "2330",
          "台積電",
          "TW0002330008",
          "25,932,370,067",
          "8,150,711,350",
          "17,781,658,717",
          31.43,
          68.56,
        ],
      ],
    };
    expect(parseTwseForeignHolding(res)).toEqual([
      { symbol: "2330", date: "2026-10-27", foreignHoldingPct: 68.56 },
    ]);
  });

  it("parses the TPEx ratio printed with a percent sign", () => {
    const res = {
      date: "20261027",
      tables: [
        {
          fields: [
            "排行",
            "代號",
            "名稱",
            "發行股數(A)",
            "僑外資及陸資尚可投資股數B=A*F-C",
            "僑外資及陸資持有股數(C)",
            "僑外資及陸資尚可投資比率(D=B/A)",
            "僑外資及陸資持股比率(E=C/A)",
            "法令投資上限比率(F)",
            "備註",
          ],
          data: [
            [
              "123",
              "8383",
              "千附",
              "113,760,482",
              "92,599,192",
              "21,161,290",
              "81.4%",
              "18.6%",
              "100%",
              "",
            ],
          ],
        },
      ],
    };
    expect(parseTpexForeignHolding(res)).toEqual([
      { symbol: "8383", date: "2026-10-27", foreignHoldingPct: 18.6 },
    ]);
  });
});

describe("day trades", () => {
  it("picks the per-stock table, skipping the market summary", () => {
    const res = {
      date: "20261027",
      tables: [
        {
          title: "當日沖銷交易統計資訊",
          fields: ["當日沖銷交易總成交股數"],
          data: [["2,579,342,000"]],
        },
        {
          title: "當日沖銷交易標的及成交量值",
          fields: [
            "證券代號",
            "證券名稱",
            "暫停現股賣出後現款買進當沖註記",
            "當日沖銷交易成交股數",
          ],
          data: [["2330", "台積電", "", "7,790,000"]],
        },
      ],
    };
    expect(parseDayTrades(res)).toEqual([
      { symbol: "2330", date: "2026-10-27", dayTradeVolume: 7790000 },
    ]);
  });
});

function structuredCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
