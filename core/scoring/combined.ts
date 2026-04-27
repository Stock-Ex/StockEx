import type { IndicatorConfig } from '../types'

/**
 * Berechnet den kombinierten Score (0-100) aus technischem und fundamentalem Score.
 * Logik aus CustomIndicator.tsx:1006-1016, aber Gewichte aus Parameter.
 */
export function calculateCombinedScore(
  technicalScore: number,
  fundamentalScore: number,
  weights: IndicatorConfig['combinedWeights']
): number {
  return (technicalScore * weights.technical) + (fundamentalScore * weights.fundamental)
}
