import type { CompanyDetails, IndicatorConfig } from '../types'

/**
 * Berechnet den fundamentalen Score (0-100) basierend auf Unternehmensdaten.
 * Logik 1:1 aus CustomIndicator.tsx:112-218, aber Gewichte aus Parameter.
 */
export function calculateFundamentalScore(
  details: CompanyDetails | null,
  weights: IndicatorConfig['fundamentalWeights']
): number {
  if (!details) return 50 // Neutral wenn keine Daten
  
  // KGV-Score (0-100)
  let peScore = 50
  if (details.peRatio > 0) {
    if (details.peRatio >= 15 && details.peRatio <= 25) {
      peScore = 80 // Optimal
    } else if (details.peRatio > 10 && details.peRatio < 30) {
      peScore = 60 // Akzeptabel
    } else if (details.peRatio > 30) {
      peScore = 20 // Überbewertet
    } else if (details.peRatio < 10) {
      peScore = 55 // Kann günstig sein, aber riskant
    }
  }
  
  // PEG-Score (0-100)
  let pegScore = 50
  if (details.pegRatio > 0) {
    if (details.pegRatio >= 0.5 && details.pegRatio <= 1.5) {
      pegScore = 80
    } else if (details.pegRatio < 0.5) {
      pegScore = 90 // Sehr günstig
    } else if (details.pegRatio > 2) {
      pegScore = 20 // Überbewertet
    }
  }
  
  // Gewinnmarge-Score (0-100)
  let profitScore = 50
  if (details.profitMargins > 0) {
    const marginPercent = details.profitMargins * 100
    if (marginPercent > 25) {
      profitScore = 100 // Exzellent
    } else if (marginPercent > 15) {
      profitScore = 80 // Gut
    } else if (marginPercent > 5) {
      profitScore = 60 // Akzeptabel
    } else {
      profitScore = 30 // Niedrig
    }
  }
  
  // Umsatzwachstum-Score (0-100)
  let revenueScore = 50
  if (details.revenueGrowth > 0) {
    const growthPercent = details.revenueGrowth * 100
    if (growthPercent > 20) {
      revenueScore = 100 // Sehr stark
    } else if (growthPercent > 10) {
      revenueScore = 80 // Gut
    } else if (growthPercent > 5) {
      revenueScore = 60 // Moderat
    } else {
      revenueScore = 55 // Leicht positiv
    }
  } else if (details.revenueGrowth < 0) {
    revenueScore = Math.max(0, 50 + details.revenueGrowth * 100) // Negatives Wachstum
  }
  
  // Gewinnwachstum-Score (0-100)
  let earningsScore = 50
  if (details.earningsGrowth > 0) {
    const earningsGrowthPercent = details.earningsGrowth * 100
    if (earningsGrowthPercent > 20) {
      earningsScore = 100
    } else if (earningsGrowthPercent > 10) {
      earningsScore = 80
    } else if (earningsGrowthPercent > 5) {
      earningsScore = 60
    } else {
      earningsScore = 55
    }
  } else if (details.earningsGrowth < 0) {
    earningsScore = Math.max(0, 50 + details.earningsGrowth * 100)
  }
  
  // Dividendenrendite-Score (0-100)
  let dividendScore = 50
  if (details.dividendYield > 0) {
    const yieldPercent = details.dividendYield * 100
    if (yieldPercent > 3) {
      dividendScore = 90 // Gute Dividende
    } else if (yieldPercent > 1.5) {
      dividendScore = 70 // Moderate Dividende
    } else {
      dividendScore = 60 // Niedrige Dividende
    }
  }
  
  // Gewichteter fundamentaler Score
  const fundamentalScore = (
    peScore * weights.peRatio +
    pegScore * weights.pegRatio +
    profitScore * weights.profitMargin +
    revenueScore * weights.revenueGrowth +
    earningsScore * weights.earningsGrowth +
    dividendScore * weights.dividendYield
  )
  
  // Begrenze Score auf 0-100
  return Math.max(0, Math.min(100, fundamentalScore))
}
