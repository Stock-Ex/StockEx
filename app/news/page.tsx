import Navigation from '@/components/Navigation'
import NewsFeed from '@/components/NewsFeed'

export default function NewsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-luxury-dark via-luxury-charcoal to-luxury-dark">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 bg-gradient-to-r from-white via-gold-300 to-primary-400 bg-clip-text text-transparent">Finanznachrichten</h1>
          <p className="text-slate-300">Aktuelle Nachrichten und Analysen aus der Finanzwelt</p>
        </div>
        <NewsFeed />
      </div>
    </main>
  )
}
