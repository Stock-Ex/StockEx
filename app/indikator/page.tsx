'use client'

import Navigation from '@/components/Navigation'
import CustomIndicator from '@/components/CustomIndicator'
import { useState, useEffect } from 'react'

interface Stock {
  symbol: string
  name: string
  price: number
}

const stockSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM']

export default function IndikatorPage() {
  const [availableStocks, setAvailableStocks] = useState<Stock[]>([])
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null)
  const [isLoadingStocks, setIsLoadingStocks] = useState(true)

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        setIsLoadingStocks(true)
        const response = await fetch(`/api/stocks?symbols=${stockSymbols.join(',')}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch stocks')
        }
        
        const stocks = await response.json()
        setAvailableStocks(stocks)
        if (stocks.length > 0 && !selectedStock) {
          setSelectedStock(stocks[0])
        }
      } catch (error) {
        console.error('Error fetching stocks:', error)
      } finally {
        setIsLoadingStocks(false)
      }
    }

    fetchStocks()
  }, [])

  // Aktualisiere selectedStock wenn availableStocks sich ändert
  useEffect(() => {
    if (availableStocks.length > 0 && selectedStock) {
      const updatedStock = availableStocks.find(s => s.symbol === selectedStock.symbol)
      if (updatedStock) {
        setSelectedStock(updatedStock)
      }
    }
  }, [availableStocks])

  return (
    <main className="min-h-screen bg-gradient-to-br from-luxury-dark via-luxury-charcoal to-luxury-dark">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 bg-gradient-to-r from-white via-gold-300 to-primary-400 bg-clip-text text-transparent">Indikator</h1>
          <p className="text-slate-300">Professionelle Trading-Indikatoren und Analysen</p>
        </div>

        {/* Aktienauswahl */}
        <div className="mb-6 bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
          <label htmlFor="stock-select" className="block text-sm font-medium text-slate-300 mb-3">
            Aktie auswählen
          </label>
          {isLoadingStocks ? (
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-luxury-anthracite rounded"></div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <select
                id="stock-select"
                value={selectedStock?.symbol || ''}
                onChange={(e) => {
                  const stock = availableStocks.find(s => s.symbol === e.target.value)
                  if (stock) setSelectedStock(stock)
                }}
                className="flex-1 px-4 py-3 bg-luxury-dark/60 border border-luxury-anthracite/50 rounded-lg text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all font-medium"
              >
                {availableStocks.map((stock) => (
                  <option key={stock.symbol} value={stock.symbol}>
                    {stock.symbol} - {stock.name}
                  </option>
                ))}
              </select>
              {selectedStock && (
                <div className="px-4 py-3 bg-luxury-dark/60 border border-luxury-anthracite/50 rounded-lg">
                  <div className="text-sm text-slate-400">Aktueller Preis</div>
                  <div className="text-xl font-bold text-white">€{selectedStock.price.toFixed(2)}</div>
                  <div className={`text-xs font-semibold ${
                    (selectedStock as any).change >= 0 ? 'text-gold-400' : 'text-red-400'
                  }`}>
                    {(selectedStock as any).change >= 0 ? '+' : ''}
                    {((selectedStock as any).change || 0).toFixed(2)} (
                    {((selectedStock as any).changePercent || 0) >= 0 ? '+' : ''}
                    {((selectedStock as any).changePercent || 0).toFixed(2)}%)
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedStock && <CustomIndicator selectedStock={selectedStock} />}
      </div>
    </main>
  )
}
