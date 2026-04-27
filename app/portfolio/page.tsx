'use client'

import Navigation from '@/components/Navigation'
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface PortfolioItem {
  id: string
  symbol: string
  name: string
  shares: number
  purchasePrice: number
  currentPrice: number
  change: number
  changePercent: number
  totalValue: number
  totalGain: number
  totalGainPercent: number
  historical: Array<{
    date: string
    close: number
  }>
}

interface StockData {
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

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    symbol: '',
    shares: '',
    purchasePrice: '',
  })

  // Lade Portfolio aus localStorage beim Start
  useEffect(() => {
    const savedPortfolio = localStorage.getItem('stockex-portfolio')
    if (savedPortfolio) {
      const parsed = JSON.parse(savedPortfolio)
      setPortfolio(parsed)
      // Lade aktuelle Kurse für alle Positionen
      updatePortfolioPrices(parsed)
    }
  }, [])

  // Aktualisiere Kurse für alle Positionen
  const updatePortfolioPrices = async (portfolioItems: PortfolioItem[]) => {
    setIsLoading(true)
    try {
      const updatedPortfolio = await Promise.all(
        portfolioItems.map(async (item) => {
          try {
            const response = await fetch(`/api/stocks/${item.symbol}?range=1mo`)
            if (response.ok) {
              const stockData: StockData = await response.json()
              const currentPrice = stockData.price
              const totalValue = currentPrice * item.shares
              const totalGain = totalValue - item.purchasePrice * item.shares
              const totalGainPercent = item.purchasePrice > 0 
                ? ((currentPrice - item.purchasePrice) / item.purchasePrice) * 100 
                : 0

              return {
                ...item,
                name: stockData.name,
                currentPrice,
                change: stockData.change,
                changePercent: stockData.changePercent,
                totalValue,
                totalGain,
                totalGainPercent,
                historical: stockData.historical,
              }
            }
          } catch (error) {
            console.error(`Error fetching data for ${item.symbol}:`, error)
          }
          return item
        })
      )
      setPortfolio(updatedPortfolio)
      localStorage.setItem('stockex-portfolio', JSON.stringify(updatedPortfolio))
    } catch (error) {
      console.error('Error updating portfolio prices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Füge neue Position hinzu
  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault()
    const symbol = formData.symbol.toUpperCase().trim()
    const shares = parseFloat(formData.shares)
    const purchasePrice = parseFloat(formData.purchasePrice)

    if (!symbol || !shares || !purchasePrice || shares <= 0 || purchasePrice <= 0) {
      alert('Bitte fülle alle Felder korrekt aus.')
      return
    }

    setIsLoading(true)
    try {
      // Hole aktuelle Daten für die Aktie
      const response = await fetch(`/api/stocks/${symbol}?range=1mo`)
      if (!response.ok) {
        throw new Error('Aktie nicht gefunden')
      }

      const stockData: StockData = await response.json()
      const currentPrice = stockData.price
      const totalValue = currentPrice * shares
      const totalGain = totalValue - purchasePrice * shares
      const totalGainPercent = ((currentPrice - purchasePrice) / purchasePrice) * 100

      const newItem: PortfolioItem = {
        id: `${symbol}-${Date.now()}`,
        symbol,
        name: stockData.name,
        shares,
        purchasePrice,
        currentPrice,
        change: stockData.change,
        changePercent: stockData.changePercent,
        totalValue,
        totalGain,
        totalGainPercent,
        historical: stockData.historical,
      }

      const updatedPortfolio = [...portfolio, newItem]
      setPortfolio(updatedPortfolio)
      localStorage.setItem('stockex-portfolio', JSON.stringify(updatedPortfolio))
      
      // Formular zurücksetzen
      setFormData({ symbol: '', shares: '', purchasePrice: '' })
      setShowAddForm(false)
    } catch (error: any) {
      alert(`Fehler: ${error.message || 'Aktie konnte nicht hinzugefügt werden'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Entferne Position
  const handleRemovePosition = (id: string) => {
    if (confirm('Möchtest du diese Position wirklich entfernen?')) {
      const updatedPortfolio = portfolio.filter(item => item.id !== id)
      setPortfolio(updatedPortfolio)
      localStorage.setItem('stockex-portfolio', JSON.stringify(updatedPortfolio))
    }
  }

  // Berechne Gesamtwerte
  const totalValue = portfolio.reduce((sum, item) => sum + item.totalValue, 0)
  const totalCost = portfolio.reduce((sum, item) => sum + item.purchasePrice * item.shares, 0)
  const totalGain = totalValue - totalCost
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-luxury-dark via-luxury-charcoal to-luxury-dark">
      <Navigation />
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 bg-gradient-to-r from-white via-gold-300 to-primary-400 bg-clip-text text-transparent">
            Mein Portfolio
          </h1>
          <p className="text-slate-300">Verwalte dein Depot und verfolge deine Investitionen</p>
        </div>

        {/* Gesamtübersicht */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
            <p className="text-slate-400 text-sm mb-1">Gesamtwert</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(totalValue)}</p>
          </div>
          <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
            <p className="text-slate-400 text-sm mb-1">Gesamtkosten</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(totalCost)}</p>
          </div>
          <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
            <p className="text-slate-400 text-sm mb-1">Gesamtgewinn/Verlust</p>
            <p className={`text-2xl font-bold ${totalGain >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
              {formatCurrency(totalGain)}
            </p>
          </div>
          <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
            <p className="text-slate-400 text-sm mb-1">Gewinn/Verlust %</p>
            <p className={`text-2xl font-bold ${totalGainPercent >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
              {formatNumber(totalGainPercent)}%
            </p>
          </div>
        </div>

        {/* Button zum Hinzufügen */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-lg transition-all shadow-lg shadow-primary-600/30 hover:shadow-primary-500/50 font-medium"
          >
            {showAddForm ? 'Abbrechen' : '+ Neue Position hinzufügen'}
          </button>
          {portfolio.length > 0 && (
            <button
              onClick={() => updatePortfolioPrices(portfolio)}
              disabled={isLoading}
              className="ml-4 px-6 py-3 bg-luxury-anthracite hover:bg-luxury-anthracite/80 text-white rounded-lg transition-all border border-luxury-anthracite/50 font-medium disabled:opacity-50"
            >
              {isLoading ? 'Lädt...' : '🔄 Kurse aktualisieren'}
            </button>
          )}
        </div>

        {/* Formular zum Hinzufügen */}
        {showAddForm && (
          <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Neue Position hinzufügen</h2>
            <form onSubmit={handleAddPosition} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Aktiensymbol (z.B. AAPL)</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  placeholder="AAPL"
                  className="w-full px-4 py-2 bg-luxury-dark border border-luxury-anthracite/50 rounded-lg text-white focus:outline-none focus:border-primary-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Anzahl Aktien</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.shares}
                    onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
                    placeholder="10"
                    className="w-full px-4 py-2 bg-luxury-dark border border-luxury-anthracite/50 rounded-lg text-white focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Kaufpreis pro Aktie (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    placeholder="150.00"
                    className="w-full px-4 py-2 bg-luxury-dark border border-luxury-anthracite/50 rounded-lg text-white focus:outline-none focus:border-primary-500"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-lg transition-all shadow-lg shadow-primary-600/30 hover:shadow-primary-500/50 font-medium disabled:opacity-50"
              >
                {isLoading ? 'Hinzufügen...' : 'Position hinzufügen'}
              </button>
            </form>
          </div>
        )}

        {/* Portfolio-Liste */}
        {portfolio.length === 0 ? (
          <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-12 border border-luxury-anthracite/50 shadow-xl text-center">
            <p className="text-slate-400 text-lg mb-4">Dein Portfolio ist noch leer.</p>
            <p className="text-slate-500">Füge deine erste Position hinzu, um loszulegen.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {portfolio.map((item) => (
              <div
                key={item.id}
                className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-white">{item.symbol}</h3>
                      <span className="text-slate-400 text-sm">{item.name}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">Aktueller Kurs</p>
                        <p className="text-white font-medium">{formatCurrency(item.currentPrice)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Tagesänderung</p>
                        <p className={`font-medium ${item.change >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                          {item.change >= 0 ? '+' : ''}{formatNumber(item.change)} ({item.change >= 0 ? '+' : ''}{formatNumber(item.changePercent)}%)
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Anzahl</p>
                        <p className="text-white font-medium">{item.shares}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Gesamtwert</p>
                        <p className="text-white font-medium">{formatCurrency(item.totalValue)}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemovePosition(item.id)}
                    className="ml-4 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-all border border-red-600/30 text-sm"
                  >
                    Entfernen
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-luxury-dark/50 rounded-lg p-4">
                    <p className="text-slate-400 text-xs mb-1">Kaufpreis</p>
                    <p className="text-white font-medium">{formatCurrency(item.purchasePrice)}</p>
                  </div>
                  <div className="bg-luxury-dark/50 rounded-lg p-4">
                    <p className="text-slate-400 text-xs mb-1">Gewinn/Verlust</p>
                    <p className={`font-medium ${item.totalGain >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                      {item.totalGain >= 0 ? '+' : ''}{formatCurrency(item.totalGain)}
                    </p>
                  </div>
                  <div className="bg-luxury-dark/50 rounded-lg p-4">
                    <p className="text-slate-400 text-xs mb-1">Gewinn/Verlust %</p>
                    <p className={`font-medium ${item.totalGainPercent >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                      {item.totalGainPercent >= 0 ? '+' : ''}{formatNumber(item.totalGainPercent)}%
                    </p>
                  </div>
                </div>

                {/* Chart */}
                {item.historical && item.historical.length > 0 && (
                  <div className="h-48 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={item.historical}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#94a3b8', fontSize: 12 }}
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
                          }}
                        />
                        <YAxis
                          tick={{ fill: '#94a3b8', fontSize: 12 }}
                          domain={['dataMin', 'dataMax']}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#fff',
                          }}
                          labelFormatter={(value) => {
                            const date = new Date(value)
                            return date.toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          }}
                          formatter={(value: number) => [formatCurrency(value), 'Kurs']}
                        />
                        <Line
                          type="monotone"
                          dataKey="close"
                          stroke={item.totalGain >= 0 ? '#fbbf24' : '#ef4444'}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
