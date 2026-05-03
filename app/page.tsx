'use client'

import Navigation from '@/components/Navigation'
import Auth from '@/components/Auth'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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

export default function Home() {
  const [indices, setIndices] = useState<IndexData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const response = await fetch('/api/indices')
        if (response.ok) {
          const data = await response.json()
          setIndices(data)
        }
      } catch (error) {
        console.error('Error fetching indices:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchIndices()
  }, [])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const formatChange = (change: number, changePercent: number) => {
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-luxury-dark via-luxury-charcoal to-luxury-dark">
      <Navigation />
      <div className="container mx-auto px-4 py-12">
        <Auth />

        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4 bg-gradient-to-r from-white via-gold-300 to-primary-400 bg-clip-text text-transparent">
            Willkommen bei StockEx
          </h1>
          <p className="text-xl text-slate-300 mb-8 font-light tracking-wide">
            Ihre exklusive Plattform für Aktienkurse, Finanznachrichten und professionelle Indikatoren
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Link href="/aktien" className="group">
            <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 hover:border-primary-500/50 transition-all hover:shadow-2xl hover:shadow-primary-500/20 hover:-translate-y-1">
              <div className="text-4xl mb-4">📈</div>
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-primary-400 transition-colors">Aktien</h2>
              <p className="text-slate-400">Echtzeit-Aktienkurse und Marktdaten</p>
            </div>
          </Link>

          <Link href="/news" className="group">
            <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 hover:border-primary-500/50 transition-all hover:shadow-2xl hover:shadow-primary-500/20 hover:-translate-y-1">
              <div className="text-4xl mb-4">📰</div>
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-primary-400 transition-colors">News</h2>
              <p className="text-slate-400">Aktuelle Finanznachrichten und Marktanalysen</p>
            </div>
          </Link>

          <Link href="/indikator" className="group">
            <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 hover:border-primary-500/50 transition-all hover:shadow-2xl hover:shadow-primary-500/20 hover:-translate-y-1">
              <div className="text-4xl mb-4">📊</div>
              <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-primary-400 transition-colors">Indikator</h2>
              <p className="text-slate-400">Professionelle Trading-Indikatoren</p>
            </div>
          </Link>
        </div>

        {/* Index Charts */}
        {!isLoading && indices.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent text-center">
              Wichtige Indizes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {indices.map((index) => (
                <div
                  key={index.symbol}
                  className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-4 border border-luxury-anthracite/50 shadow-xl"
                >
                  <div className="mb-3">
                    <h3 className="text-lg font-bold text-white mb-1">{index.name}</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-white">{formatPrice(index.price)}</span>
                      <span
                        className={`text-sm font-medium ${
                          index.change >= 0 ? 'text-gold-400' : 'text-red-400'
                        }`}
                      >
                        {formatChange(index.change, index.changePercent)}
                      </span>
                    </div>
                  </div>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={index.historical}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                        <XAxis
                          dataKey="date"
                          tick={false}
                          axisLine={false}
                          height={0}
                        />
                        <YAxis
                          tick={false}
                          axisLine={false}
                          width={0}
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
                            })
                          }}
                          formatter={(value: number) => [formatPrice(value), 'Kurs']}
                        />
                        <Line
                          type="monotone"
                          dataKey="close"
                          stroke={index.change >= 0 ? '#fbbf24' : '#ef4444'}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: index.change >= 0 ? '#fbbf24' : '#ef4444' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-6 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent text-center">
              Wichtige Indizes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-4 border border-luxury-anthracite/50 shadow-xl"
                >
                  <div className="animate-pulse">
                    <div className="h-6 bg-luxury-anthracite rounded w-24 mb-2"></div>
                    <div className="h-8 bg-luxury-anthracite rounded w-32 mb-4"></div>
                    <div className="h-32 bg-luxury-anthracite rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-8 border border-luxury-anthracite/50 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">Über StockEx</h2>
          <p className="text-slate-300 mb-4 leading-relaxed">
            StockEx ist eine exklusive Plattform für alle, die sich für Finanzmärkte interessieren. 
            Wir bieten Ihnen Zugang zu aktuellen Aktienkursen, relevanten Finanznachrichten und 
            professionellen Trading-Indikatoren.
          </p>
          <div className="flex gap-4 mt-6">
            <Link 
              href="/about" 
              className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-lg transition-all shadow-lg shadow-primary-600/30 hover:shadow-primary-500/50 font-medium"
            >
              Mehr erfahren
            </Link>
            <Link 
              href="/kontakt" 
              className="px-6 py-3 bg-luxury-anthracite hover:bg-luxury-anthracite/80 text-white rounded-lg transition-all border border-luxury-anthracite/50 font-medium"
            >
              Kontakt aufnehmen
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
