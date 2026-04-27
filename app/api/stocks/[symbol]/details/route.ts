import { NextResponse } from 'next/server'

function safeGetValue(obj: any, path: string, defaultValue: any = 0) {
  try {
    const keys = path.split('.')
    let value = obj
    for (const key of keys) {
      if (value == null) return defaultValue
      value = value[key]
    }
    return value?.raw ?? value?.fmt ?? value ?? defaultValue
  } catch {
    return defaultValue
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params
    const symbolUpper = symbol.toUpperCase()

    console.log(`[Details API] Fetching details for ${symbolUpper}...`)
    
    // Nutze Chart API als primäre Quelle (funktioniert zuverlässig)
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbolUpper}?interval=1d&range=1y`
    console.log(`[Details API] Requesting Chart API: ${chartUrl}`)
    
    const chartResponse = await fetch(chartUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 300 }
    })
    
    let chartData: any = null
    let chartMeta: any = null
    
    if (chartResponse.ok) {
      try {
        chartData = await chartResponse.json()
        chartMeta = chartData.chart?.result?.[0]?.meta
        if (chartMeta) {
          console.log(`[Details API] Chart API success for ${symbolUpper}`, {
            hasName: !!chartMeta.longName,
            hasMarketCap: !!chartMeta.marketCap,
            hasSector: !!chartMeta.sector,
            hasIndustry: !!chartMeta.industry,
            marketCap: chartMeta.marketCap,
            longName: chartMeta.longName,
            availableKeys: Object.keys(chartMeta).slice(0, 20),
          })
        } else {
          console.warn(`[Details API] Chart API returned no meta for ${symbolUpper}`)
        }
      } catch (err) {
        console.error('[Details API] Failed to parse chart data:', err)
      }
    } else {
      console.warn(`[Details API] Chart API failed: ${chartResponse.status} ${chartResponse.statusText}`)
    }
    
    // Verwende die Quote API (v7) als zusätzliche Quelle
    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolUpper}`
    console.log(`[Details API] Requesting Quote API: ${quoteUrl}`)
    
    const quoteResponse = await fetch(quoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 300 }
    })
    
    console.log(`[Details API] Quote API response status: ${quoteResponse.status} ${quoteResponse.statusText}`)
    
    let quoteData: any = null
    let quote: any = null
    
    if (quoteResponse.ok) {
      try {
        quoteData = await quoteResponse.json()
        quote = quoteData.quoteResponse?.result?.[0]
        if (quote) {
          console.log(`[Details API] Quote API success for ${symbolUpper}`, {
            hasSector: !!quote.sector,
            hasIndustry: !!quote.industry,
            hasMarketCap: !!quote.marketCap,
            hasTrailingPE: !!quote.trailingPE,
            hasWebsite: !!quote.website,
            hasLongName: !!quote.longName,
            sector: quote.sector,
            industry: quote.industry,
            marketCap: quote.marketCap,
            trailingPE: quote.trailingPE,
            availableKeys: Object.keys(quote).slice(0, 30),
          })
        } else {
          console.warn(`[Details API] Quote API returned no result for ${symbolUpper}`)
        }
      } catch (err) {
        console.error('[Details API] Failed to parse quote data:', err)
      }
    } else {
      console.warn(`[Details API] Quote API failed: ${quoteResponse.status} ${quoteResponse.statusText}`)
    }
    
    // Hole Daten von Alpha Vantage als zusätzliche Quelle (NUR für Unternehmensdaten, NICHT für Kurse!)
    // WICHTIG: Alpha Vantage wird nur für die OVERVIEW-Funktion verwendet, die Unternehmensdaten liefert
    // Kurse werden weiterhin nur von Yahoo Finance geholt, um Rate Limits zu vermeiden
    let alphaVantageData: any = null
    const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY || 'demo' // 'demo' funktioniert auch, aber mit Key mehr Requests
    const alphaVantageUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbolUpper}&apikey=${alphaVantageKey}`
    
    console.log(`[Details API] Requesting Alpha Vantage API (OVERVIEW only - no price data): ${alphaVantageUrl}`)
    
    try {
      const alphaVantageResponse = await fetch(alphaVantageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
        next: { revalidate: 3600 } // Cache für 1 Stunde (Alpha Vantage hat Rate Limits)
      })
      
      if (alphaVantageResponse.ok) {
        alphaVantageData = await alphaVantageResponse.json()
        
        // Prüfe auf Fehler in der Antwort (demo key funktioniert nicht mehr, benötigt echten API-Key)
        if (alphaVantageData['Note'] || alphaVantageData['Error Message'] || alphaVantageData['Information']) {
          const errorMsg = alphaVantageData['Note'] || alphaVantageData['Error Message'] || alphaVantageData['Information']
          console.warn(`[Details API] Alpha Vantage API error for ${symbolUpper}:`, errorMsg)
          if (errorMsg.includes('demo') || errorMsg.includes('API key')) {
            console.warn(`[Details API] Alpha Vantage requires a valid API key. Using Yahoo Finance data only.`)
          }
          alphaVantageData = null
        } else if (Object.keys(alphaVantageData).length > 0 && alphaVantageData.Symbol) {
          // Log rohe Daten für Debugging
          console.log(`[Details API] Alpha Vantage API success for ${symbolUpper}`, {
            hasName: !!alphaVantageData.Name,
            hasSector: !!alphaVantageData.Sector,
            hasIndustry: !!alphaVantageData.Industry,
            hasMarketCap: !!alphaVantageData.MarketCapitalization,
            hasPERatio: !!alphaVantageData.PERatio,
            hasDescription: !!alphaVantageData.Description,
            marketCapRaw: alphaVantageData.MarketCapitalization,
            peRatioRaw: alphaVantageData.PERatio,
            dividendYieldRaw: alphaVantageData.DividendYield,
            profitMarginRaw: alphaVantageData.ProfitMargin,
          })
        } else {
          console.warn(`[Details API] Alpha Vantage API returned empty or invalid data for ${symbolUpper}`)
          alphaVantageData = null
        }
      } else {
        console.warn(`[Details API] Alpha Vantage API failed: ${alphaVantageResponse.status} ${alphaVantageResponse.statusText}`)
      }
    } catch (err) {
      console.warn('[Details API] Alpha Vantage API request failed:', err)
    }
    
    // Kombiniere Daten aus Chart API, Quote API und Alpha Vantage
    // Chart API liefert Metadaten wie marketCap, longName, etc.
    // Quote API liefert zusätzliche Daten wie sector, industry, website, etc.
    // Alpha Vantage liefert detaillierte Finanzkennzahlen
    
    if (!chartMeta && !quote && !alphaVantageData) {
      return NextResponse.json(
        { error: `No data available for ${symbolUpper}` },
        { status: 404 }
      )
    }
    
    // Kombiniere die Daten - bevorzuge Alpha Vantage, dann Quote API, dann Chart API
    const name = alphaVantageData?.Name || 
                 quote?.longName || quote?.shortName || quote?.displayName || 
                 chartMeta?.longName || chartMeta?.shortName || symbolUpper
    
    const sector = alphaVantageData?.Sector || quote?.sector || chartMeta?.sector || 'N/A'
    const industry = alphaVantageData?.Industry || quote?.industry || chartMeta?.industry || 'N/A'
    const website = quote?.website || alphaVantageData?.Website || ''
    const description = alphaVantageData?.Description || 
                       quote?.longBusinessSummary || quote?.businessSummary || ''
    
    // Extrahiere numerische Werte - handle verschiedene Formate
    // Alpha Vantage liefert Werte als Strings (z.B. "1234567890", "None", "N/A")
    const getNumericValue = (val: any): number => {
      if (val == null || val === undefined) return 0
      
      // Handle "None", "N/A", leere Strings
      if (typeof val === 'string') {
        const trimmed = val.trim()
        if (trimmed === '' || trimmed === 'None' || trimmed === 'N/A' || trimmed === 'null') return 0
      }
      
      if (typeof val === 'number') return val
      if (typeof val === 'string') {
        // Parse strings wie "2.5T", "1.2B", "1234567890", etc.
        const cleaned = val.replace(/[^0-9.-]/g, '')
        if (cleaned === '') return 0
        const num = parseFloat(cleaned)
        if (isNaN(num)) return 0
        // Handle Multiplikatoren (T, B, M, K)
        if (val.includes('T') || val.includes('t')) return num * 1e12
        if (val.includes('B') || val.includes('b')) return num * 1e9
        if (val.includes('M') || val.includes('m')) return num * 1e6
        if (val.includes('K') || val.includes('k')) return num * 1e3
        return num
      }
      // Handle Objekte mit .raw oder .fmt
      if (val?.raw !== undefined) return getNumericValue(val.raw)
      if (val?.fmt !== undefined) return getNumericValue(val.fmt)
      return 0
    }
    
    // Kombiniere Werte aus allen Quellen - Alpha Vantage hat Priorität
    const marketCap = getNumericValue(alphaVantageData?.MarketCapitalization) || 
                     getNumericValue(quote?.marketCap) || 
                     getNumericValue(chartMeta?.marketCap) || 0
    
    const enterpriseValue = getNumericValue(alphaVantageData?.EnterpriseValue) || 
                           getNumericValue(quote?.enterpriseValue) || 0
    
    const peRatio = getNumericValue(alphaVantageData?.PERatio) || 
                   getNumericValue(alphaVantageData?.TrailingPE) || 
                   getNumericValue(quote?.trailingPE) || 0
    
    const forwardPE = getNumericValue(alphaVantageData?.ForwardPE) || 
                     getNumericValue(quote?.forwardPE) || 0
    
    const pegRatio = getNumericValue(alphaVantageData?.PEGRatio) || 
                    getNumericValue(quote?.pegRatio) || 0
    
    const priceToBook = getNumericValue(alphaVantageData?.PriceToBookRatio) || 
                       getNumericValue(quote?.priceToBook) || 0
    
    // Alpha Vantage liefert DividendYield als Prozent (z.B. "2.5" für 2.5%), muss durch 100 geteilt werden
    const dividendYieldRaw = alphaVantageData?.DividendYield
    const dividendYield = dividendYieldRaw && dividendYieldRaw !== 'None' && dividendYieldRaw !== 'N/A'
      ? parseFloat(dividendYieldRaw) / 100
      : (getNumericValue(quote?.dividendYield) || 0)
    
    // Alpha Vantage liefert Margins als Prozent (z.B. "25.5" für 25.5%), muss durch 100 geteilt werden
    const profitMarginRaw = alphaVantageData?.ProfitMargin
    const profitMargins = profitMarginRaw && profitMarginRaw !== 'None' && profitMarginRaw !== 'N/A'
      ? parseFloat(profitMarginRaw) / 100
      : (getNumericValue(quote?.profitMargins) || 0)
    
    const operatingMarginRaw = alphaVantageData?.OperatingMarginTTM
    const operatingMargins = operatingMarginRaw && operatingMarginRaw !== 'None' && operatingMarginRaw !== 'N/A'
      ? parseFloat(operatingMarginRaw) / 100
      : (getNumericValue(quote?.operatingMargins) || 0)
    
    // Alpha Vantage liefert RevenueGrowth und EarningsGrowth als Prozentwerte (z.B. "15.5" für 15.5%)
    // Kann auch "None" oder "N/A" sein
    const revenueGrowthRaw = alphaVantageData?.QuarterlyRevenueGrowthYOY
    const revenueGrowth = revenueGrowthRaw && revenueGrowthRaw !== 'None' && revenueGrowthRaw !== 'N/A'
      ? parseFloat(revenueGrowthRaw) / 100 
      : (getNumericValue(quote?.revenueGrowth) || 0)
    
    const earningsGrowthRaw = alphaVantageData?.QuarterlyEarningsGrowthYOY
    const earningsGrowth = earningsGrowthRaw && earningsGrowthRaw !== 'None' && earningsGrowthRaw !== 'N/A'
      ? parseFloat(earningsGrowthRaw) / 100 
      : (getNumericValue(quote?.earningsGrowth) || 0)
    
    const currentPrice = getNumericValue(quote?.regularMarketPrice) || 
                        getNumericValue(chartMeta?.regularMarketPrice) || 
                        getNumericValue(quote?.previousClose) || 
                        getNumericValue(chartMeta?.previousClose) || 0
    
    const targetHighPrice = getNumericValue(quote?.targetHighPrice) || 0
    const targetLowPrice = getNumericValue(quote?.targetLowPrice) || 0
    const targetMeanPrice = getNumericValue(alphaVantageData?.AnalystTargetPrice) || 
                           getNumericValue(quote?.targetMeanPrice) || 0
    const recommendationMean = getNumericValue(quote?.recommendationMean) || 0
    const recommendationKey = quote?.recommendationKey || 'N/A'
    
    const details = {
      symbol: symbolUpper,
      name: name,
      sector: sector !== 'N/A' ? sector : 'N/A',
      industry: industry !== 'N/A' ? industry : 'N/A',
      website: website,
      description: description,
      employees: alphaVantageData?.FullTimeEmployees 
        ? parseInt(alphaVantageData.FullTimeEmployees) || 0 
        : (quote?.fullTimeEmployees || 0),
      city: quote?.city || '',
      state: quote?.state || '',
      country: alphaVantageData?.Country || quote?.country || '',
      marketCap: marketCap,
      enterpriseValue: enterpriseValue,
      peRatio: peRatio,
      forwardPE: forwardPE,
      pegRatio: pegRatio,
      priceToBook: priceToBook,
      dividendYield: dividendYield,
      profitMargins: profitMargins,
      operatingMargins: operatingMargins,
      revenueGrowth: revenueGrowth,
      earningsGrowth: earningsGrowth,
      currentPrice: currentPrice,
      targetHighPrice: targetHighPrice,
      targetLowPrice: targetLowPrice,
      targetMeanPrice: targetMeanPrice,
      recommendationMean: recommendationMean,
      recommendationKey: recommendationKey,
      exDividendDate: quote?.exDividendDate || null,
      dividendDate: quote?.dividendDate || null,
    }
    
    console.log(`[Details API] Combined data for ${symbolUpper}:`, {
      name: details.name,
      sector: details.sector,
      industry: details.industry,
      hasWebsite: !!details.website,
      hasDescription: !!details.description,
      marketCap: details.marketCap,
      peRatio: details.peRatio,
      forwardPE: details.forwardPE,
      dividendYield: details.dividendYield,
      profitMargins: details.profitMargins,
      revenueGrowth: details.revenueGrowth,
      hasChartData: !!chartMeta,
      hasQuoteData: !!quote,
      hasAlphaVantageData: !!alphaVantageData,
    })
    
    return NextResponse.json(details, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (error: any) {
    console.error('Error in details route:', error?.message || error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
