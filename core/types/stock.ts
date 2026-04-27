export interface Stock {
  symbol: string
  name: string
  price: number
}

export interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  currency: string
  historical: Array<{
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
    timestamp?: number
  }>
}
