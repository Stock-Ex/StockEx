import Navigation from '@/components/Navigation'

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-luxury-dark via-luxury-charcoal to-luxury-dark">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-white mb-2 bg-gradient-to-r from-white via-gold-300 to-primary-400 bg-clip-text text-transparent">About us</h1>
            <p className="text-slate-300">Erfahren Sie mehr über StockEx</p>
          </div>

          <div className="space-y-6">
            <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">Unsere Mission</h2>
              <p className="text-slate-300 leading-relaxed">
                StockEx wurde entwickelt, um allen Interessierten einen einfachen und professionellen 
                Zugang zu Finanzmarktdaten zu bieten. Wir glauben, dass jeder die Möglichkeit haben sollte, 
                fundierte Entscheidungen auf Basis aktueller Informationen zu treffen.
              </p>
            </div>

            <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">Was wir bieten</h2>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-start">
                  <span className="text-primary-400 mr-2">•</span>
                  <span><strong className="text-white">Echtzeit-Aktienkurse:</strong> Aktuelle Preise und Marktdaten für verschiedene Aktien</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-400 mr-2">•</span>
                  <span><strong className="text-white">Finanznachrichten:</strong> Aktuelle Nachrichten und Analysen aus der Finanzwelt</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-400 mr-2">•</span>
                  <span><strong className="text-white">Trading-Indikatoren:</strong> Professionelle Indikatoren für Marktanalysen</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-400 mr-2">•</span>
                  <span><strong className="text-white">Benutzerfreundliche Oberfläche:</strong> Moderne und intuitive Bedienung</span>
                </li>
              </ul>
            </div>

            <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">Unsere Technologie</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                StockEx basiert auf modernsten Web-Technologien:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-luxury-dark/60 rounded-lg border border-luxury-anthracite/30">
                  <div className="text-2xl font-bold text-primary-400 mb-1">Next.js</div>
                  <div className="text-sm text-slate-400">Framework</div>
                </div>
                <div className="text-center p-4 bg-luxury-dark/60 rounded-lg border border-luxury-anthracite/30">
                  <div className="text-2xl font-bold text-primary-400 mb-1">React</div>
                  <div className="text-sm text-slate-400">UI Library</div>
                </div>
                <div className="text-center p-4 bg-luxury-dark/60 rounded-lg border border-luxury-anthracite/30">
                  <div className="text-2xl font-bold text-primary-400 mb-1">TypeScript</div>
                  <div className="text-sm text-slate-400">Type Safety</div>
                </div>
                <div className="text-center p-4 bg-luxury-dark/60 rounded-lg border border-luxury-anthracite/30">
                  <div className="text-2xl font-bold text-primary-400 mb-1">Tailwind</div>
                  <div className="text-sm text-slate-400">Styling</div>
                </div>
              </div>
            </div>

            <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">Kontakt</h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Haben Sie Fragen oder Anregungen? Wir freuen uns über Ihr Feedback!
              </p>
              <a 
                href="/kontakt" 
                className="inline-block px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-lg transition-all shadow-lg shadow-primary-600/30 hover:shadow-primary-500/50 font-medium"
              >
                Kontakt aufnehmen
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
