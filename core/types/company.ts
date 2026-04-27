export interface CompanyDetails {
  peRatio: number
  forwardPE: number
  pegRatio: number
  profitMargins: number      // Als Dezimal (0.25 = 25%)
  revenueGrowth: number      // Als Dezimal (0.15 = 15%)
  earningsGrowth: number     // Als Dezimal (0.20 = 20%)
  dividendYield: number      // Als Dezimal (0.03 = 3%)
  marketCap: number
}
