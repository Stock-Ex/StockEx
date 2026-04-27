import { NextResponse } from 'next/server'

interface IndexData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  historical: Array<{
    date: string
    close: number
  }>
}

async function fetchIndexData(symbol: string, name: string): Promise<IndexData | null> {
  try {
    // Hole Chart-Daten für den Index (letzte 30 Tage für kleine Charts)
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`,
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
    
    // Aktueller Preis
    const currentPrice = meta.regularMarketPrice || meta.previousClose || 0
    
    // Finde den letzten Börsentag und den vorherigen
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
        // Letzter Schlusskurs ist der aktuelle Preis
        // Vorheriger Schlusskurs ist der zweite Wert
        if (validCloses.length > 1) {
          previousClose = validCloses[1]
        } else {
          previousClose = validCloses[0]
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
    
    // Erstelle historische Daten für den Chart
    const historical: Array<{ date: string; close: number }> = []
    
    if (quotes && quotes.close && timestamps.length > 0) {
      for (let i = 0; i < timestamps.length; i++) {
        if (quotes.close[i] != null && quotes.close[i] > 0) {
          const date = new Date(timestamps[i] * 1000)
          historical.push({
            date: date.toISOString().split('T')[0],
            close: quotes.close[i],
          })
        }
      }
    }
    
    return {
      symbol,
      name,
      price: currentPrice,
      change,
      changePercent,
      historical,
    }
  } catch (error: any) {
    console.error(`Error fetching index data for ${symbol}:`, error?.message || error)
    return null
  }
}

export async function GET() {
  try {
    // Definiere die Indizes
    const indices = [
      { symbol: '^GDAXI', name: 'DAX' },
      { symbol: '^DJI', name: 'Dow Jones' },
      { symbol: '^GSPC', name: 'S&P 500' },
      { symbol: '^IXIC', name: 'Nasdaq' },
    ]
    
    // Hole Daten für alle Indizes parallel
    const indexData = await Promise.all(
      indices.map(({ symbol, name }) => fetchIndexData(symbol, name))
    )
    
    // Filtere null-Werte heraus
    const validData = indexData.filter((data): data is IndexData => data !== null)
    
    if (validData.length === 0) {
      return NextResponse.json(
        { error: 'No index data available' },
        { status: 503 }
      )
    }
    
    return NextResponse.json(validData, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (error: any) {
    console.error('Error fetching index data:', error?.message || error)
    return NextResponse.json(
      { error: 'Failed to fetch index data', details: error?.message },
      { status: 500 }
    )
  }
}
