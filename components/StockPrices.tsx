'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Stock {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
}

export default function StockPrices() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchStocks = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/stocks?symbols=AAPL,MSFT,GOOGL,AMZN,TSLA,META,NVDA,JPM')
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch stock data`)
      }
      
      const data = await response.json()
      
      if (Array.isArray(data) && data.length > 0) {
        setStocks(data)
      } else if (data.error) {
        console.error('API Error:', data.error, data.details)
        setStocks([])
      } else {
        console.warn('No stock data received')
        setStocks([])
      }
    } catch (error: any) {
      console.error('Error fetching stocks:', error?.message || error)
      // Fallback zu leeren Daten bei Fehler
      setStocks([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStocks()
    
    // Aktualisiere alle 60 Sekunden
    const interval = setInterval(fetchStocks, 60000)

    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-luxury-anthracite rounded w-1/2"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-luxury-anthracite rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!isLoading && stocks.length === 0) {
    return (
      <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">Aktienkurse</h2>
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-center">
          <p className="text-red-400 font-medium mb-2">Fehler beim Laden der Aktienkurse</p>
          <p className="text-slate-400 text-sm">
            Die Aktiendaten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.
          </p>
          <button 
            onClick={fetchStocks}
            className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm transition-colors font-medium"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">Aktienkurse</h2>
      <div className="space-y-3">
        {stocks.map((stock) => (
          <Link
            key={stock.symbol}
            href={`/aktien/${stock.symbol}`}
            className="block"
          >
            <div className="bg-luxury-dark/60 rounded-lg p-4 hover:bg-luxury-dark/80 transition-all border border-luxury-anthracite/30 hover:border-primary-500/30 cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">{stock.symbol}</div>
                  <div className="text-sm text-slate-400">{stock.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-white">
                    €{stock.price.toFixed(2)}
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      stock.change >= 0 ? 'text-gold-400' : 'text-red-400'
                    }`}
                  >
                    {stock.change >= 0 ? '+' : ''}
                    {stock.change.toFixed(2)} ({stock.changePercent >= 0 ? '+' : ''}
                    {stock.changePercent.toFixed(2)}%)
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <button className="mt-4 w-full px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-lg text-sm transition-all shadow-lg shadow-primary-600/30 hover:shadow-primary-500/50 font-medium">
        Mehr Aktien anzeigen
      </button>
    </div>
  )
}
