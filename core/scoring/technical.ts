import type { IndicatorConfig } from '../types'

/**
 * Berechnet den technischen Score (0-100) basierend auf RSI, MA und Support.
 * Logik aus CustomIndicator.tsx:993-1004, aber Gewichte aus Parameter.
 */
export function calculateTechnicalScore(
  rsiValue: number,
  maValue: number,
  supportScore: number,
  weights: IndicatorConfig['technicalWeights']
): number {
  // Gewichteter technischer Score: RSI * weight + MA * weight + Support * weight
  return (rsiValue * weights.rsi) + (maValue * weights.ma) + (supportScore * weights.support)
}
