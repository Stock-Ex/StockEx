import type { IndicatorConfig, IndicatorData } from './indicator'
import type { BacktestConfig, BacktestResult } from './backtest'
import type { OptimizationConfig, OptimizationResult } from '../optimization/walkForward'

/**
 * Request für serverseitige Indikator-Berechnung
 */
export interface IndicatorComputeRequest {
  symbol: string
  range: string
  config?: Partial<IndicatorConfig>
  backtestConfig?: Partial<BacktestConfig>
  optimization?: {
    enabled: boolean
    optimizationConfig?: Partial<OptimizationConfig>
  }
}

/**
 * Response von serverseitiger Indikator-Berechnung
 */
export interface IndicatorComputeResponse {
  series: IndicatorData[]
  meta: {
    symbol: string
    range: string
    dataPoints: number
    computedAt: string  // ISO timestamp
    source: string      // 'yahoo' | 'alphaVantage' | 'yahoo+alphaVantage'
    cache?: 'HIT' | 'MISS'  // Cache-Status (optional für Rückwärtskompatibilität)
  }
  backtestResult?: BacktestResult
  optimizationResult?: OptimizationResult
}
