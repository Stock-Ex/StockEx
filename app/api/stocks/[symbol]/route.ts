import { NextResponse } from 'next/server'

// Hole EUR/USD Wechselkurs und konvertiere zu USD/EUR (für Umrechnung von USD zu EUR)
async function getUSDToEURRate(): Promise<number> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }
    )
    
    if (response.ok) {
      const data = await response.json()
      const eurUsdRate = data.chart?.result?.[0]?.meta?.regularMarketPrice
      // EURUSD gibt an: 1 EUR = X USD (z.B. 1.08)
      // Für Umrechnung USD -> EUR: 1 USD = 1/X EUR
      if (eurUsdRate && eurUsdRate > 0) {
        return 1 / eurUsdRate // Konvertiere zu USD/EUR
      }
    }
  } catch (error) {
    console.error('Error fetching EUR/USD rate:', error)
  }
  
  // Fallback: Standard-Wechselkurs (ca. 0.92 EUR pro USD)
  return 0.92
}

async function fetchStockData(symbol: string, range: string = '3mo', usdToEurRate: number = 0.92) {
  try {
    // Hole aktuellen Kurs mit einem längeren Zeitraum, um den letzten Börsentag zu finden
    const quoteResponse = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }
    )
    
    if (!quoteResponse.ok) {
      throw new Error(`HTTP ${quoteResponse.status}`)
    }
    
    const quoteData = await quoteResponse.json()
    const quoteResult = quoteData.chart?.result?.[0]
    
    if (!quoteResult) {
      throw new Error('No quote data in response')
    }
    
    const meta = quoteResult.meta
    const timestamps = quoteResult.timestamp || []
    const quotes = quoteResult.indicators?.quote?.[0]
    
    // Aktueller Preis (in USD)
    const currentPriceUSD = meta.regularMarketPrice || meta.previousClose || 0
    const currentPrice = currentPriceUSD * usdToEurRate // Konvertiere zu EUR
    
    // Finde den letzten Börsentag und den vorherigen (in USD)
    let lastCloseUSD = meta.previousClose || currentPriceUSD
    let previousCloseUSD = meta.previousClose || currentPriceUSD
    
    if (quotes && quotes.close && timestamps.length > 0) {
      // Finde den letzten Tag mit Daten
      const validCloses: number[] = []
      for (let i = quotes.close.length - 1; i >= 0; i--) {
        if (quotes.close[i] != null && quotes.close[i] > 0) {
          validCloses.push(quotes.close[i])
        }
      }
      
      if (validCloses.length > 0) {
        lastCloseUSD = validCloses[0]
        if (validCloses.length > 1) {
          previousCloseUSD = validCloses[1]
        }
      }
    }
    
    // Konvertiere zu EUR
    const lastClose = lastCloseUSD * usdToEurRate
    const previousClose = previousCloseUSD * usdToEurRate
    
    // Verwende die direkten Werte aus der API, falls verfügbar
    let changeUSD = meta.regularMarketChange
    let changePercent = meta.regularMarketChangePercent
    
    // Falls nicht verfügbar, berechne es selbst
    if (changeUSD == null || changePercent == null) {
      changeUSD = currentPriceUSD - previousCloseUSD
      changePercent = previousCloseUSD > 0 ? (changeUSD / previousCloseUSD) * 100 : 0
    }
    
    // Konvertiere Änderung zu EUR
    const change = (changeUSD || 0) * usdToEurRate
    
    // Hole historische Daten basierend auf dem gewählten Zeitraum
    let historical: any[] = []
    
    // Bestimme das Intervall basierend auf dem Zeitraum
    let interval = '1d'
    if (range === '1d') {
      interval = '5m' // 5-Minuten-Intervalle für Intraday
    } else if (range === '5d') {
      interval = '1h' // Stunden-Intervalle für 1 Woche (mehr Datenpunkte)
    } else if (range === '5y' || range === 'max') {
      interval = '1wk' // Wochen für längere Zeiträume
    }
    
    try {
      const historicalResponse = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        }
      )
      
      if (historicalResponse.ok) {
        const historicalData = await historicalResponse.json()
        const historicalResult = historicalData.chart?.result?.[0]
        
        if (historicalResult && historicalResult.timestamp && historicalResult.indicators?.quote?.[0]) {
          const timestamps = historicalResult.timestamp
          const quotes = historicalResult.indicators.quote[0]
          
          console.log(`Found ${timestamps.length} timestamps for ${symbol} with range ${range}`)
          
          historical = timestamps
            .map((timestamp: number, index: number) => {
              const close = quotes.close?.[index]
              if (close == null || close <= 0 || isNaN(close)) return null
              
              const dateObj = new Date(timestamp * 1000)
              
              // Für Intraday-Daten (1d) speichere den vollständigen Timestamp
              // Für andere Zeiträume nur das Datum
              const dateString = range === '1d' 
                ? dateObj.toISOString() // Vollständiger Timestamp für Intraday
                : dateObj.toISOString().split('T')[0] // Nur Datum für andere Zeiträume
              
              // Konvertiere alle Preise zu EUR
              return {
                date: dateString,
                timestamp: timestamp, // Speichere auch den Timestamp für bessere Sortierung
                open: (quotes.open?.[index] || close) * usdToEurRate,
                high: (quotes.high?.[index] || close) * usdToEurRate,
                low: (quotes.low?.[index] || close) * usdToEurRate,
                close: close * usdToEurRate,
                volume: quotes.volume?.[index] || 0,
              }
            })
            .filter((item: any) => item !== null && item.close > 0) // Filtere null-Werte und ungültige Preise
            .sort((a: any, b: any) => {
              // Sortiere nach Timestamp falls verfügbar, sonst nach Datum
              if (a.timestamp && b.timestamp) {
                return a.timestamp - b.timestamp
              }
              return a.date.localeCompare(b.date)
            })
          
          console.log(`Loaded ${historical.length} valid historical data points for ${symbol} (range: ${range})`)
        } else {
          console.warn(`No historical data structure found for ${symbol} (range: ${range})`)
          if (historicalResult) {
            console.warn('Available keys:', Object.keys(historicalResult))
          }
        }
      } else {
        const errorText = await historicalResponse.text().catch(() => 'Unknown error')
        console.warn(`Historical data fetch failed for ${symbol} (range: ${range}, interval: ${interval}): HTTP ${historicalResponse.status}`)
        
        // Fallback für "1d": Versuche mit 1d Intervall statt 5m
        if (range === '1d' && interval === '5m') {
          console.log(`Trying fallback with 1d interval for ${symbol}`)
          try {
            const fallbackResponse = await fetch(
              `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
              {
                headers: {
                  'User-Agent': 'Mozilla/5.0',
                },
              }
            )
            
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json()
              const fallbackResult = fallbackData.chart?.result?.[0]
              
              if (fallbackResult && fallbackResult.timestamp && fallbackResult.indicators?.quote?.[0]) {
                const timestamps = fallbackResult.timestamp
                const quotes = fallbackResult.indicators.quote[0]
                
                // Nimm nur die letzten Datenpunkte (für "Heute")
                const recentData = timestamps
                  .map((timestamp: number, index: number) => {
                    const close = quotes.close?.[index]
                    if (close == null || close <= 0 || isNaN(close)) return null
                    
                    const dateObj = new Date(timestamp * 1000)
                    const now = new Date()
                    const hoursDiff = (now.getTime() - dateObj.getTime()) / (1000 * 60 * 60)
                    
                    // Nur Daten der letzten 24 Stunden
                    if (hoursDiff > 24) return null
                    
                    return {
                      date: dateObj.toISOString(),
                      timestamp: timestamp,
                      open: (quotes.open?.[index] || close) * usdToEurRate,
                      high: (quotes.high?.[index] || close) * usdToEurRate,
                      low: (quotes.low?.[index] || close) * usdToEurRate,
                      close: close * usdToEurRate,
                      volume: quotes.volume?.[index] || 0,
                    }
                  })
                  .filter((item: any) => item !== null && item.close > 0)
                  .sort((a: any, b: any) => a.timestamp - b.timestamp)
                
                if (recentData.length > 0) {
                  historical = recentData
                  console.log(`Fallback loaded ${historical.length} data points for ${symbol}`)
                }
              }
            }
          } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError)
          }
        }
      }
    } catch (histError: any) {
      console.error(`Error fetching historical data for ${symbol}:`, histError?.message)
    }
    
    // Falls keine historischen Daten vorhanden, versuche mit dem aktuellen Preis zu arbeiten
    if (historical.length === 0 && currentPrice > 0) {
      console.warn(`No historical data for ${symbol}, creating single data point with current price`)
      historical = [{
        date: new Date().toISOString().split('T')[0],
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        volume: 0,
      }]
    }
    
    return {
      symbol: meta.symbol || symbol,
      name: meta.longName || meta.shortName || symbol,
      price: currentPrice,
      change: change || 0,
      changePercent: changePercent || 0,
      currency: 'EUR',
      historical: historical,
    }
  } catch (error: any) {
    console.error(`Error fetching data for ${symbol}:`, error?.message || error)
    throw error
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const symbolUpper = symbol.toUpperCase()
  const { searchParams } = new URL(request.url)
  const range = searchParams.get('range') || '3mo' // Standard: 3 Monate

  try {
    console.log(`Fetching data for ${symbolUpper} with range ${range}...`)
    
    // Hole USD/EUR Wechselkurs
    const usdToEurRate = await getUSDToEURRate()
    console.log(`USD/EUR exchange rate: ${usdToEurRate}`)
    
    const stockData = await fetchStockData(symbolUpper, range, usdToEurRate)
    console.log(`Successfully fetched ${symbolUpper}:`, {
      price: stockData.price,
      historicalCount: stockData.historical.length
    })
    
    return NextResponse.json(stockData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    })
  } catch (error: any) {
    console.error(`Error fetching data for ${symbolUpper}:`, error?.message || error)
    return NextResponse.json(
      { error: `Failed to fetch data for ${symbolUpper}`, details: error?.message },
      { status: 500 }
    )
  }
}
