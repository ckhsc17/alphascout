import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  diffPositions,
  effectiveHoldings,
  extractOwnershipXml,
  findInfoTableFile,
  type Position,
  parseAcceptanceDateTime,
  parseDailyFormIndex,
  parseForm4,
  parseThirteenFCover,
  parseThirteenFHoldings,
  previousQuarterEnd,
} from "./index.ts";

const FILED_2026 = new Date("2026-08-14T16:00:00Z");

// Trimmed from Berkshire Hathaway's 13F-HR for 2026-06-30 (accession 0001193125-26-352200).
const COVER = `<?xml version="1.0" encoding="UTF-8"?>
<edgarSubmission xmlns:ns1="http://www.sec.gov/edgar/common" xmlns="http://www.sec.gov/edgar/thirteenffiler">
  <headerData>
    <submissionType>13F-HR</submissionType>
    <filerInfo><periodOfReport>06-30-2026</periodOfReport></filerInfo>
  </headerData>
  <formData>
    <coverPage>
      <reportCalendarOrQuarter>06-30-2026</reportCalendarOrQuarter>
      <isAmendment>false</isAmendment>
      <reportType>13F HOLDINGS REPORT</reportType>
    </coverPage>
    <summaryPage>
      <tableEntryTotal>89</tableEntryTotal>
      <tableValueTotal>299253556246</tableValueTotal>
    </summaryPage>
  </formData>
</edgarSubmission>`;

const AMENDMENT_COVER = COVER.replace(
  "<isAmendment>false</isAmendment>",
  "<isAmendment>true</isAmendment><amendmentNo>1</amendmentNo><amendmentInfo><amendmentType>NEW HOLDINGS</amendmentType><confDeniedExpired>true</confDeniedExpired></amendmentInfo>",
);

const INFO_TABLE = `<informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">
  <infoTable>
    <nameOfIssuer>ALLY FINL INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>02005N100</cusip>
    <value>577211815</value><shrsOrPrnAmt><sshPrnamt>12561737</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt>
  </infoTable>
  <infoTable>
    <nameOfIssuer>ALLY FINL INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>02005N100</cusip>
    <value>128838056</value><shrsOrPrnAmt><sshPrnamt>2803875</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt>
  </infoTable>
  <infoTable>
    <nameOfIssuer>EXAMPLE CORP</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>123456789</cusip>
    <value>1000</value><shrsOrPrnAmt><sshPrnamt>10</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt>
    <putCall>Put</putCall>
  </infoTable>
</informationTable>`;

describe("13F parsing", () => {
  it("reads the cover page", () => {
    expect(parseThirteenFCover(COVER, FILED_2026)).toEqual({
      periodOfReport: "2026-06-30",
      isAmendment: false,
      amendmentType: null,
      totalValue: 299253556246,
    });
  });

  it("recognises NEW HOLDINGS amendments", () => {
    expect(parseThirteenFCover(AMENDMENT_COVER, FILED_2026)).toMatchObject({
      isAmendment: true,
      amendmentType: "NEW HOLDINGS",
    });
  });

  it("merges rows of the same security and keeps put/call separate", () => {
    expect(parseThirteenFHoldings(INFO_TABLE, FILED_2026)).toEqual([
      {
        cusip: "02005N100",
        putCall: "none",
        issuer: "ALLY FINL INC",
        titleOfClass: "COM",
        value: 577211815 + 128838056,
        shares: 12561737 + 2803875,
      },
      {
        cusip: "123456789",
        putCall: "put",
        issuer: "EXAMPLE CORP",
        titleOfClass: "COM",
        value: 1000,
        shares: 10,
      },
    ]);
  });

  it("converts pre-2023 values from thousands of dollars", () => {
    const [ally] = parseThirteenFHoldings(INFO_TABLE, new Date("2022-11-14"));
    expect(ally?.value).toBe((577211815 + 128838056) * 1000);
  });

  it("finds the information table file among the filing documents", () => {
    const index = {
      directory: {
        item: [
          { name: "0001193125-26-352200-index.html" },
          { name: "56757.xml" },
          { name: "primary_doc.xml" },
        ],
      },
    };
    expect(findInfoTableFile(index)).toBe("56757.xml");
  });
});

const pos = (cusip: string, shares: number, value = shares * 10): Position => ({
  cusip,
  putCall: "none",
  shares,
  value,
});

describe("effectiveHoldings", () => {
  it("adds NEW HOLDINGS amendments and lets restatements replace", () => {
    const original = {
      filedAt: new Date("2026-08-14"),
      isAmendment: false,
      amendmentType: null,
      holdings: [pos("A", 100), pos("B", 50)],
    };
    const newHoldings = {
      filedAt: new Date("2026-11-14"),
      isAmendment: true,
      amendmentType: "NEW HOLDINGS" as const,
      holdings: [pos("C", 30)],
    };
    expect(effectiveHoldings([newHoldings, original]).map((h) => h.cusip)).toEqual(["A", "B", "C"]);

    const restatement = {
      filedAt: new Date("2026-12-01"),
      isAmendment: true,
      amendmentType: "RESTATEMENT" as const,
      holdings: [pos("A", 90)],
    };
    expect(effectiveHoldings([original, newHoldings, restatement])).toEqual([pos("A", 90)]);
  });
});

describe("diffPositions", () => {
  it("classifies each position and weights by current value", () => {
    const changes = diffPositions(
      [pos("KEEP", 10), pos("ADD", 10), pos("TRIM", 10), pos("EXIT", 10)],
      [pos("KEEP", 10), pos("ADD", 15), pos("TRIM", 5), pos("NEW", 20)],
    );
    const by = Object.fromEntries(changes.map((c) => [c.cusip, c]));
    expect(by.KEEP?.action).toBe("hold");
    expect(by.ADD).toMatchObject({ action: "add", sharesChangePct: 50 });
    expect(by.TRIM).toMatchObject({ action: "trim", sharesChangePct: -50 });
    expect(by.NEW).toMatchObject({ action: "new", prevShares: 0, sharesChangePct: null });
    expect(by.EXIT).toMatchObject({ action: "exit", shares: 0, prevShares: 10, weight: 0 });
    // total current value = 100 + 150 + 50 + 200 = 500
    expect(by.NEW?.weight).toBeCloseTo(0.4);
  });
});

describe("previousQuarterEnd", () => {
  it.each([
    ["2026-06-30", "2026-03-31"],
    ["2026-03-31", "2025-12-31"],
    ["2025-12-31", "2025-09-30"],
    ["2025-09-30", "2025-06-30"],
  ])("%s → %s", (period, expected) => {
    expect(previousQuarterEnd(period)).toBe(expected);
  });
});

describe("Form 4", () => {
  const fixture = (name: string) =>
    readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");

  it("extracts and parses non-derivative transactions", () => {
    // Agios Pharmaceuticals, accession 0001439222-26-000122.
    const xml = extractOwnershipXml(fixture("form4-agio.xml.txt"));
    expect(xml).not.toBeNull();
    const trades = parseForm4(xml as string);
    expect(trades.map((t) => t.code)).toEqual(["M", "S", "M", "S"]);
    expect(trades[0]).toEqual({
      line: 0,
      issuerCik: "0001439222",
      ticker: "AGIO",
      insiderCik: "0001881190",
      insiderName: "Gheuens Sarah",
      isDirector: false,
      isOfficer: true,
      isTenPercentOwner: false,
      officerTitle: "Chief Medical Officer",
      is10b51Plan: true,
      transactionDate: "2026-10-21",
      code: "M",
      acquired: true,
      shares: 1489,
      price: 25.01,
      sharesOwnedAfter: 56134,
    });
    expect(trades[1]).toMatchObject({ code: "S", acquired: false, price: 37.53 });
  });

  it("reads the acceptance time in US Eastern time", () => {
    // EDT (UTC−4) in October, EST (UTC−5) in January.
    expect(parseAcceptanceDateTime("<ACCEPTANCE-DATETIME>20261023163012")?.toISOString()).toBe(
      "2026-10-23T20:30:12.000Z",
    );
    expect(parseAcceptanceDateTime("<ACCEPTANCE-DATETIME>20260115090000")?.toISOString()).toBe(
      "2026-01-15T14:00:00.000Z",
    );
  });

  it("lists each Form 4 in a daily index once", () => {
    const entries = parseDailyFormIndex(fixture("form.20261023.idx"), ["4"]);
    expect(entries).toHaveLength(3);
    expect(entries[1]).toEqual({
      form: "4",
      cik: "1439222",
      path: "edgar/data/1439222/0001439222-26-000122.txt",
    });
  });
});
