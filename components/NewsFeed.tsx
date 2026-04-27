'use client'

import { useState, useEffect } from 'react'

interface NewsItem {
  id: number
  title: string
  source: string
  time: string
  category: string
}

export default function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simuliere Nachrichten
    const mockNews: NewsItem[] = [
      {
        id: 1,
        title: 'Tech-Aktien steigen nach starken Quartalszahlen',
        source: 'Financial Times',
        time: 'vor 2 Stunden',
        category: 'Markt',
      },
      {
        id: 2,
        title: 'Neue Regulierungen für Kryptowährungen in Europa',
        source: 'Bloomberg',
        time: 'vor 4 Stunden',
        category: 'Regulierung',
      },
      {
        id: 3,
        title: 'Energiewende: Investitionen in erneuerbare Energien steigen',
        source: 'Reuters',
        time: 'vor 6 Stunden',
        category: 'Energie',
      },
      {
        id: 4,
        title: 'Zentralbanken halten Zinsen stabil',
        source: 'Wall Street Journal',
        time: 'vor 8 Stunden',
        category: 'Politik',
      },
      {
        id: 5,
        title: 'KI-Unternehmen verzeichnen Rekordumsätze',
        source: 'TechCrunch',
        time: 'vor 12 Stunden',
        category: 'Technologie',
      },
    ]

    setIsLoading(false)
    setNews(mockNews)
  }, [])

  if (isLoading) {
    return (
      <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-luxury-anthracite rounded w-1/3"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-luxury-anthracite rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">Finanznachrichten</h2>
      <div className="space-y-4">
        {news.map((item) => (
          <div
            key={item.id}
            className="bg-luxury-dark/60 rounded-lg p-4 hover:bg-luxury-dark/80 transition-all cursor-pointer border-l-4 border-primary-500 hover:border-primary-400"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="px-2 py-1 bg-primary-500/20 text-primary-300 text-xs rounded border border-primary-500/30">
                    {item.category}
                  </span>
                  <span className="text-slate-400 text-xs">{item.time}</span>
                </div>
                <h3 className="font-semibold text-white mb-1 hover:text-primary-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-slate-400 text-sm">{item.source}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button className="mt-4 w-full px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-lg text-sm transition-all shadow-lg shadow-primary-600/30 hover:shadow-primary-500/50 font-medium">
        Mehr Nachrichten laden
      </button>
    </div>
  )
}
