export type TwBoard = "TWSE" | "TPEx";

export interface TwSecurity {
  symbol: string;
  name: string;
  board: TwBoard;
  industry: string | null;
}

export interface TwDailyPrice {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Shares traded. */
  volume: number;
  /** Turnover in TWD. */
  turnover: number;
  transactions: number;
}

/** Net buy (+) / sell (−) in shares. */
export interface TwInstitutionalFlow {
  symbol: string;
  date: string;
  foreignNet: number;
  trustNet: number;
  dealerNet: number;
}
