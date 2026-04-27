'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { href: '/', label: 'Startseite' },
    { href: '/news', label: 'News' },
    { href: '/aktien', label: 'Aktien' },
    { href: '/portfolio', label: 'Mein Portfolio' },
    { href: '/indikator', label: 'Indikator' },
    { href: '/about', label: 'About us' },
    { href: '/kontakt', label: 'Kontakt' },
  ]

  return (
    <nav className="bg-luxury-charcoal/95 backdrop-blur-md border-b border-luxury-anthracite/50 sticky top-0 z-50 shadow-lg shadow-black/20">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 hover:opacity-90 transition-opacity group">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 via-primary-600 to-gold-500 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/30 group-hover:shadow-primary-500/50 transition-shadow">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-white font-semibold text-xl tracking-wide">StockEx</span>
          </Link>
          <div className="flex items-center space-x-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium ${
                  pathname === item.href
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-luxury-anthracite/50 hover:text-primary-400'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
