export interface TrackedInvestor {
  cik: string;
  slug: string;
  name: string;
  manager: string;
  /** Shown on the home page and in default dashboards. */
  isFeatured: boolean;
  note?: string;
}

/** Default 13F filers we track. CIKs verified against EDGAR submissions on 2026-10-27. */
export const TRACKED_INVESTORS: TrackedInvestor[] = [
  {
    cik: "0001067983",
    slug: "berkshire-hathaway",
    name: "Berkshire Hathaway",
    manager: "Warren Buffett / Greg Abel",
    isFeatured: true,
  },
  {
    cik: "0001649339",
    slug: "scion",
    name: "Scion Asset Management",
    manager: "Michael Burry",
    isFeatured: true,
    note: "Stopped filing 13F after Q3 2025.",
  },
  {
    cik: "0001697748",
    slug: "ark-invest",
    name: "ARK Investment Management",
    manager: "Cathie Wood",
    isFeatured: true,
  },
  {
    cik: "0001350694",
    slug: "bridgewater",
    name: "Bridgewater Associates",
    manager: "Ray Dalio (founder)",
    isFeatured: true,
  },
  {
    cik: "0001336528",
    slug: "pershing-square",
    name: "Pershing Square Capital Management",
    manager: "Bill Ackman",
    isFeatured: true,
  },
  {
    cik: "0001536411",
    slug: "duquesne",
    name: "Duquesne Family Office",
    manager: "Stanley Druckenmiller",
    isFeatured: true,
  },
  {
    cik: "0001656456",
    slug: "appaloosa",
    name: "Appaloosa",
    manager: "David Tepper",
    isFeatured: true,
  },
  {
    cik: "0001709323",
    slug: "himalaya-capital",
    name: "Himalaya Capital Management",
    manager: "Li Lu",
    isFeatured: true,
  },
  {
    cik: "0001029160",
    slug: "soros",
    name: "Soros Fund Management",
    manager: "George Soros",
    isFeatured: true,
  },
  {
    cik: "0002045724",
    slug: "situational-awareness",
    name: "Situational Awareness",
    manager: "Leopold Aschenbrenner",
    isFeatured: true,
  },
  {
    cik: "0001061768",
    slug: "baupost",
    name: "Baupost Group",
    manager: "Seth Klarman",
    isFeatured: false,
  },
  {
    cik: "0001040273",
    slug: "third-point",
    name: "Third Point",
    manager: "Dan Loeb",
    isFeatured: false,
  },
  {
    cik: "0000921669",
    slug: "icahn",
    name: "Carl C. Icahn",
    manager: "Carl Icahn",
    isFeatured: false,
  },
  {
    cik: "0001549575",
    slug: "dalal-street",
    name: "Dalal Street",
    manager: "Mohnish Pabrai",
    isFeatured: false,
  },
  {
    cik: "0001167483",
    slug: "tiger-global",
    name: "Tiger Global Management",
    manager: "Chase Coleman",
    isFeatured: false,
  },
  {
    cik: "0001135730",
    slug: "coatue",
    name: "Coatue Management",
    manager: "Philippe Laffont",
    isFeatured: false,
  },
  {
    cik: "0001061165",
    slug: "lone-pine",
    name: "Lone Pine Capital",
    manager: "Stephen Mandel (founder)",
    isFeatured: false,
  },
  {
    cik: "0001037389",
    slug: "renaissance",
    name: "Renaissance Technologies",
    manager: "Jim Simons (founder)",
    isFeatured: false,
  },
  {
    cik: "0001569205",
    slug: "fundsmith",
    name: "Fundsmith",
    manager: "Terry Smith",
    isFeatured: false,
  },
  {
    cik: "0001112520",
    slug: "akre",
    name: "Akre Capital Management",
    manager: "Chuck Akre (founder)",
    isFeatured: false,
  },
  {
    cik: "0001166559",
    slug: "gates-foundation",
    name: "Gates Foundation Trust",
    manager: "Bill & Melinda Gates Foundation",
    isFeatured: false,
  },
  {
    cik: "0000783412",
    slug: "daily-journal",
    name: "Daily Journal",
    manager: "Charlie Munger (late)",
    isFeatured: false,
  },
];
