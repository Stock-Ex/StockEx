import type { IndicatorData, IndicatorConfig, CompanyDetails } from '../types'
import { calculateRSI } from '../features/rsi'
import { calculateMA } from '../features/movingAverage'
import { calculateSupportResistanceLevelsAtTime, calculateSupportScore } from '../levels/supportResistance'
import { calculateFundamentalScore } from '../scoring/fundamental'
import { calculateTechnicalScore } from '../scoring/technical'
import { calculateCombinedScore } from '../scoring/combined'

/**
 * Baut eine Zeitreihe von Indikator-Daten auf (zeitkorrekt).
 * Für jeden Index i werden nur Daten <= i verwendet.
 * 
 * @param historical Historische Preisdaten
 * @param companyDetails Unternehmensdaten (optional)
 * @param config Indikator-Konfiguration
 * @returns Array von IndicatorData
 */
export function buildIndicatorSeries(
  historical: Array<{ date: string; close: number }>,
  companyDetails: CompanyDetails | null,
  config: IndicatorConfig
): IndicatorData[] {
  if (historical.length < config.rsiPeriod) {
    return []
  }
  
  const result: IndicatorData[] = []
  const prices = historical.map(h => h.close)
  
  // Berechne fundamentalen Score einmal (statisch)
  const fundamentalScore = calculateFundamentalScore(
    companyDetails,
    config.fundamentalWeights
  )
  
  // Für jeden Datenpunkt (zeitkorrekt)
  // Starte bei rsiPeriod, damit RSI berechnet werden kann
  for (let i = config.rsiPeriod; i < historical.length; i++) {
    const price = prices[i]
    const date = historical[i].date
    
    // 1. RSI: Nur Daten [i - period, i]
    const rsi = calculateRSI(prices, config.rsiPeriod, i)
    const rsiValue = rsi // RSI ist bereits 0-100
    
    // 2. MA: Nur Daten [i - period + 1, i]
    const ma = calculateMA(prices, config.maPeriod, i)
    const maDistance = ((price - ma) / ma) * 100
    const maValue = 50 + Math.min(Math.max(maDistance * 5, -50), 50) // Normalisiert auf 0-100
    
    // 3. Support/Resistance: Nur Daten [i - lookbackMonths, i] (zeitkorrekt)
    const levels = calculateSupportResistanceLevelsAtTime(
      historical,
      i,
      {
        supportLookbackMonths: config.supportLookbackMonths,
        supportClusterThreshold: config.supportClusterThreshold,
        supportMinTouches: config.supportMinTouches,
        supportMaxLevels: config.supportMaxLevels
      }
    )
    
    // Filtere Support: Nur Levels UNTERHALB des aktuellen Preises
    const supportLevels = levels.support.filter(level => level < price)
    const supportScore = calculateSupportScore(price, supportLevels)
    
    // 4. Technical Score
    const technicalScore = calculateTechnicalScore(
      rsiValue,
      maValue,
      supportScore,
      config.technicalWeights
    )
    
    // 5. Combined Score
    const combinedScore = calculateCombinedScore(
      technicalScore,
      fundamentalScore,
      config.combinedWeights
    )
    
    // 6. Signal (für Chart-Visualisierung)
    // Signal für Chart: Normalisiere technischen Score auf Preis-Basis für Visualisierung
    const technicalSignal = (technicalScore / 100) * price * 1.1
    
    // Formatierung wie im Original
    const dateObj = new Date(date)
    result.push({
      time: dateObj.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }),
      value: Math.round(ma * 100) / 100,
      signal: Math.round(technicalSignal * 100) / 100,
      price: Math.round(price * 100) / 100,
      fundamentalScore: Math.round(fundamentalScore * 10) / 10,
      combinedScore: Math.round(combinedScore * 10) / 10,
      // Optional (für Debug/Später):
      technicalScore,
      rsi,
      maDistance,
      supportScore,
      // Intern (für Backtest): ISO-Datum für Date-Matching
      isoDate: date
    })
  }
  
  return result
}
