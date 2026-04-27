import type { BacktestResult } from '../types/backtest'

/**
 * Berechnet Max Drawdown über Equity Curve.
 * Drawdown = (Peak - Trough) / Peak * 100
 * 
 * WICHTIG: Equity Curve wird aus Trades aufgebaut, nicht aus einzelnen Bars.
 * Für genauere Berechnung müsste man pro Bar mark-to-market machen, aber das ist O(n²).
 * Diese Version ist O(n) und ausreichend für Phase 2.
 */
export function calculateMaxDrawdown(trades: BacktestResult['trades'], initialCapital: number, positionSizePercent: number): number {
  if (trades.length === 0) return 0
  
  // Baue Equity Curve auf (nur nach Trades)
  const equityCurve: number[] = [initialCapital]
  let currentEquity = initialCapital
  
  for (const trade of trades) {
    // Position Size basierend auf Equity zum Zeitpunkt des Trades
    const positionValue = currentEquity * positionSizePercent
    // Return basierend auf Entry-Preis
    const returnAmount = (trade.returnPercent / 100) * positionValue
    currentEquity += returnAmount
    equityCurve.push(currentEquity)
  }
  
  // Berechne Max Drawdown
  let peak = equityCurve[0]
  let maxDrawdown = 0
  
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) {
      peak = equityCurve[i]
    }
    const drawdown = peak > 0 ? ((peak - equityCurve[i]) / peak) * 100 : 0
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }
  
  return maxDrawdown
}

/**
 * Berechnet Profit Factor = Total Gains / Total Losses
 */
export function calculateProfitFactor(trades: BacktestResult['trades']): number {
  let totalGains = 0
  let totalLosses = 0
  
  for (const trade of trades) {
    if (trade.return > 0) {
      totalGains += trade.return
    } else {
      totalLosses += Math.abs(trade.return)
    }
  }
  
  if (totalLosses === 0) {
    return totalGains > 0 ? Infinity : 0
  }
  
  return totalGains / totalLosses
}

/**
 * Berechnet Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
 */
export function calculateExpectancy(trades: BacktestResult['trades']): number {
  if (trades.length === 0) return 0
  
  const winningTrades = trades.filter(t => t.return > 0)
  const losingTrades = trades.filter(t => t.return <= 0)
  
  const winRate = winningTrades.length / trades.length
  const lossRate = losingTrades.length / trades.length
  
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + t.return, 0) / winningTrades.length
    : 0
  
  const avgLoss = losingTrades.length > 0
    ? Math.abs(losingTrades.reduce((sum, t) => sum + t.return, 0) / losingTrades.length)
    : 0
  
  return (winRate * avgWin) - (lossRate * avgLoss)
}

/**
 * Berechnet durchschnittliche Haltedauer in Tagen
 */
export function calculateAvgHoldDays(trades: BacktestResult['trades']): number {
  if (trades.length === 0) return 0
  
  const totalHoldDays = trades.reduce((sum, t) => sum + t.holdDays, 0)
  return totalHoldDays / trades.length
}
