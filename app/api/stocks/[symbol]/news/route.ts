import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const symbolUpper = symbol.toUpperCase()

  try {
    console.log(`Fetching news for ${symbolUpper}...`)
    
    // Hole News für die Aktie
    const response = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${symbolUpper}&quotesCount=1&newsCount=10`,
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
    const news = data.news || []
    
    const formattedNews = news.map((item: any) => {
      const publishTime = item.providerPublishTime ? new Date(item.providerPublishTime * 1000) : new Date()
      const now = new Date()
      const diffMs = now.getTime() - publishTime.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffHours / 24)
      
      let timeAgo = ''
      if (diffDays > 0) {
        timeAgo = `vor ${diffDays} ${diffDays === 1 ? 'Tag' : 'Tagen'}`
      } else if (diffHours > 0) {
        timeAgo = `vor ${diffHours} ${diffHours === 1 ? 'Stunde' : 'Stunden'}`
      } else {
        timeAgo = 'vor weniger als einer Stunde'
      }
      
      return {
        id: item.uuid || Math.random().toString(),
        title: item.title || '',
        summary: item.summary || '',
        source: item.publisher || 'Unbekannt',
        time: timeAgo,
        url: item.link || '',
        imageUrl: item.thumbnail?.resolutions?.[0]?.url || null,
        publishTime: publishTime.toISOString(),
      }
    })
    
    console.log(`Successfully fetched ${formattedNews.length} news items for ${symbolUpper}`)
    
    return NextResponse.json(formattedNews, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (error: any) {
    console.error(`Error fetching news for ${symbolUpper}:`, error?.message || error)
    return NextResponse.json(
      { error: `Failed to fetch news for ${symbolUpper}`, details: error?.message },
      { status: 500 }
    )
  }
}
