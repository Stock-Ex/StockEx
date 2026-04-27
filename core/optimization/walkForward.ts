import type { IndicatorConfig, CompanyDetails, BacktestConfig } from '../types'
import { DEFAULT_INDICATOR_CONFIG } from '../types/indicator'
import { runBacktest } from '../backtest/engine'
import { calculateObjectiveScore } from './objective'

export interface OptimizationConfig {
  trainTestSplit: number        // Default: 0.7 (70% Training)
  minTradesPerYear: number      // Default: 10
  techWeightRange: { min: number; max: number; step: number }  // Default: { min: 50, max: 80, step: 10 }
  backtestConfig?: Partial<BacktestConfig>
}

export interface OptimizationResult {
  bestConfig: IndicatorConfig
  trainPerformance: {
    winRate: number
    totalReturnPercent: number
    tradeFrequency: number
    balancedScore: number
    totalTrades: number
  }
  testPerformance: {
    winRate: number
    totalReturnPercent: number
    tradeFrequency: number
    balancedScore: number
    totalTrades: number
  }
  allResults: Array<{
    config: IndicatorConfig
    trainPerformance: {
      winRate: number
      totalReturnPercent: number
      tradeFrequency: number
      balancedScore: number
      totalTrades: number
    }
    testPerformance: {
      winRate: number
      totalReturnPercent: number
      tradeFrequency: number
      balancedScore: number
      totalTrades: number
    }
  }>
}

/**
 * Walk-Forward-Optimierung (Lookahead-frei).
 * Train/Test Split, Grid Search auf Train-Set, Evaluation auf Test-Set.
 */
export function optimizeWeightsWalkForward(
  historical: Array<{ date: string; close: number }>,
  companyDetails: CompanyDetails | null,
  optimizationConfig: OptimizationConfig
): OptimizationResult {
  const {
    trainTestSplit = 0.7,
    minTradesPerYear = 10,
    techWeightRange = { min: 50, max: 80, step: 10 },
    backtestConfig = {}
  } = optimizationConfig
  
  if (historical.length < 20) {
    throw new Error('Not enough historical data for optimization')
  }
  
  // Train/Test Split
  const splitIndex = Math.floor(historical.length * trainTestSplit)
  const trainData = historical.slice(0, splitIndex)
  const testData = historical.slice(splitIndex)
  
  if (trainData.length < 10 || testData.length < 10) {
    throw new Error('Train or test set too small')
  }
  
  // Berechne Jahre für Train/Test
  const trainStartDate = new Date(trainData[0].date)
  const trainEndDate = new Date(trainData[trainData.length - 1].date)
  const trainYears = (trainEndDate.getTime() - trainStartDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
  
  const testStartDate = new Date(testData[0].date)
  const testEndDate = new Date(testData[testData.length - 1].date)
  const testYears = (testEndDate.getTime() - testStartDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
  
  // Vordefinierte Konfigurationen (Overfitting-Schutz: nicht zu viele Varianten)
  const techIndicatorConfigs = [
    { rsi: 0.30, ma: 0.60, support: 0.10 },  // Standard
    { rsi: 0.40, ma: 0.50, support: 0.10 },
    { rsi: 0.25, ma: 0.65, support: 0.10 },
    { rsi: 0.35, ma: 0.55, support: 0.10 }
  ]
  
  const fundamentalConfigs = [
    DEFAULT_INDICATOR_CONFIG.fundamentalWeights,  // Standard
    { peRatio: 0.15, pegRatio: 0.20, profitMargin: 0.10, revenueGrowth: 0.25, earningsGrowth: 0.20, dividendYield: 0.10 },
    { peRatio: 0.05, pegRatio: 0.10, profitMargin: 0.20, revenueGrowth: 0.35, earningsGrowth: 0.25, dividendYield: 0.05 }
  ]
  
  const thresholdConfigs = [
    DEFAULT_INDICATOR_CONFIG.thresholds,  // Standard
    { buyFundamentalMin: 45, buyCombinedMin: 50, sellFundamentalMax: 50, sellCombinedMax: 52 },
    { buyFundamentalMin: 55, buyCombinedMin: 55, sellFundamentalMax: 40, sellCombinedMax: 45 }
  ]
  
  const allResults: OptimizationResult['allResults'] = []
  
  // Grid Search auf Train-Set
  for (let techWeight = techWeightRange.min; techWeight <= techWeightRange.max; techWeight += techWeightRange.step) {
    const fundWeight = 100 - techWeight
    
    for (const techIndicators of techIndicatorConfigs) {
      for (const fundMetrics of fundamentalConfigs) {
        for (const thresholds of thresholdConfigs) {
          const config: IndicatorConfig = {
            ...DEFAULT_INDICATOR_CONFIG,
            combinedWeights: {
              technical: techWeight / 100,
              fundamental: fundWeight / 100
            },
            technicalWeights: techIndicators,
            fundamentalWeights: fundMetrics,
            thresholds
          }
          
          // Backtest auf Train-Set
          const trainResult = runBacktest(trainData, companyDetails, config, backtestConfig)
          
          // Trade-Frequenz prüfen
          const trainTradesPerYear = trainYears > 0 ? trainResult.totalTrades / trainYears : 0
          
          if (trainTradesPerYear < minTradesPerYear) {
            continue  // Überspringe Konfigurationen mit zu wenigen Trades
          }
          
          // Objective Score
          const trainBalancedScore = calculateObjectiveScore(trainResult, minTradesPerYear, trainYears)
          
          // Backtest auf Test-Set (für Evaluation)
          const testResult = runBacktest(testData, companyDetails, config, backtestConfig)
          const testTradesPerYear = testYears > 0 ? testResult.totalTrades / testYears : 0
          const testBalancedScore = calculateObjectiveScore(testResult, minTradesPerYear, testYears)
          
          allResults.push({
            config,
            trainPerformance: {
              winRate: trainResult.winRate,
              totalReturnPercent: trainResult.totalReturnPercent,
              tradeFrequency: trainTradesPerYear,
              balancedScore: trainBalancedScore,
              totalTrades: trainResult.totalTrades
            },
            testPerformance: {
              winRate: testResult.winRate,
              totalReturnPercent: testResult.totalReturnPercent,
              tradeFrequency: testTradesPerYear,
              balancedScore: testBalancedScore,
              totalTrades: testResult.totalTrades
            }
          })
        }
      }
    }
  }
  
  if (allResults.length === 0) {
    // Fallback: Verwende Standard-Config
    const defaultConfig = DEFAULT_INDICATOR_CONFIG
    const trainResult = runBacktest(trainData, companyDetails, defaultConfig, backtestConfig)
    const testResult = runBacktest(testData, companyDetails, defaultConfig, backtestConfig)
    const trainTradesPerYear = trainYears > 0 ? trainResult.totalTrades / trainYears : 0
    const testTradesPerYear = testYears > 0 ? testResult.totalTrades / testYears : 0
    
    return {
      bestConfig: defaultConfig,
      trainPerformance: {
        winRate: trainResult.winRate,
        totalReturnPercent: trainResult.totalReturnPercent,
        tradeFrequency: trainTradesPerYear,
        balancedScore: calculateObjectiveScore(trainResult, minTradesPerYear, trainYears),
        totalTrades: trainResult.totalTrades
      },
      testPerformance: {
        winRate: testResult.winRate,
        totalReturnPercent: testResult.totalReturnPercent,
        tradeFrequency: testTradesPerYear,
        balancedScore: calculateObjectiveScore(testResult, minTradesPerYear, testYears),
        totalTrades: testResult.totalTrades
      },
      allResults: []
    }
  }
  
  // Finde beste Konfiguration (basierend auf Train-Performance)
  const bestResult = allResults.reduce((best, current) =>
    current.trainPerformance.balancedScore > best.trainPerformance.balancedScore ? current : best
  )
  
  return {
    bestConfig: bestResult.config,
    trainPerformance: bestResult.trainPerformance,
    testPerformance: bestResult.testPerformance,
    allResults: allResults.slice(0, 20)  // Limitiere auf Top 20 für Performance
  }
}
