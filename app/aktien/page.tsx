import Navigation from '@/components/Navigation'
import StockPrices from '@/components/StockPrices'

export default function AktienPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-luxury-dark via-luxury-charcoal to-luxury-dark">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 bg-gradient-to-r from-white via-gold-300 to-primary-400 bg-clip-text text-transparent">Aktienkurse</h1>
          <p className="text-slate-300">Echtzeit-Aktienkurse und Marktdaten</p>
        </div>
        <div className="max-w-4xl">
          <StockPrices />
        </div>
      </div>
    </main>
  )
}
