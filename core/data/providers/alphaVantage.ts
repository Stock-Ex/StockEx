import { fetchWithTimeout, retryWithBackoff, checkResponse } from '../fetcher'
import { globalCache, requestDedupe, InMemoryCache } from '../cache'
import type { CompanyDetails } from '../../types/company'

/**
 * Alpha Vantage Provider
 * Sehr aggressives Caching (12h) wegen Rate Limits
 */

const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query'

/**
 * Holt Company Overview (Fundamentals)
 */
export async function getCompanyOverview(symbol: string): Promise<CompanyDetails | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY
  if (!apiKey) {
    return null  // Graceful fallback
  }

  const cacheKey = InMemoryCache.hashKey('av', 'overview', symbol)
  
  return requestDedupe.dedupe(cacheKey, async () => {
    // Prüfe Cache (sehr aggressiv: 12h)
    const cached = globalCache.get<CompanyDetails | null>(cacheKey)
    if (cached !== null) return cached

    const url = `${ALPHA_VANTAGE_BASE}?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`
    
    try {
      const response = await retryWithBackoff(
        () => fetchWithTimeout(url, {}, 8000),
        1,  // Nur 1 Retry wegen Rate Limits
        500
      )
      
      await checkResponse(response)
      const data = await response.json()
      
      // Alpha Vantage Rate Limit Response
      if (data['Note'] || data['Information']?.includes('API call frequency')) {
        console.warn(`[Alpha Vantage] Rate limit hit for ${symbol}, using cache if available`)
        // Return cached wenn vorhanden, sonst null
        return globalCache.get<CompanyDetails | null>(cacheKey) || null
      }
      
      // Prüfe ob Daten vorhanden
      if (!data.Symbol || data.Symbol !== symbol) {
        return null
      }
      
      // Parse CompanyDetails
      const details: CompanyDetails = {
        peRatio: parseFloat(data['PERatio']) || 0,
        forwardPE: parseFloat(data['ForwardPE']) || 0,
        pegRatio: parseFloat(data['PEGRatio']) || 0,
        profitMargins: parseFloat(data['ProfitMargin']) || 0,
        revenueGrowth: parseFloat(data['QuarterlyRevenueGrowthYOY']) || 0,
        earningsGrowth: parseFloat(data['QuarterlyEarningsGrowthYOY']) || 0,
        dividendYield: parseFloat(data['DividendYield']) || 0,
        marketCap: parseFloat(data['MarketCapitalization']) || 0
      }
      
      // Cache für 12 Stunden (sehr aggressiv wegen Rate Limits)
      globalCache.set(cacheKey, details, 12 * 60 * 60 * 1000)
      
      return details
    } catch (error) {
      console.error(`[Alpha Vantage] Error fetching ${symbol}:`, error)
      // Return cached wenn vorhanden, sonst null
      return globalCache.get<CompanyDetails | null>(cacheKey) || null
    }
  })
}
