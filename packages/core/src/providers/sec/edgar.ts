/** Subset of https://data.sec.gov/submissions/CIK##########.json */
export interface EdgarSubmissions {
  cik: string;
  name: string;
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      acceptanceDateTime: string[];
      form: string[];
      primaryDocument: string[];
    };
  };
}

export interface EdgarFiling {
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportDate: string;
  acceptedAt: Date;
  primaryDocument: string;
}

/** Subset of https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/index.json */
export interface EdgarFilingIndex {
  directory: { item: { name: string; size?: string | number }[] };
}

export const padCik = (cik: string | number) => String(cik).replace(/^0+/, "").padStart(10, "0");

export const edgarUrls = {
  submissions: (cik: string) => `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`,
  filingIndex: (cik: string, accession: string) =>
    `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll("-", "")}/index.json`,
  filingFile: (cik: string, accession: string, name: string) =>
    `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll("-", "")}/${name}`,
};

export function listFilings(subs: EdgarSubmissions, forms: string[]): EdgarFiling[] {
  const r = subs.filings.recent;
  const wanted = new Set(forms);
  const out: EdgarFiling[] = [];
  for (let i = 0; i < r.form.length; i++) {
    if (!wanted.has(r.form[i] as string)) continue;
    out.push({
      accessionNumber: r.accessionNumber[i] as string,
      form: r.form[i] as string,
      filingDate: r.filingDate[i] as string,
      reportDate: r.reportDate[i] as string,
      acceptedAt: new Date(r.acceptanceDateTime[i] as string),
      primaryDocument: r.primaryDocument[i] as string,
    });
  }
  return out;
}

/**
 * The 13F information table is the XML file in the filing that is not the cover document.
 * Its name varies by filing agent ("infotable.xml", "56757.xml", …).
 */
export function findInfoTableFile(index: EdgarFilingIndex): string | undefined {
  const xmls = index.directory.item
    .map((i) => i.name)
    .filter((n) => n.toLowerCase().endsWith(".xml") && n.toLowerCase() !== "primary_doc.xml");
  return xmls.find((n) => /info/i.test(n)) ?? xmls[0];
}
