export interface BacktestResult {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalReturn: number
  totalReturnPercent: number
  bestTrade: number
  worstTrade: number
  averageReturn: number
  // NEU (Phase 2):
  maxDrawdown: number
  profitFactor: number
  expectancy: number
  avgHoldDays: number
  trades: Array<{
    entryDate: string
    exitDate: string
    entryPrice: number
    exitPrice: number
    return: number
    returnPercent: number
    type: 'BUY' | 'SELL'
    // NEU (Phase 2):
    entryReason: string
    exitReason: string
    holdDays: number
    entryScore?: {
      technical: number
      fundamental: number
      combined: number
    }
  }>
}

export interface BacktestConfig {
  stopLossPercent: number        // Default: 0.05 (5%)
  fees: number                   // Default: 0
  slippage: number               // Default: 0
  minHoldDays: number            // Default: 0
  maxHoldDays: number            // Default: Infinity
  initialCapital: number         // Default: 10000
  positionSizePercent: number    // Default: 1.0 (100% Kapital pro Trade)
}

export interface BacktestMeta {
  startDate: string
  endDate: string
  years: number
}
