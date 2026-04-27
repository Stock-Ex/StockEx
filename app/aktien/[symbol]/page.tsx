'use client'

import Navigation from '@/components/Navigation'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  currency: string
  historical: Array<{
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
}

interface CompanyDetails {
  symbol: string
  name: string
  sector: string
  industry: string
  website: string
  description: string
  employees: number
  city: string
  state: string
  country: string
  marketCap: number
  enterpriseValue: number
  peRatio: number
  forwardPE: number
  pegRatio: number
  priceToBook: number
  dividendYield: number
  profitMargins: number
  operatingMargins: number
  revenueGrowth: number
  earningsGrowth: number
  currentPrice: number
  targetHighPrice: number
  targetLowPrice: number
  targetMeanPrice: number
  recommendationMean: number
  recommendationKey: string
}

interface NewsItem {
  id: string
  title: string
  summary: string
  source: string
  time: string
  url: string
  imageUrl: string | null
}

export default function StockDetailPage() {
  const params = useParams()
  const symbol = (params.symbol as string).toUpperCase()
  
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<string>('3mo')
  
  const timeRanges = [
    { value: '1d', label: 'Heute' },
    { value: '5d', label: '1 Woche' },
    { value: '1mo', label: '1 Monat' },
    { value: '3mo', label: '3 Monate' },
    { value: '6mo', label: '6 Monate' },
    { value: '1y', label: '1 Jahr' },
    { value: '2y', label: '2 Jahre' },
    { value: '5y', label: '5 Jahre' },
    { value: 'max', label: 'Max' },
  ]

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        // Hole Stock-Daten zuerst (wichtigste) mit dem gewählten Zeitraum
        const stockResponse = await fetch(`/api/stocks/${symbol}?range=${timeRange}`)
        
        if (!stockResponse.ok) {
          throw new Error('Failed to fetch stock data')
        }

        const stock = await stockResponse.json()
        setStockData(stock)

        // Hole Details und News parallel (optional)
        const [detailsResponse, newsResponse] = await Promise.allSettled([
          fetch(`/api/stocks/${symbol}/details`),
          fetch(`/api/stocks/${symbol}/news`),
        ])

        if (detailsResponse.status === 'fulfilled' && detailsResponse.value.ok) {
          try {
            const details = await detailsResponse.value.json()
            console.log('[Client] Received company details:', {
              symbol: details.symbol,
              name: details.name,
              hasSector: !!details.sector && details.sector !== 'N/A',
              hasMarketCap: details.marketCap > 0,
              hasPERatio: details.peRatio > 0,
              allKeys: Object.keys(details),
            })
            setCompanyDetails(details)
          } catch (err) {
            console.error('[Client] Failed to parse details:', err)
          }
        } else {
          const reason = detailsResponse.status === 'rejected' 
            ? detailsResponse.reason 
            : (detailsResponse.status === 'fulfilled' 
              ? `HTTP ${detailsResponse.value.status} ${detailsResponse.value.statusText}` 
              : 'Unknown error')
          console.error('[Client] Details API failed:', reason)
          
          // Versuche die Fehlermeldung zu extrahieren
          if (detailsResponse.status === 'fulfilled') {
            try {
              const errorData = await detailsResponse.value.json()
              console.error('[Client] Details API error response:', errorData)
            } catch {
              // Ignore JSON parse errors
            }
          }
        }

        if (newsResponse.status === 'fulfilled' && newsResponse.value.ok) {
          try {
            const newsData = await newsResponse.value.json()
            setNews(newsData)
          } catch (err) {
            console.warn('Failed to parse news:', err)
          }
        } else {
          console.warn('News API failed, continuing without news')
        }
      } catch (err: any) {
        console.error('Error fetching data:', err)
        setError(err.message || 'Fehler beim Laden der Daten')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [symbol, timeRange])

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-luxury-dark via-luxury-charcoal to-luxury-dark">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-luxury-anthracite rounded w-1/3"></div>
            <div className="h-64 bg-luxury-anthracite rounded"></div>
            <div className="h-48 bg-luxury-anthracite rounded"></div>
          </div>
        </div>
      </main>
    )
  }

  if (error || !stockData) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-luxury-dark via-luxury-charcoal to-luxury-dark">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
            <p className="text-red-400 font-medium mb-2">Fehler beim Laden der Aktiendaten</p>
            <p className="text-slate-400 text-sm mb-4">{error || 'Aktie nicht gefunden'}</p>
            <Link 
              href="/aktien"
              className="inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
            >
              Zurück zur Übersicht
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Erstelle Chart-Daten aus historischen Daten, sortiert nach Datum
  const formatDate = (dateString: string, timestamp: number | undefined, range: string) => {
    let date: Date
    
    // Verwende Timestamp falls verfügbar (für Intraday-Daten)
    if (timestamp) {
      date = new Date(timestamp * 1000)
    } else {
      date = new Date(dateString)
    }
    
    // Prüfe ob das Datum gültig ist
    if (isNaN(date.getTime())) {
      return dateString // Fallback: zeige den String wie er ist
    }
    
    if (range === '1d') {
      // Für Intraday: Zeige Uhrzeit in lokaler Zeit
      return date.toLocaleTimeString('de-DE', { 
        hour: '2-digit', 
        minute: '2-digit'
      })
    } else if (range === '5d' || range === '1mo') {
      return date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })
    } else if (range === '3mo' || range === '6mo') {
      return date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })
    } else {
      return date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
    }
  }

  // Filtere und sortiere Daten
  let filteredHistorical = stockData.historical
  
  // Für "Heute": Filtere nur Daten des aktuellen Börsentags
  if (timeRange === '1d') {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Prüfe ob heute ein Wochenende ist (Samstag = 6, Sonntag = 0)
    const dayOfWeek = now.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    
    let targetDate: Date
    if (isWeekend) {
      // Am Wochenende: Finde den letzten Börsentag (normalerweise Freitag)
      const daysBack = dayOfWeek === 0 ? 2 : 1 // Sonntag: 2 Tage zurück, Samstag: 1 Tag zurück
      targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() - daysBack)
    } else {
      // An einem Börsentag: Verwende heute
      targetDate = today
    }
    
    // Börseneröffnung in EST (9:30 EST = 14:30 UTC im Winter, 13:30 UTC im Sommer)
    // Vereinfacht: 14:30 UTC als Börseneröffnung
    const marketOpenUTC = 14 * 60 + 30 // 14:30 UTC in Minuten
    const targetDateStart = new Date(targetDate)
    targetDateStart.setUTCHours(14, 30, 0, 0) // Börseneröffnung
    const targetDateStartTimestamp = targetDateStart.getTime() / 1000
    
    filteredHistorical = stockData.historical.filter(item => {
      const itemTimestamp = (item as any).timestamp
      if (itemTimestamp) {
        const itemDate = new Date(itemTimestamp * 1000)
        const itemDateOnly = new Date(itemDate.getUTCFullYear(), itemDate.getUTCMonth(), itemDate.getUTCDate())
        const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
        
        // Prüfe ob es der gleiche Tag ist
        if (itemDateOnly.getTime() === targetDateOnly.getTime()) {
          // Prüfe ob es nach Börseneröffnung ist
          return itemTimestamp >= targetDateStartTimestamp
        }
        return false
      }
      
      // Fallback: Prüfe das Datum
      const itemDate = new Date(item.date)
      const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate())
      const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
      return itemDateOnly.getTime() === targetDateOnly.getTime()
    })
    
    // Falls keine Daten für den Börsentag, zeige die letzten verfügbaren Datenpunkte des Tages
    if (filteredHistorical.length === 0 && stockData.historical.length > 0) {
      console.warn(`No data for trading day ${targetDate.toISOString().split('T')[0]}, showing last available data`)
      // Finde die letzten Datenpunkte die zum Börsentag gehören
      const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
      filteredHistorical = stockData.historical.filter(item => {
        const itemTimestamp = (item as any).timestamp
        if (itemTimestamp) {
          const itemDate = new Date(itemTimestamp * 1000)
          const itemDateOnly = new Date(itemDate.getUTCFullYear(), itemDate.getUTCMonth(), itemDate.getUTCDate())
          return itemDateOnly.getTime() === targetDateOnly.getTime()
        }
        const itemDate = new Date(item.date)
        const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate())
        return itemDateOnly.getTime() === targetDateOnly.getTime()
      })
      
      // Falls immer noch keine Daten, nimm die letzten 50 Datenpunkte
      if (filteredHistorical.length === 0) {
        filteredHistorical = stockData.historical.slice(-50)
      }
    }
  }
  
  const chartData = filteredHistorical
    .slice()
    .sort((a, b) => {
      // Sortiere nach Timestamp falls verfügbar, sonst nach Datum
      const aTimestamp = (a as any).timestamp
      const bTimestamp = (b as any).timestamp
      
      if (aTimestamp && bTimestamp) {
        return aTimestamp - bTimestamp
      }
      
      const aTime = aTimestamp ? aTimestamp * 1000 : new Date(a.date).getTime()
      const bTime = bTimestamp ? bTimestamp * 1000 : new Date(b.date).getTime()
      return aTime - bTime
    })
    .map(item => ({
      date: formatDate(item.date, (item as any).timestamp, timeRange),
      fullDate: item.date,
      timestamp: (item as any).timestamp,
      price: Number(item.close) || 0,
    }))
    .filter(item => item.price > 0) // Filtere ungültige Preise

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `€${(num / 1e12).toFixed(2)}T`
    if (num >= 1e9) return `€${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `€${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `€${(num / 1e3).toFixed(2)}K`
    return `€${num.toFixed(2)}`
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-luxury-dark via-luxury-charcoal to-luxury-dark">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/aktien"
            className="inline-flex items-center text-primary-400 hover:text-primary-300 mb-4 transition-colors"
          >
            ← Zurück zur Übersicht
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold text-white mb-2 bg-gradient-to-r from-white via-gold-300 to-primary-400 bg-clip-text text-transparent">
                {stockData.name}
              </h1>
              <p className="text-2xl text-slate-400">{stockData.symbol}</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-white mb-2">
                €{stockData.price.toFixed(2)}
              </div>
              <div className={`text-xl font-semibold ${
                stockData.change >= 0 ? 'text-gold-400' : 'text-red-400'
              }`}>
                {stockData.change >= 0 ? '+' : ''}
                {stockData.change.toFixed(2)} ({stockData.changePercent >= 0 ? '+' : ''}
                {stockData.changePercent.toFixed(2)}%)
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">
              Kursverlauf - {timeRanges.find(r => r.value === timeRange)?.label || '3 Monate'}
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-400">{chartData.length} Datenpunkte</p>
            </div>
          </div>
          
          {/* Zeitraum-Auswahl */}
          <div className="mb-4 flex flex-wrap gap-2">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeRange === range.value
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-600/30'
                    : 'bg-luxury-dark/60 text-slate-300 hover:bg-luxury-dark/80 hover:text-white border border-luxury-anthracite/30'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                  angle={timeRange === '1d' ? -45 : -45}
                  textAnchor="end"
                  height={60}
                  interval={timeRange === '1d' 
                    ? (chartData.length > 50 ? Math.floor(chartData.length / 12) : 0)
                    : (chartData.length > 30 ? Math.floor(chartData.length / 10) : 0)
                  }
                />
                <YAxis 
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `€${value.toFixed(0)}`}
                  domain={['auto', 'auto']}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a', 
                    border: '1px solid #f97316',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => [`€${value.toFixed(2)}`, 'Preis']}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#f97316" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#f97316' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center bg-luxury-dark/30 rounded-lg">
              <p className="text-slate-400">Keine Chart-Daten verfügbar</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unternehmensdaten */}
          <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">
              Unternehmensdaten
            </h2>
            
            {companyDetails ? (
              <div className="space-y-4">
                {/* Basis-Informationen */}
                {(companyDetails.sector && companyDetails.sector !== 'N/A') && (
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Sektor</p>
                    <p className="text-white font-medium">{companyDetails.sector}</p>
                  </div>
                )}
                {(companyDetails.industry && companyDetails.industry !== 'N/A' && companyDetails.industry !== companyDetails.sector) && (
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Branche</p>
                    <p className="text-white font-medium">{companyDetails.industry}</p>
                  </div>
                )}
                {companyDetails.website && (
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Website</p>
                    <a 
                      href={companyDetails.website.startsWith('http') ? companyDetails.website : `https://${companyDetails.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-400 hover:text-primary-300 transition-colors break-all"
                    >
                      {companyDetails.website}
                    </a>
                  </div>
                )}
                {([companyDetails.city, companyDetails.state, companyDetails.country].some(Boolean)) && (
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Standort</p>
                    <p className="text-white font-medium">
                      {[companyDetails.city, companyDetails.state, companyDetails.country]
                        .filter(Boolean)
                        .join(', ') || 'N/A'}
                    </p>
                  </div>
                )}
                {companyDetails.employees > 0 && (
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Mitarbeiter</p>
                    <p className="text-white font-medium">
                      {companyDetails.employees.toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Finanzkennzahlen */}
                <div className="pt-4 border-t border-luxury-anthracite/30">
                  <h3 className="text-lg font-bold text-white mb-3">Finanzkennzahlen</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {companyDetails.marketCap > 0 && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Marktkapitalisierung</p>
                        <p className="text-white font-medium">{formatNumber(companyDetails.marketCap)}</p>
                      </div>
                    )}
                    {companyDetails.enterpriseValue > 0 && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Unternehmenswert</p>
                        <p className="text-white font-medium">{formatNumber(companyDetails.enterpriseValue)}</p>
                      </div>
                    )}
                    {companyDetails.peRatio > 0 && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">KGV (Trailing)</p>
                        <p className="text-white font-medium">{companyDetails.peRatio.toFixed(2)}</p>
                      </div>
                    )}
                    {companyDetails.forwardPE > 0 && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">KGV (Forward)</p>
                        <p className="text-white font-medium">{companyDetails.forwardPE.toFixed(2)}</p>
                      </div>
                    )}
                    {companyDetails.priceToBook > 0 && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Kurs-Buchwert-Verhältnis</p>
                        <p className="text-white font-medium">{companyDetails.priceToBook.toFixed(2)}</p>
                      </div>
                    )}
                    {companyDetails.dividendYield > 0 && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Dividendenrendite</p>
                        <p className="text-white font-medium">{(companyDetails.dividendYield * 100).toFixed(2)}%</p>
                      </div>
                    )}
                    {companyDetails.profitMargins > 0 && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Gewinnmarge</p>
                        <p className="text-white font-medium">{(companyDetails.profitMargins * 100).toFixed(2)}%</p>
                      </div>
                    )}
                    {companyDetails.operatingMargins > 0 && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Betriebsmarge</p>
                        <p className="text-white font-medium">{(companyDetails.operatingMargins * 100).toFixed(2)}%</p>
                      </div>
                    )}
                    {companyDetails.revenueGrowth !== 0 && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Umsatzwachstum</p>
                        <p className={`font-medium ${companyDetails.revenueGrowth >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                          {(companyDetails.revenueGrowth * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}
                    {companyDetails.earningsGrowth !== 0 && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Gewinnwachstum</p>
                        <p className={`font-medium ${companyDetails.earningsGrowth >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                          {(companyDetails.earningsGrowth * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}
                    {companyDetails.targetMeanPrice > 0 && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Analystenziel (Mittel)</p>
                        <p className="text-white font-medium">€{companyDetails.targetMeanPrice.toFixed(2)}</p>
                      </div>
                    )}
                    {companyDetails.recommendationKey && companyDetails.recommendationKey !== 'N/A' && (
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Analystenempfehlung</p>
                        <p className="text-white font-medium capitalize">{companyDetails.recommendationKey}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Hinweis wenn keine Finanzkennzahlen verfügbar */}
                  {companyDetails.marketCap === 0 && 
                   companyDetails.peRatio === 0 && 
                   companyDetails.dividendYield === 0 && 
                   companyDetails.profitMargins === 0 && (
                    <div className="mt-4 p-3 bg-luxury-anthracite/30 rounded-lg">
                      <p className="text-slate-400 text-xs mb-2">
                        ⚠️ Detaillierte Finanzkennzahlen sind derzeit nicht verfügbar.
                      </p>
                      <p className="text-slate-500 text-xs">
                        Um detaillierte Unternehmensdaten zu sehen, benötigst du einen kostenlosen Alpha Vantage API-Key.
                        Erstelle eine <code className="text-primary-400">.env.local</code> Datei mit: <code className="text-primary-400">ALPHA_VANTAGE_API_KEY=dein_key</code>
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        Kostenlosen Key bekommen: <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300 underline">alphavantage.co/support/#api-key</a>
                      </p>
                    </div>
                  )}
                </div>

                {companyDetails.description && (
                  <div className="pt-4 border-t border-luxury-anthracite/30">
                    <p className="text-slate-400 text-sm mb-2">Über das Unternehmen</p>
                    <p className="text-slate-300 text-sm leading-relaxed line-clamp-4">
                      {companyDetails.description}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-slate-400 mb-2">Unternehmensdaten werden geladen...</p>
                <p className="text-slate-500 text-xs">
                  Falls keine Daten erscheinen, prüfe die Browser-Konsole für Details.
                </p>
              </div>
            )}
          </div>

          {/* News */}
          <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">
              Aktuelle Nachrichten
            </h2>
            
            {news.length > 0 ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {news.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-luxury-dark/60 rounded-lg p-4 hover:bg-luxury-dark/80 transition-all border border-luxury-anthracite/30 hover:border-primary-500/30"
                  >
                    <div className="flex items-start gap-3">
                      {item.imageUrl && (
                        <img 
                          src={item.imageUrl} 
                          alt={item.title}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-slate-400">{item.source}</span>
                          <span className="text-xs text-slate-500">•</span>
                          <span className="text-xs text-slate-400">{item.time}</span>
                        </div>
                        <h3 className="font-semibold text-white mb-1 hover:text-primary-400 transition-colors line-clamp-2">
                          {item.title}
                        </h3>
                        {item.summary && (
                          <p className="text-slate-400 text-sm line-clamp-2">
                            {item.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">Keine Nachrichten verfügbar</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
