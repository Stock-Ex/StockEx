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

async function fetchStockFromYahoo(symbol: string, usdToEurRate: number) {
  try {
    // Hole Daten für einen längeren Zeitraum, um den letzten Börsentag zu finden
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    const result = data.chart?.result?.[0]
    
    if (!result) {
      throw new Error('No data in response')
    }
    
    const meta = result.meta
    const timestamps = result.timestamp || []
    const quotes = result.indicators?.quote?.[0]
    
    // Aktueller Preis (letzter verfügbarer Preis)
    const currentPrice = meta.regularMarketPrice || meta.previousClose || 0
    
    // Finde den letzten Börsentag und den vorherigen
    let lastClose = meta.previousClose || currentPrice
    let previousClose = meta.previousClose || currentPrice
    
    if (quotes && quotes.close && timestamps.length > 0) {
      // Finde den letzten Tag mit Daten (nicht null/undefined)
      const validCloses: number[] = []
      for (let i = quotes.close.length - 1; i >= 0; i--) {
        if (quotes.close[i] != null && quotes.close[i] > 0) {
          validCloses.push(quotes.close[i])
        }
      }
      
      if (validCloses.length > 0) {
        lastClose = validCloses[0] // Letzter Schlusskurs
        if (validCloses.length > 1) {
          previousClose = validCloses[1] // Vorheriger Schlusskurs
        }
      }
    }
    
    // Verwende die direkten Werte aus der API, falls verfügbar
    let change = meta.regularMarketChange
    let changePercent = meta.regularMarketChangePercent
    
    // Falls nicht verfügbar, berechne es selbst
    if (change == null || changePercent == null) {
      change = currentPrice - previousClose
      changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0
    }
    
    // Konvertiere USD zu EUR
    const priceEUR = currentPrice * usdToEurRate
    const changeEUR = (change || 0) * usdToEurRate
    
    return {
      symbol: meta.symbol || symbol,
      name: meta.longName || meta.shortName || symbol,
      price: priceEUR,
      change: changeEUR,
      changePercent: changePercent || 0,
      currency: 'EUR',
    }
  } catch (error: any) {
    console.error(`Error fetching ${symbol} from Yahoo:`, error?.message || error)
    throw error
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbols = searchParams.get('symbols') || 'AAPL,MSFT,GOOGL,AMZN,TSLA,META,NVDA,JPM'

  try {
    const symbolArray = symbols.split(',').map(s => s.trim())
    console.log('Fetching quotes for symbols:', symbolArray)
    
    // Hole USD/EUR Wechselkurs einmal für alle Aktien
    const usdToEurRate = await getUSDToEURRate()
    console.log(`USD/EUR exchange rate: ${usdToEurRate}`)
    
    // Hole aktuelle Kurse für alle Symbole
    const quotes = await Promise.all(
      symbolArray.map(async (symbol) => {
        try {
          console.log(`Fetching quote for ${symbol}...`)
          const quote = await fetchStockFromYahoo(symbol, usdToEurRate)
          console.log(`Successfully fetched ${symbol}:`, {
            symbol: quote.symbol,
            price: quote.price,
            name: quote.name
          })
          return quote
        } catch (error: any) {
          console.error(`Error fetching ${symbol}:`, error?.message || error)
          return null
        }
      })
    )

    // Filtere null-Werte heraus
    const validQuotes = quotes.filter((quote): quote is NonNullable<typeof quote> => quote !== null)
    
    console.log(`Successfully fetched ${validQuotes.length} out of ${symbolArray.length} quotes`)

    if (validQuotes.length === 0) {
      return NextResponse.json(
        { error: 'No stock data available', details: 'All API calls failed' },
        { status: 503 }
      )
    }

    return NextResponse.json(validQuotes, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    })
  } catch (error: any) {
    console.error('Error fetching stock data:', error?.message || error)
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: error?.message },
      { status: 500 }
    )
  }
}
