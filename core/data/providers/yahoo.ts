import { fetchWithTimeout, retryWithBackoff, checkResponse } from '../fetcher'
import { globalCache, requestDedupe, InMemoryCache } from '../cache'

/**
 * Yahoo Finance Provider
 * Nutzt Chart API v8, Quote API v7
 */

const YAHOO_BASE = 'https://query1.finance.yahoo.com'

/**
 * Holt aktuellen Quote (Preis, Währung)
 * Nutzt Chart API v8 statt Quote API v7 (v7 wird blockiert)
 */
export async function getQuote(symbol: string): Promise<{
  price: number
  currency: string
  changePercent: number
}> {
  const cacheKey = InMemoryCache.hashKey('quote', symbol)
  
  return requestDedupe.dedupe(cacheKey, async () => {
    // Prüfe Cache
    const cached = globalCache.get<typeof result>(cacheKey)
    if (cached) return cached

    // Nutze Chart API v8 (funktioniert noch, v7 Quote API wird blockiert)
    const url = `${YAHOO_BASE}/v8/finance/chart/${symbol}?interval=1d&range=5d`
    
    const response = await retryWithBackoff(
      () => fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://finance.yahoo.com/',
        }
      }, 8000),
      2,
      250
    )
    
    await checkResponse(response)
    const data = await response.json()
    
    if (!data.chart?.result?.[0]?.meta) {
      throw new Error(`No quote data for ${symbol}`)
    }
    
    const meta = data.chart.result[0].meta
    const result = {
      price: meta.regularMarketPrice || meta.previousClose || 0,
      currency: meta.currency || 'USD',
      changePercent: meta.regularMarketChangePercent || 0
    }
    
    // Cache für 30 Sekunden (intraday)
    globalCache.set(cacheKey, result, 30000)
    
    return result
  })
}

/**
 * Holt historische Daten
 */
export async function getHistorical(
  symbol: string,
  range: string
): Promise<Array<{ date: string; close: number; open?: number; high?: number; low?: number; volume?: number }>> {
  const cacheKey = InMemoryCache.hashKey('hist', symbol, range)
  
  return requestDedupe.dedupe(cacheKey, async () => {
    // Prüfe Cache
    const cached = globalCache.get<typeof result>(cacheKey)
    if (cached) return cached

    // Mappe range zu interval
    const intervalMap: Record<string, string> = {
      '1d': '1m',
      '5d': '5m',
      '1mo': '1d',
      '3mo': '1d',
      '6mo': '1d',
      '1y': '1wk',
      '2y': '1wk',
      '5y': '1mo',
      'max': '3mo'
    }
    
    const interval = intervalMap[range] || '1d'
    const url = `${YAHOO_BASE}/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`
    
    const response = await retryWithBackoff(
      () => fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://finance.yahoo.com/',
        }
      }, 10000),
      2,
      250
    )
    
    await checkResponse(response)
    const data = await response.json()
    
    if (!data.chart?.result?.[0]?.timestamp) {
      throw new Error(`No historical data for ${symbol}`)
    }
    
    const result = data.chart.result[0]
    const timestamps = result.timestamp || []
    const closes = result.indicators?.quote?.[0]?.close || []
    const opens = result.indicators?.quote?.[0]?.open || []
    const highs = result.indicators?.quote?.[0]?.high || []
    const lows = result.indicators?.quote?.[0]?.low || []
    const volumes = result.indicators?.quote?.[0]?.volume || []
    
    const historical = timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      close: closes[i] || 0,
      open: opens[i],
      high: highs[i],
      low: lows[i],
      volume: volumes[i]
    })).filter((h: any) => h.close > 0)
    
    // Cache TTL basierend auf range
    const ttlMap: Record<string, number> = {
      '1d': 60000,      // 1min
      '5d': 300000,     // 5min
      '1mo': 3600000,   // 1h
      '3mo': 21600000,  // 6h
      '6mo': 21600000,  // 6h
      '1y': 86400000,   // 24h
      '2y': 86400000,   // 24h
      '5y': 86400000,   // 24h
      'max': 86400000   // 24h
    }
    
    const ttl = ttlMap[range] || 3600000  // Default 1h
    globalCache.set(cacheKey, historical, ttl)
    
    return historical
  })
}

/**
 * Holt USD/EUR Wechselkurs
 */
export async function getFxRate(): Promise<number> {
  const cacheKey = InMemoryCache.hashKey('fx', 'eurusd')
  
  return requestDedupe.dedupe(cacheKey, async () => {
    // Prüfe Cache
    const cached = globalCache.get<number>(cacheKey)
    if (cached) return cached

    const url = `${YAHOO_BASE}/v8/finance/chart/EURUSD=X?range=1d&interval=1d`
    
    const response = await retryWithBackoff(
      () => fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://finance.yahoo.com/',
        }
      }, 8000),
      2,
      250
    )
    
    await checkResponse(response)
    const data = await response.json()
    
    if (!data.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.[0]) {
      throw new Error('No FX rate data')
    }
    
    // EURUSD gibt an: 1 EUR = X USD (z.B. 1.08)
    // Für Umrechnung USD -> EUR: 1 USD = 1/X EUR
    const eurUsdRate = data.chart.result[0].indicators.quote[0].close[0]
    const usdEurRate = 1 / eurUsdRate  // Konvertiere zu USD/EUR
    
    // Cache für 1 Stunde
    globalCache.set(cacheKey, usdEurRate, 3600000)
    
    return usdEurRate
  })
}
