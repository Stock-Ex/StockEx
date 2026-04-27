import { getQuote, getHistorical, getFxRate } from './providers/yahoo'
import { getCompanyOverview } from './providers/alphaVantage'
import type { CompanyDetails } from '../types/company'

/**
 * Unified Data Fetching Layer
 * Bündelt alle Provider-Calls mit Caching und Dedupe
 */

export interface StockData {
  symbol: string
  name: string
  price: number
  currency: string
  changePercent: number
  historical: Array<{
    date: string
    close: number
    open?: number
    high?: number
    low?: number
    volume?: number
  }>
}

/**
 * Holt komplette Stock-Daten (Quote + Historical)
 * Konvertiert automatisch zu EUR wenn nötig
 */
export async function fetchStockData(
  symbol: string,
  range: string
): Promise<StockData> {
  // Hole Quote und Historical parallel
  const [quote, historical] = await Promise.all([
    getQuote(symbol),
    getHistorical(symbol, range)
  ])

  // Konvertiere zu EUR falls nötig
  let price = quote.price
  let currency = quote.currency
  let fxRate: number | null = null

  if (currency === 'USD') {
    try {
      fxRate = await getFxRate()
      price = price / fxRate  // USD -> EUR
      currency = 'EUR'
    } catch (error) {
      console.warn('[Data] FX conversion failed, using USD:', error)
    }
  }

  // Konvertiere Historical zu EUR wenn nötig
  let historicalEUR = historical
  if (currency === 'EUR' && quote.currency === 'USD' && fxRate !== null) {
    historicalEUR = historical.map(h => ({
      ...h,
      close: h.close / fxRate  // USD -> EUR
    }))
  }

  return {
    symbol,
    name: symbol,  // Name wird später aus Quote geholt falls verfügbar
    price,
    currency,
    changePercent: quote.changePercent,
    historical: historicalEUR
  }
}

/**
 * Holt Company Details (Fundamentals)
 * Graceful fallback: null wenn nicht verfügbar
 */
export async function fetchCompanyDetails(symbol: string): Promise<CompanyDetails | null> {
  try {
    return await getCompanyOverview(symbol)
  } catch (error) {
    console.warn(`[Data] Failed to fetch company details for ${symbol}:`, error)
    return null
  }
}
