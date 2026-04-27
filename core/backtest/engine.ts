import type { IndicatorData, IndicatorConfig, CompanyDetails, BacktestResult, BacktestConfig } from '../types'
import { buildIndicatorSeries } from '../pipeline/builder'
import { getRecommendation } from '../signals/recommendation'
import { calculateMaxDrawdown, calculateProfitFactor, calculateExpectancy, calculateAvgHoldDays } from './metrics'

const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  stopLossPercent: 0.05,
  fees: 0,
  slippage: 0,
  minHoldDays: 0,
  maxHoldDays: Infinity,
  initialCapital: 10000,
  positionSizePercent: 1.0
}

/**
 * Führt einen zeitkorrekten Backtest durch (Lookahead-frei).
 * Performance: buildIndicatorSeries wird nur EINMAL aufgerufen.
 */
export function runBacktest(
  historical: Array<{ date: string; close: number }>,
  companyDetails: CompanyDetails | null,
  config: IndicatorConfig,
  backtestConfig?: Partial<BacktestConfig>
): BacktestResult {
  const cfg: BacktestConfig = { ...DEFAULT_BACKTEST_CONFIG, ...backtestConfig }
  
  if (historical.length < config.rsiPeriod) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      bestTrade: 0,
      worstTrade: 0,
      averageReturn: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      expectancy: 0,
      avgHoldDays: 0,
      trades: []
    }
  }
  
  // PERFORMANCE: Berechne Indicator Series EINMAL für gesamtes historical
  const series = buildIndicatorSeries(historical, companyDetails, config)
  
  if (series.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      bestTrade: 0,
      worstTrade: 0,
      averageReturn: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      expectancy: 0,
      avgHoldDays: 0,
      trades: []
    }
  }
  
  // PERFORMANCE: Mappe series zurück zu historical (einmalig, nicht pro Bar)
  // series[k] entspricht historical[config.rsiPeriod + k] (linear mapping, da buildIndicatorSeries sequenziell arbeitet)
  // Für genauere Zuordnung verwenden wir isoDate-Matching, aber mit Fallback
  const seriesToHistoricalMap = new Map<number, number>()
  for (let k = 0; k < series.length; k++) {
    const seriesDate = series[k].isoDate
    if (seriesDate) {
      // Finde Index in historical durch Date-Matching
      for (let i = config.rsiPeriod; i < historical.length; i++) {
        if (historical[i].date === seriesDate || 
            new Date(historical[i].date).getTime() === new Date(seriesDate).getTime()) {
          seriesToHistoricalMap.set(k, i)
          break
        }
      }
    }
    // Fallback: Linear mapping (series[k] = historical[config.rsiPeriod + k])
    if (!seriesToHistoricalMap.has(k)) {
      const fallbackIndex = config.rsiPeriod + k
      if (fallbackIndex < historical.length) {
        seriesToHistoricalMap.set(k, fallbackIndex)
      }
    }
  }
  
  const getHistoricalIndex = (seriesIndex: number): number => {
    return seriesToHistoricalMap.get(seriesIndex) ?? -1
  }
  
  const trades: BacktestResult['trades'] = []
  let position: 'LONG' | null = null
  let entryPrice = 0
  let entryDate = ''
  let entryIndex = -1
  let entryScores: { technical: number; fundamental: number; combined: number } | undefined
  let entrySeriesIndex = -1
  
  // Iteriere über series (nicht über raw historical)
  for (let k = 0; k < series.length; k++) {
    const current = series[k]
    const histIndex = getHistoricalIndex(k)
    
    if (histIndex < 0 || histIndex >= historical.length) continue
    
    const currentPrice = historical[histIndex].close
    const currentDate = historical[histIndex].date
    
    // Empfehlung mit zeitkorrekten Features
    const recommendation = getRecommendation(
      {
        signal: current.signal,
        value: current.value,
        fundamentalScore: current.fundamentalScore,
        combinedScore: current.combinedScore
      },
      config.thresholds
    )
    
    // Exit-Logik
    if (position === 'LONG') {
      const entryHistIndex = getHistoricalIndex(entrySeriesIndex)
      if (entryHistIndex < 0) continue
      
      const entryDateObj = new Date(historical[entryHistIndex].date)
      const currentDateObj = new Date(currentDate)
      const holdDays = Math.floor((currentDateObj.getTime() - entryDateObj.getTime()) / (1000 * 60 * 60 * 24))
      
      let shouldExit = false
      let exitReason = ''
      
      // Stop-Loss prüfen
      const stopLossPrice = entryPrice * (1 - cfg.stopLossPercent)
      if (currentPrice <= stopLossPrice) {
        shouldExit = true
        exitReason = 'Stop-Loss'
      }
      // Verkaufs-Signal
      else if (recommendation === 'VERKAUFEN') {
        if (holdDays >= cfg.minHoldDays) {
          shouldExit = true
          exitReason = 'VERKAUFEN-Signal'
        }
      }
      // Max Hold Days
      else if (holdDays >= cfg.maxHoldDays) {
        shouldExit = true
        exitReason = 'Max Hold Days'
      }
      
      if (shouldExit) {
        // Berechne Exit-Preis mit Slippage und Fees
        const exitPrice = currentPrice * (1 - cfg.slippage) - cfg.fees
        
        // Return basierend auf Entry-Preis (entryPrice enthält bereits Slippage+Fees)
        // Return in absoluten Beträgen (für Metriken)
        const returnAmount = exitPrice - entryPrice
        // Return in Prozent (für Metriken)
        const returnPercent = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0
        
        trades.push({
          entryDate: historical[entryHistIndex].date,
          exitDate: currentDate,
          entryPrice,
          exitPrice,
          return: returnAmount,
          returnPercent,
          type: 'BUY',
          entryReason: entryScores ? `Score: ${entryScores.combined.toFixed(1)}` : 'KAUFEN-Signal',
          exitReason,
          holdDays,
          entryScore: entryScores
        })
        
        position = null
      }
    }
    
    // Entry-Logik
    if (position === null && recommendation === 'KAUFEN') {
      // Berechne Entry-Preis mit Slippage und Fees
      const entryPriceWithSlippage = currentPrice * (1 + cfg.slippage)
      const entryPriceWithCosts = entryPriceWithSlippage + cfg.fees
      
      position = 'LONG'
      entryPrice = entryPriceWithCosts
      entryDate = currentDate
      entryIndex = histIndex
      entrySeriesIndex = k
      entryScores = {
        technical: current.technicalScore || 0,
        fundamental: current.fundamentalScore,
        combined: current.combinedScore
      }
    }
  }
  
  // Schließe offene Position am Ende
  if (position === 'LONG' && series.length > 0) {
    const lastSeriesIndex = series.length - 1
    const lastHistIndex = getHistoricalIndex(lastSeriesIndex)
    const entryHistIndex = getHistoricalIndex(entrySeriesIndex)
    
    if (lastHistIndex >= 0 && entryHistIndex >= 0) {
      const last = historical[lastHistIndex]
      const entryDateObj = new Date(historical[entryHistIndex].date)
      const lastDateObj = new Date(last.date)
      const holdDays = Math.floor((lastDateObj.getTime() - entryDateObj.getTime()) / (1000 * 60 * 60 * 24))
      
      const exitPrice = last.close * (1 - cfg.slippage) - cfg.fees
      
      // Return basierend auf Entry-Preis
      const returnAmount = exitPrice - entryPrice
      const returnPercent = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0
      
      trades.push({
        entryDate: historical[entryHistIndex].date,
        exitDate: last.date,
        entryPrice,
        exitPrice,
        return: returnAmount,
        returnPercent,
        type: 'BUY',
        entryReason: entryScores ? `Score: ${entryScores.combined.toFixed(1)}` : 'KAUFEN-Signal',
        exitReason: 'End of Data',
        holdDays,
        entryScore: entryScores
      })
    }
  }
  
  // Berechne Basis-Metriken
  const winningTrades = trades.filter(t => t.return > 0).length
  const losingTrades = trades.filter(t => t.return <= 0).length
  
  // Total Return: Summe aller Trade-Returns (in absoluten Beträgen)
  const totalReturn = trades.reduce((sum, t) => sum + t.return, 0)
  // Total Return Percent: Bezogen auf initialCapital
  const totalReturnPercent = cfg.initialCapital > 0 ? (totalReturn / cfg.initialCapital) * 100 : 0
  
  const avgReturn = trades.length > 0 ? totalReturn / trades.length : 0
  const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.returnPercent)) : 0
  const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.returnPercent)) : 0
  
  // Berechne erweiterte Metriken
  const maxDrawdown = calculateMaxDrawdown(trades, cfg.initialCapital, cfg.positionSizePercent)
  const profitFactor = calculateProfitFactor(trades)
  const expectancy = calculateExpectancy(trades)
  const avgHoldDays = calculateAvgHoldDays(trades)
  
  return {
    totalTrades: trades.length,
    winningTrades,
    losingTrades,
    winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
    totalReturn,
    totalReturnPercent,
    bestTrade,
    worstTrade,
    averageReturn: avgReturn,
    maxDrawdown,
    profitFactor,
    expectancy,
    avgHoldDays,
    trades
  }
}
