'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface Stock {
  symbol: string
  name: string
  price: number
}

interface DevelopmentResult {
  config: {
    techFund: { tech: number; fund: number }
    techIndicators: { rsi: number; ma: number; support: number }
    fundMetrics: {
      peRatio: number
      pegRatio: number
      profitMargin: number
      revenueGrowth: number
      earningsGrowth: number
      dividendYield: number
    }
    thresholds: {
      buyThreshold: number
      sellThreshold: number
    }
  }
  performance: {
    winRate: number
    totalTrades: number
    accuracy: number
    totalReturn: number
    tradeFrequency: number // Trades pro Monat
    balancedScore: number // Kombiniert Win Rate und Trade Frequency
  }
}

export default function IndikatorDevelopmentPage() {
  const [selectedStock, setSelectedStock] = useState<Stock>({ symbol: 'AAPL', name: 'Apple Inc.', price: 0 })
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [results, setResults] = useState<DevelopmentResult[]>([])
  const [bestResult, setBestResult] = useState<DevelopmentResult | null>(null)
  const [timeRange, setTimeRange] = useState('1y')
  const [stocks, setStocks] = useState<Stock[]>([])

  // Lade verfügbare Aktien
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const response = await fetch('/api/stocks?symbols=AAPL,MSFT,GOOGL,AMZN,TSLA,META,NVDA,JPM,BAC,GS')
        if (response.ok) {
          const data = await response.json()
          // Die API gibt ein Array direkt zurück, nicht ein Objekt mit 'stocks'
          const stocksArray = Array.isArray(data) ? data : (data.stocks || [])
          setStocks(stocksArray)
          if (stocksArray.length > 0) {
            setSelectedStock(stocksArray[0])
          }
        } else {
          console.error('Failed to fetch stocks:', response.status)
          // Fallback: Verwende Standard-Aktien
          const fallbackStocks: Stock[] = [
            { symbol: 'AAPL', name: 'Apple Inc.', price: 0 },
            { symbol: 'MSFT', name: 'Microsoft Corporation', price: 0 },
            { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 0 },
            { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 0 },
            { symbol: 'TSLA', name: 'Tesla Inc.', price: 0 },
            { symbol: 'META', name: 'Meta Platforms Inc.', price: 0 },
            { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 0 },
            { symbol: 'JPM', name: 'JPMorgan Chase & Co.', price: 0 },
          ]
          setStocks(fallbackStocks)
          setSelectedStock(fallbackStocks[0])
        }
      } catch (error) {
        console.error('Error fetching stocks:', error)
        // Fallback: Verwende Standard-Aktien
        const fallbackStocks: Stock[] = [
          { symbol: 'AAPL', name: 'Apple Inc.', price: 0 },
          { symbol: 'MSFT', name: 'Microsoft Corporation', price: 0 },
          { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 0 },
          { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 0 },
          { symbol: 'TSLA', name: 'Tesla Inc.', price: 0 },
          { symbol: 'META', name: 'Meta Platforms Inc.', price: 0 },
          { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 0 },
          { symbol: 'JPM', name: 'JPMorgan Chase & Co.', price: 0 },
        ]
        setStocks(fallbackStocks)
        setSelectedStock(fallbackStocks[0])
      }
    }
    fetchStocks()
  }, [])

  // Erweiterte selbstlernende Optimierung
  const runAdvancedOptimization = async () => {
    if (!selectedStock.symbol) {
      alert('Bitte wählen Sie eine Aktie aus')
      return
    }

    setIsOptimizing(true)
    setResults([])
    setBestResult(null)

    try {
      // Lade historische Daten
      const response = await fetch(`/api/stocks/${selectedStock.symbol}?range=${timeRange}`)
      if (!response.ok) throw new Error('Failed to fetch stock data')
      
      const stockData = await response.json()
      if (!stockData.historical || stockData.historical.length < 50) {
        alert('Nicht genügend historische Daten verfügbar')
        setIsOptimizing(false)
        return
      }

      const historical = stockData.historical
      const allResults: DevelopmentResult[] = []

      // Teste verschiedene Konfigurationen
      // 1. Verschiedene Tech/Fund Gewichtungen
      for (let techWeight = 50; techWeight <= 80; techWeight += 10) {
        const fundWeight = 100 - techWeight

        // 2. Verschiedene technische Indikator-Gewichtungen
        const techConfigs = [
          { rsi: 30, ma: 60, support: 10 },
          { rsi: 25, ma: 65, support: 10 },
          { rsi: 35, ma: 55, support: 10 },
          { rsi: 30, ma: 55, support: 15 },
        ]

        for (const techIndicators of techConfigs) {
          // 3. Verschiedene Schwellenwerte für Kauf/Verkauf
          const thresholdConfigs = [
            { buyThreshold: 52, sellThreshold: 48 }, // Weniger restriktiv - mehr Trades
            { buyThreshold: 55, sellThreshold: 45 }, // Mittel
            { buyThreshold: 58, sellThreshold: 42 }, // Restriktiver - weniger Trades, höhere Genauigkeit
            { buyThreshold: 60, sellThreshold: 40 }, // Sehr restriktiv
          ]

          for (const thresholds of thresholdConfigs) {
            try {
              // Simuliere Trades mit dieser Konfiguration
              const performance = await simulateTrades(
                historical,
                techWeight,
                fundWeight,
                techIndicators,
                thresholds
              )

              allResults.push({
                config: {
                  techFund: { tech: techWeight, fund: fundWeight },
                  techIndicators,
                  fundMetrics: {
                    peRatio: 10,
                    pegRatio: 15,
                    profitMargin: 15,
                    revenueGrowth: 30,
                    earningsGrowth: 25,
                    dividendYield: 5,
                  },
                  thresholds,
                },
                performance,
              })
            } catch (error) {
              console.error('Error simulating trades:', error)
              // Überspringe diese Konfiguration bei Fehler
            }
          }
        }
      }

      // Sortiere nach Balanced Score (kombiniert Win Rate und Trade Frequency)
      allResults.sort((a, b) => b.performance.balancedScore - a.performance.balancedScore)

      console.log(`Optimization complete. Found ${allResults.length} configurations.`)
      console.log('Top 3 results:', allResults.slice(0, 3))

      if (allResults.length === 0) {
        alert('Keine Ergebnisse gefunden. Bitte versuchen Sie es mit einem anderen Zeitraum oder einer anderen Aktie.')
        setIsOptimizing(false)
        return
      }

      setResults(allResults)
      setBestResult(allResults[0])
      setData(historical.map((h: any) => ({
        date: new Date(h.date).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }),
        price: h.close,
      })))

    } catch (error) {
      console.error('Error during optimization:', error)
      alert(`Fehler bei der Optimierung: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
    } finally {
      setIsOptimizing(false)
    }
  }

  // Berechne Support-Levels (vereinfachte Version)
  const calculateSupportLevels = (historical: any[]): number[] => {
    if (historical.length < 20) return []
    
    const prices = historical.map(h => h.close)
    const windowSize = Math.max(3, Math.floor(prices.length / 20))
    const localMinima: number[] = []
    
    for (let i = windowSize; i < prices.length - windowSize; i++) {
      let isLocalMin = true
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (j !== i && prices[j] < prices[i]) {
          isLocalMin = false
          break
        }
      }
      if (isLocalMin) {
        localMinima.push(prices[i])
      }
    }
    
    // Gruppiere ähnliche Preise (±1%)
    const clusters: number[][] = []
    const sorted = [...localMinima].sort((a, b) => a - b)
    
    for (const price of sorted) {
      let foundCluster = false
      for (const cluster of clusters) {
        const clusterAvg = cluster.reduce((sum, p) => sum + p, 0) / cluster.length
        const diff = Math.abs(price - clusterAvg) / clusterAvg
        if (diff <= 0.01) {
          cluster.push(price)
          foundCluster = true
          break
        }
      }
      if (!foundCluster) {
        clusters.push([price])
      }
    }
    
    return clusters
      .filter(c => c.length >= 2)
      .map(c => c.reduce((sum, p) => sum + p, 0) / c.length)
      .slice(0, 5)
  }

  // Berechne Support-Score
  const calculateSupportScore = (currentPrice: number, supportLevels: number[]): number => {
    if (supportLevels.length === 0) return 50
    
    const relevant = supportLevels.filter(level => level < currentPrice)
    if (relevant.length === 0) return 50
    
    let nearest = relevant[0]
    let minDist = Math.abs(currentPrice - nearest) / currentPrice
    
    for (const support of relevant) {
      const dist = Math.abs(currentPrice - support) / currentPrice
      if (dist < minDist) {
        minDist = dist
        nearest = support
      }
    }
    
    const priceDiff = currentPrice - nearest
    const priceDiffPercent = (priceDiff / nearest) * 100
    
    if (priceDiffPercent >= -0.5 && priceDiffPercent <= 0.5) {
      return 90 + (0.5 - Math.abs(priceDiffPercent)) * 20
    } else if (priceDiffPercent > 0.5 && priceDiffPercent <= 2) {
      return 70 + (2 - priceDiffPercent) * 10
    } else if (priceDiffPercent > 2 && priceDiffPercent <= 5) {
      return 50 + (5 - priceDiffPercent) * 6.67
    } else if (priceDiffPercent > 5) {
      return Math.max(30, 50 - (priceDiffPercent - 5) * 2)
    } else {
      const distanceBelow = Math.abs(priceDiffPercent)
      if (distanceBelow <= 2) {
        return 30 - distanceBelow * 10
      } else {
        return Math.max(0, 10 - (distanceBelow - 2) * 2.5)
      }
    }
  }

  // Simuliere Trades mit gegebener Konfiguration
  const simulateTrades = async (
    historical: any[],
    techWeight: number,
    fundWeight: number,
    techIndicators: { rsi: number; ma: number; support: number },
    thresholds: { buyThreshold: number; sellThreshold: number }
  ) => {
    // Lade Company Details für fundamentalen Score
    let companyDetails: any = null
    try {
      const detailsResponse = await fetch(`/api/stocks/${selectedStock.symbol}/details`)
      if (detailsResponse.ok) {
        companyDetails = await detailsResponse.json()
      }
    } catch (error) {
      console.warn('Could not load company details:', error)
    }

    // Berechne Support-Levels
    const supportLevels = calculateSupportLevels(historical)

    // Berechne Fundamentalen Score
    const calculateFundamentalScore = (details: any): number => {
      if (!details) return 50
      
      let peScore = 50
      if (details.peRatio > 0) {
        if (details.peRatio >= 15 && details.peRatio <= 25) peScore = 80
        else if (details.peRatio > 10 && details.peRatio < 30) peScore = 60
        else if (details.peRatio > 30) peScore = 20
        else if (details.peRatio < 10) peScore = 55
      }
      
      let pegScore = 50
      if (details.pegRatio > 0) {
        if (details.pegRatio >= 0.5 && details.pegRatio <= 1.5) pegScore = 80
        else if (details.pegRatio < 0.5) pegScore = 90
        else if (details.pegRatio > 2) pegScore = 20
      }
      
      let profitScore = 50
      if (details.profitMargins > 0) {
        const marginPercent = details.profitMargins * 100
        if (marginPercent > 25) profitScore = 100
        else if (marginPercent > 15) profitScore = 80
        else if (marginPercent > 5) profitScore = 60
        else profitScore = 30
      }
      
      let revenueScore = 50
      if (details.revenueGrowth > 0) {
        const growthPercent = details.revenueGrowth * 100
        if (growthPercent > 20) revenueScore = 100
        else if (growthPercent > 10) revenueScore = 80
        else if (growthPercent > 5) revenueScore = 60
        else revenueScore = 55
      } else if (details.revenueGrowth < 0) {
        revenueScore = Math.max(0, 50 + details.revenueGrowth * 100)
      }
      
      let earningsScore = 50
      if (details.earningsGrowth > 0) {
        const earningsGrowthPercent = details.earningsGrowth * 100
        if (earningsGrowthPercent > 20) earningsScore = 100
        else if (earningsGrowthPercent > 10) earningsScore = 80
        else if (earningsGrowthPercent > 5) earningsScore = 60
        else earningsScore = 55
      } else if (details.earningsGrowth < 0) {
        earningsScore = Math.max(0, 50 + details.earningsGrowth * 100)
      }
      
      let dividendScore = 50
      if (details.dividendYield > 0) {
        const yieldPercent = details.dividendYield * 100
        if (yieldPercent > 3) dividendScore = 90
        else if (yieldPercent > 1.5) dividendScore = 70
        else dividendScore = 60
      }
      
      return (
        peScore * 0.10 +
        pegScore * 0.15 +
        profitScore * 0.15 +
        revenueScore * 0.30 +
        earningsScore * 0.25 +
        dividendScore * 0.05
      )
    }

    const fundamentalScore = calculateFundamentalScore(companyDetails)

    let totalTrades = 0
    let winningTrades = 0
    let totalReturn = 0
    let position: 'LONG' | null = null
    let entryPrice = 0
    let entryIndex = -1

    // Berechne Indikatoren für jeden Datenpunkt
    const indicators = historical.map((item, i) => {
      // RSI
      let rsi = 50
      if (i >= 14) {
        let gains = 0
        let losses = 0
        for (let j = i - 14; j < i; j++) {
          const change = historical[j + 1].close - historical[j].close
          if (change > 0) gains += change
          else losses += Math.abs(change)
        }
        const avgGain = gains / 14
        const avgLoss = losses / 14
        const rs = avgLoss > 0 ? avgGain / avgLoss : 1
        rsi = 100 - (100 / (1 + rs))
      }

      // Moving Average (14 Tage)
      let ma = item.close
      if (i >= 14) {
        const sum = historical.slice(i - 14, i + 1).reduce((acc, h) => acc + h.close, 0)
        ma = sum / 15
      }

      // Support Score
      const supportScore = calculateSupportScore(item.close, supportLevels)

      // Technischer Score
      const rsiValue = rsi
      const maDistance = ((item.close - ma) / ma) * 100
      const maValue = 50 + Math.min(Math.max(maDistance * 5, -50), 50)
      const technicalScore = (rsiValue * (techIndicators.rsi / 100)) +
                            (maValue * (techIndicators.ma / 100)) +
                            (supportScore * (techIndicators.support / 100))

      // Kombinierter Score
      const combinedScore = (technicalScore * (techWeight / 100)) +
                           (fundamentalScore * (fundWeight / 100))

      return {
        price: item.close,
        date: item.date,
        combinedScore,
        technicalScore,
        fundamentalScore,
      }
    })

    // Simuliere Trades
    for (let i = 1; i < indicators.length; i++) {
      const current = indicators[i]
      const previous = indicators[i - 1]

      // Kauf-Signal
      if (!position && current.combinedScore >= thresholds.buyThreshold && previous.combinedScore < thresholds.buyThreshold) {
        position = 'LONG'
        entryPrice = current.price
        entryIndex = i
      }

      // Verkauf-Signal
      if (position === 'LONG' && current.combinedScore <= thresholds.sellThreshold && previous.combinedScore > thresholds.sellThreshold) {
        const returnPercent = ((current.price - entryPrice) / entryPrice) * 100
        totalTrades++
        if (returnPercent > 0) {
          winningTrades++
        }
        totalReturn += returnPercent
        position = null
      }
    }

    // Berechne Metriken
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0
    const accuracy = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0
    const daysInPeriod = historical.length
    const monthsInPeriod = daysInPeriod / 30
    const tradeFrequency = monthsInPeriod > 0 ? totalTrades / monthsInPeriod : 0

    // Balanced Score: Kombiniert Win Rate (60%) und Trade Frequency (40%)
    // Normalisiere Trade Frequency (0-10 Trades/Monat = 0-100 Punkte)
    const normalizedFrequency = Math.min(100, (tradeFrequency / 10) * 100)
    const balancedScore = (winRate * 0.6) + (normalizedFrequency * 0.4)

    const result = {
      winRate,
      totalTrades,
      accuracy,
      totalReturn,
      tradeFrequency,
      balancedScore,
    }

    // Debug-Logging
    if (totalTrades === 0) {
      console.warn('No trades found for configuration:', {
        techWeight,
        fundWeight,
        techIndicators,
        thresholds,
        combinedScores: indicators.slice(0, 10).map(i => i.combinedScore.toFixed(2)),
      })
    }

    return result
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-luxury-charcoal via-luxury-dark to-luxury-charcoal p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">
            Indikator-Entwicklung
          </h1>
          <p className="text-slate-400">
            Selbstlernende Optimierung für maximale Gewinnwahrscheinlichkeit bei ausreichender Trade-Häufigkeit
          </p>
        </div>

        {/* Steuerung */}
        <div className="bg-luxury-dark/60 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-slate-300 text-sm mb-2 block">Aktie auswählen</label>
              <select
                value={selectedStock.symbol}
                onChange={(e) => {
                  const stock = stocks.find(s => s.symbol === e.target.value)
                  if (stock) {
                    setSelectedStock(stock)
                  }
                }}
                className="w-full px-4 py-2 bg-luxury-charcoal border border-luxury-anthracite/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={stocks.length === 0}
              >
                {stocks.length === 0 ? (
                  <option value="">Lade Aktien...</option>
                ) : (
                  stocks.map(stock => (
                    <option key={stock.symbol} value={stock.symbol}>
                      {stock.symbol} - {stock.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="text-slate-300 text-sm mb-2 block">Zeitraum</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full px-4 py-2 bg-luxury-charcoal border border-luxury-anthracite/50 rounded-lg text-white"
              >
                <option value="6mo">6 Monate</option>
                <option value="1y">1 Jahr</option>
                <option value="2y">2 Jahre</option>
                <option value="5y">5 Jahre</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={runAdvancedOptimization}
                disabled={isOptimizing}
                className="w-full px-6 py-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-lg transition-all shadow-lg shadow-primary-600/30 hover:shadow-primary-500/50 font-medium disabled:opacity-50"
              >
                {isOptimizing ? 'Optimierung läuft...' : '🚀 Optimierung starten'}
              </button>
            </div>
          </div>
        </div>

        {/* Beste Konfiguration */}
        {bestResult && (
          <div className="bg-luxury-dark/60 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Beste Konfiguration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-300 mb-3">Gewichtungen</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Technisch / Fundamental:</span>
                    <span className="text-white font-medium">{bestResult.config.techFund.tech}% / {bestResult.config.techFund.fund}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">RSI / MA / Support:</span>
                    <span className="text-white font-medium">{bestResult.config.techIndicators.rsi}% / {bestResult.config.techIndicators.ma}% / {bestResult.config.techIndicators.support}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Kauf-Schwelle:</span>
                    <span className="text-white font-medium">{bestResult.config.thresholds.buyThreshold}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Verkauf-Schwelle:</span>
                    <span className="text-white font-medium">{bestResult.config.thresholds.sellThreshold}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-300 mb-3">Performance</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Win Rate:</span>
                    <span className="text-gold-400 font-medium">{bestResult.performance.winRate.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trades gesamt:</span>
                    <span className="text-white font-medium">{bestResult.performance.totalTrades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trade-Frequenz:</span>
                    <span className="text-white font-medium">{bestResult.performance.tradeFrequency.toFixed(2)} Trades/Monat</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gesamt-Rendite:</span>
                    <span className={`font-medium ${bestResult.performance.totalReturn >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                      {bestResult.performance.totalReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Balanced Score:</span>
                    <span className="text-purple-400 font-bold text-lg">{bestResult.performance.balancedScore.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ergebnisse-Visualisierung */}
        {results.length > 0 && (
          <div className="bg-luxury-dark/60 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Top 10 Konfigurationen</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-luxury-anthracite/30">
                    <th className="text-left py-2 px-3 text-slate-400">Tech/Fund</th>
                    <th className="text-left py-2 px-3 text-slate-400">RSI/MA/Support</th>
                    <th className="text-left py-2 px-3 text-slate-400">Schwellenwerte</th>
                    <th className="text-right py-2 px-3 text-slate-400">Win Rate</th>
                    <th className="text-right py-2 px-3 text-slate-400">Trades</th>
                    <th className="text-right py-2 px-3 text-slate-400">Frequenz</th>
                    <th className="text-right py-2 px-3 text-slate-400">Balanced Score</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 10).map((result, index) => (
                    <tr
                      key={index}
                      className={`border-b border-luxury-anthracite/20 ${
                        index === 0 ? 'bg-purple-600/10' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-slate-300">
                        {result.config.techFund.tech}/{result.config.techFund.fund}%
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        {result.config.techIndicators.rsi}/{result.config.techIndicators.ma}/{result.config.techIndicators.support}%
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        {result.config.thresholds.buyThreshold}/{result.config.thresholds.sellThreshold}
                      </td>
                      <td className="py-2 px-3 text-right text-gold-400 font-medium">
                        {result.performance.winRate.toFixed(2)}%
                      </td>
                      <td className="py-2 px-3 text-right text-white">
                        {result.performance.totalTrades}
                      </td>
                      <td className="py-2 px-3 text-right text-white">
                        {result.performance.tradeFrequency.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right text-purple-400 font-bold">
                        {result.performance.balancedScore.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Chart */}
        {data.length > 0 && (
          <div className="bg-luxury-dark/60 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-4">Kursverlauf</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #f97316',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#f97316"
                  strokeWidth={2}
                  name="Aktienpreis"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
