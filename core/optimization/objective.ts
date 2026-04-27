import type { BacktestResult } from '../types/backtest'

/**
 * Berechnet Objective Score für Optimierung.
 * Balanced Score: WinRate + Return + Trade Frequency
 * Gewichtung: 40% WinRate, 30% Return, 30% Frequency
 */
export function calculateObjectiveScore(
  result: BacktestResult,
  minTradesPerYear: number,
  years: number
): number {
  if (years <= 0 || minTradesPerYear <= 0) {
    return 0
  }
  
  // WinRate normalisiert auf 0-1
  const winRateScore = result.winRate / 100
  
  // Return normalisiert (50% = 1.0)
  const returnScore = Math.min(Math.max(result.totalReturnPercent / 50, 0), 1)
  
  // Trade Frequency
  const tradesPerYear = years > 0 ? result.totalTrades / years : 0
  const frequencyScore = Math.min(tradesPerYear / minTradesPerYear, 1)
  
  // Balanced Score
  return (winRateScore * 0.4) + (returnScore * 0.3) + (frequencyScore * 0.3)
}
