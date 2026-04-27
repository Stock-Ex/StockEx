import type { IndicatorConfig } from '../types'

export type Recommendation = 'KAUFEN' | 'VERKAUFEN' | 'HALTEN'

/**
 * Gibt eine Trading-Empfehlung basierend auf Indikator-Daten zurück.
 * Logik aus CustomIndicator.tsx:1067-1088, aber Schwellenwerte aus Parameter.
 */
export function getRecommendation(
  data: { signal: number; value: number; fundamentalScore: number; combinedScore: number },
  thresholds: IndicatorConfig['thresholds']
): Recommendation {
  const technicalSignal = data.signal > data.value
  const fundamentalScore = data.fundamentalScore || 50
  const combinedScore = data.combinedScore || 50
  
  // Lockere Logik: Technische Analyse hat mehr Gewicht
  // KAUFEN: Technisches Signal positiv UND (Fundamentaler Score > threshold ODER Kombinierter Score > threshold)
  if (technicalSignal && (fundamentalScore > thresholds.buyFundamentalMin || combinedScore > thresholds.buyCombinedMin)) {
    return 'KAUFEN'
  } 
  // VERKAUFEN: Technisches Signal negativ UND (Fundamentaler Score < threshold ODER Kombinierter Score < threshold)
  else if (!technicalSignal && (fundamentalScore < thresholds.sellFundamentalMax || combinedScore < thresholds.sellCombinedMax)) {
    return 'VERKAUFEN'
  } 
  // HALTEN: Alles andere
  else {
    return 'HALTEN'
  }
}
