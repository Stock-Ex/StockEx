'use client'

import Navigation from '@/components/Navigation'
import { useState } from 'react'

export default function KontaktPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    betreff: '',
    nachricht: '',
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')

    // Simuliere Formularversand
    setTimeout(() => {
      setIsSubmitting(false)
      setSubmitStatus('success')
      setFormData({ name: '', email: '', betreff: '', nachricht: '' })
      
      setTimeout(() => {
        setSubmitStatus('idle')
      }, 5000)
    }, 1000)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-luxury-dark via-luxury-charcoal to-luxury-dark">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-white mb-2 bg-gradient-to-r from-white via-gold-300 to-primary-400 bg-clip-text text-transparent">Kontakt</h1>
            <p className="text-slate-300">Nehmen Sie Kontakt mit uns auf</p>
          </div>

          <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl mb-6">
            <h2 className="text-xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">Kontaktinformationen</h2>
            <div className="space-y-3 text-slate-300">
              <div className="flex items-center">
                <span className="text-primary-400 mr-3">📧</span>
                <span>info@stockex-v2.com</span>
              </div>
              <div className="flex items-center">
                <span className="text-primary-400 mr-3">📞</span>
                <span>+49 (0) 123 456 789</span>
              </div>
              <div className="flex items-center">
                <span className="text-primary-400 mr-3">📍</span>
                <span>Musterstraße 123, 12345 Musterstadt</span>
              </div>
            </div>
          </div>

          <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-4 bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">Nachricht senden</h2>
            
            {submitStatus === 'success' && (
              <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400">
                Vielen Dank! Ihre Nachricht wurde erfolgreich gesendet.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-luxury-dark/60 border border-luxury-anthracite/50 rounded-lg text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                  placeholder="Ihr Name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  E-Mail *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-luxury-dark/60 border border-luxury-anthracite/50 rounded-lg text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                  placeholder="ihre.email@example.com"
                />
              </div>

              <div>
                <label htmlFor="betreff" className="block text-sm font-medium text-slate-300 mb-2">
                  Betreff *
                </label>
                <select
                  id="betreff"
                  name="betreff"
                  required
                  value={formData.betreff}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-luxury-dark/60 border border-luxury-anthracite/50 rounded-lg text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                >
                  <option value="">Bitte wählen...</option>
                  <option value="allgemein">Allgemeine Anfrage</option>
                  <option value="technisch">Technische Unterstützung</option>
                  <option value="feedback">Feedback</option>
                  <option value="partnerschaft">Partnerschaft</option>
                  <option value="sonstiges">Sonstiges</option>
                </select>
              </div>

              <div>
                <label htmlFor="nachricht" className="block text-sm font-medium text-slate-300 mb-2">
                  Nachricht *
                </label>
                <textarea
                  id="nachricht"
                  name="nachricht"
                  required
                  rows={6}
                  value={formData.nachricht}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-luxury-dark/60 border border-luxury-anthracite/50 rounded-lg text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none transition-all"
                  placeholder="Ihre Nachricht..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 disabled:from-luxury-anthracite disabled:to-luxury-anthracite disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-lg shadow-primary-600/30 hover:shadow-primary-500/50 font-medium"
              >
                {isSubmitting ? 'Wird gesendet...' : 'Nachricht senden'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
