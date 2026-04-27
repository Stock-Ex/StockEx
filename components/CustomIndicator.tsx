'use client'

import { useState, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { IndicatorData, IndicatorConfig, Stock, CompanyDetails, BacktestResult } from '@/core'
import { DEFAULT_INDICATOR_CONFIG, buildIndicatorSeries, calculateSupportResistanceLevelsAtTime, calculateSupportResistanceLevels, calculateSupportScore } from '@/core'
import { getRecommendation as getRecommendationCore } from '@/core/signals/recommendation'
import { calculateFundamentalScore } from '@/core/scoring/fundamental'

interface CustomIndicatorProps {
  selectedStock: Stock
}

export default function CustomIndicator({ selectedStock }: CustomIndicatorProps) {
  const [data, setData] = useState<IndicatorData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showParameterModal, setShowParameterModal] = useState(false)
  const [showTimeframeModal, setShowTimeframeModal] = useState(false)
  const [showBacktest, setShowBacktest] = useState(false)
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null)
  const [isRunningBacktest, setIsRunningBacktest] = useState(false)
  const [showOptimizer, setShowOptimizer] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState<{
    bestWeights: {
      technical: number
      fundamental: number
      technicalIndicators: {
        movingAverage: number
        rsi: number
        support: number
      }
      fundamentalMetrics: {
        peRatio: number
        pegRatio: number
        profitMargin: number
        revenueGrowth: number
        earningsGrowth: number
        dividendYield: number
      }
    }
    bestPerformance: number
    allResults: Array<{
      config: {
        techFund: { tech: number; fund: number }
        techIndicators: { rsi: number; ma: number; support: number }
        fundMetrics: {
          peRatio: number
          pegRatio: number
          profitMargin: number
          revenueGrowth: number
          earningsGrowth: number
          dividendYield: number
        }
      }
      performance: number
      winRate: number
      totalReturn: number
      accuracy: number
    }>
  } | null>(null)
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null)
  const [period, setPeriod] = useState(14)
  const [timeRange, setTimeRange] = useState('3mo')
  const [supportLevels, setSupportLevels] = useState<number[]>([])
  const [resistanceLevels, setResistanceLevels] = useState<number[]>([])
  
  // Guards gegen doppelte Requests
  const isFetchingRef = useRef(false)
  const lastRequestKeyRef = useRef<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)
  // Deduping: Map von requestKey -> Promise (verhindert parallele identische Requests)
  const inflightRequestsRef = useRef<Map<string, Promise<void>>>(new Map())
  // Verhindert Race Conditions bei React Strict Mode: Set von Keys, die gerade erstellt werden
  const creatingRequestsRef = useRef<Set<string>>(new Set())
  
  // Hash-Funktion für Config (stabiler Hash für Cache-Key)
  const hashConfig = (config: Partial<IndicatorConfig>): string => {
    const relevantKeys = ['maPeriod', 'rsiPeriod', 'combinedWeights']
    const hashObj: Record<string, unknown> = {}
    for (const key of relevantKeys) {
      if (config[key as keyof IndicatorConfig] !== undefined) {
        hashObj[key] = config[key as keyof IndicatorConfig]
      }
    }
    return JSON.stringify(hashObj)
  }

  // Backtesting-Funktion (nutzt jetzt Core-Engine)
  const runBacktest = async () => {
    if (data.length < 2) {
      alert('Nicht genügend Daten für Backtesting verfügbar')
      return
    }

    setIsRunningBacktest(true)
    
    try {
      // Hole historische Daten (müssen aus API neu geholt werden, da data nur IndicatorData ist)
      const stockResponse = await fetch(`/api/stocks/${selectedStock.symbol}?range=${timeRange}`)
      if (!stockResponse.ok) {
        throw new Error('Failed to fetch stock data for backtest')
      }
      
      const stockData = await stockResponse.json()
      if (!stockData.historical || stockData.historical.length === 0) {
        throw new Error('No historical data available')
      }
      
      // Bilde historische Daten auf einfaches Format ab
      const historicalCloseSeries = stockData.historical.map((h: { date: string; close: number; open?: number; high?: number; low?: number; volume?: number; timestamp?: number }) => ({
        date: h.date,
        close: h.close
      }))
      
      // Erstelle Config
      const config: IndicatorConfig = {
        ...DEFAULT_INDICATOR_CONFIG,
        maPeriod: period,
        rsiPeriod: 14
      }
      
      // Verwende optimierte Gewichtung falls verfügbar
      if (optimizationResult) {
        config.combinedWeights = {
          technical: optimizationResult.bestWeights.technical / 100,
          fundamental: optimizationResult.bestWeights.fundamental / 100
        }
      }
      
      // Backtest-Konfiguration
      const backtestConfig = {
        stopLossPercent: 0.05,
        fees: 0,
        slippage: 0,
        minHoldDays: 0,
        maxHoldDays: Infinity,
        initialCapital: 10000,
        positionSizePercent: 1.0
      }
      
      // Führe Backtest mit Core-Engine durch
      const { runBacktest: runBacktestCore } = await import('@/core/backtest/engine')
      const result = runBacktestCore(historicalCloseSeries, companyDetails, config, backtestConfig)
      
      setBacktestResult(result)
    } catch (error) {
      console.error('Error running backtest:', error)
      alert('Fehler beim Backtesting: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
    } finally {
      setIsRunningBacktest(false)
    }
  }

  // Walk-Forward-Optimierung (nutzt jetzt Core-Engine, Lookahead-frei)
  const optimizeWeights = async () => {
    if (data.length < 20) {
      alert('Nicht genügend Daten für Optimierung verfügbar (mindestens 20 Datenpunkte)')
      return
    }

    setIsOptimizing(true)
    
    try {
      // Hole historische Daten (müssen aus API neu geholt werden)
      const stockResponse = await fetch(`/api/stocks/${selectedStock.symbol}?range=${timeRange}`)
      if (!stockResponse.ok) {
        throw new Error('Failed to fetch stock data for optimization')
      }
      
      const stockData = await stockResponse.json()
      if (!stockData.historical || stockData.historical.length === 0) {
        throw new Error('No historical data available')
      }
      
      // Bilde historische Daten auf einfaches Format ab
      const historicalCloseSeries = stockData.historical.map((h: { date: string; close: number; open?: number; high?: number; low?: number; volume?: number; timestamp?: number }) => ({
        date: h.date,
        close: h.close
      }))
      
      // Optimierungs-Konfiguration
      const optimizationConfig = {
        trainTestSplit: 0.7,
        minTradesPerYear: 10,
        techWeightRange: { min: 50, max: 80, step: 10 },
        backtestConfig: {
          stopLossPercent: 0.05,
          fees: 0,
          slippage: 0,
          minHoldDays: 0,
          maxHoldDays: Infinity,
          initialCapital: 10000,
          positionSizePercent: 1.0
        }
      }
      
      // Führe Walk-Forward-Optimierung durch
      const { optimizeWeightsWalkForward } = await import('@/core/optimization/walkForward')
      const result = optimizeWeightsWalkForward(historicalCloseSeries, companyDetails, optimizationConfig)
      
      // Konvertiere Ergebnis in UI-Format
      setOptimizationResult({
        bestWeights: {
          technical: result.bestConfig.combinedWeights.technical * 100,
          fundamental: result.bestConfig.combinedWeights.fundamental * 100,
          technicalIndicators: {
            rsi: result.bestConfig.technicalWeights.rsi,
            movingAverage: result.bestConfig.technicalWeights.ma,
            support: result.bestConfig.technicalWeights.support,
          },
          fundamentalMetrics: result.bestConfig.fundamentalWeights,
        },
        bestPerformance: result.trainPerformance.balancedScore,
        allResults: result.allResults.map(r => ({
          config: {
            techFund: {
              tech: r.config.combinedWeights.technical * 100,
              fund: r.config.combinedWeights.fundamental * 100
            },
            techIndicators: r.config.technicalWeights,
            fundMetrics: r.config.fundamentalWeights
          },
          performance: r.trainPerformance.balancedScore,
          winRate: r.trainPerformance.winRate,
          totalReturn: r.trainPerformance.totalReturnPercent,
          accuracy: r.trainPerformance.winRate  // Verwende WinRate als Accuracy-Proxy
        }))
      })
      
      setIsOptimizing(false)
      setShowOptimizer(true)
      
      console.log('Optimization complete. Best weight:', result.bestConfig.combinedWeights.technical * 100, '% technical')
      console.log('Train Performance:', result.trainPerformance)
      console.log('Test Performance:', result.testPerformance)
    } catch (error) {
      console.error('Error running optimization:', error)
      alert('Fehler bei der Optimierung: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
      setIsOptimizing(false)
    }
  }

  useEffect(() => {
    // Parse Feature Flag (muss INNERHALB der Komponente sein, damit es bei jedem Render neu evaluiert wird)
    // WICHTIG: Next.js embeddet NEXT_PUBLIC_* Variablen zur Build-Zeit
    const envValue = process.env.NEXT_PUBLIC_USE_SERVER_COMPUTE
    const USE_SERVER = envValue === "true"
    
    // Early return: selectedStock muss vorhanden sein
    if (!selectedStock || !selectedStock.symbol) {
      setIsLoading(false)
      return
    }
    
    // Erstelle Config (merge mit DEFAULT_INDICATOR_CONFIG)
    const config: Partial<IndicatorConfig> = {
      ...DEFAULT_INDICATOR_CONFIG,
      maPeriod: period,
      rsiPeriod: 14,
    }
    
    // Verwende optimierte Gewichtung falls verfügbar
    if (optimizationResult) {
      config.combinedWeights = {
        technical: optimizationResult.bestWeights.technical / 100,
        fundamental: optimizationResult.bestWeights.fundamental / 100
      }
    }
    
    // Request-Key: symbol + range + configHash (stabiler Hash für Cache-Key)
    const configHash = hashConfig(config)
    const requestKey = `${selectedStock.symbol}:${timeRange}:${configHash}`
    
    // Guard 1: Skip wenn bereits ein Request für diesen Key läuft (Deduping)
    const existingPromise = inflightRequestsRef.current.get(requestKey)
    if (existingPromise) {
      console.log("[Indicator] Request already in-flight for", requestKey, "- deduping")
      return
    }
    
    // Guard 1.5: Skip wenn gerade eine Promise für diesen Key erstellt wird (React Strict Mode Protection)
    if (creatingRequestsRef.current.has(requestKey)) {
      console.log("[Indicator] Request creation already in progress for", requestKey, "- skipping (Strict Mode)")
      return
    }
    
    // Guard 2: Skip wenn derselbe Key wie letzter erfolgreicher Request UND nicht mehr am fetchen
    if (lastRequestKeyRef.current === requestKey && !isFetchingRef.current) {
      console.log("[Indicator] Same request key, skipping duplicate", requestKey)
      return
    }
    
    // Guard 3: Verhindere Race Condition - wenn bereits ein Fetch läuft, abort erst
    if (isFetchingRef.current && abortControllerRef.current) {
      console.log("[Indicator] Aborting previous request before starting new one")
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    
    // Markiere dass wir gerade eine Promise für diesen Key erstellen (atomar)
    creatingRequestsRef.current.add(requestKey)
    
    // Neuer AbortController für diesen Request
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    isFetchingRef.current = true
    lastRequestKeyRef.current = requestKey
    
    console.log("[Indicator] Starting fetch for", requestKey, "USE_SERVER =", USE_SERVER)
    
    // Erstelle Promise SOFORT (synchron) - noch bevor async Code läuft
    // WICHTIG: Promise wird synchron erstellt, damit sie sofort in die Map kann
    const fetchPromise = (async () => {
      setIsLoading(true)
      try {
        if (USE_SERVER) {
            // SERVER-SIDE COMPUTE PATH
            console.log("[Indicator] SERVER PATH: POST /api/indicator/compute")
            
            // POST Request zu /api/indicator/compute
            const response = await fetch('/api/indicator/compute', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                symbol: selectedStock.symbol,
                range: timeRange,
                config: config,
              } as import('@/core/types/api').IndicatorComputeRequest),
              signal: abortController.signal,
            })
          
            if (!response.ok) {
              const errorText = await response.text()
              throw new Error(`Server compute failed: ${response.status} ${errorText}`)
            }
            
            const result: import('@/core/types/api').IndicatorComputeResponse = await response.json()
            
            // Setze die Daten aus der Server-Response
            setData(result.series)
            
            // Setze Backtest-Result falls vorhanden
            if (result.backtestResult) {
              setBacktestResult(result.backtestResult)
            }
            
            // Setze Optimization-Result falls vorhanden
            if (result.optimizationResult) {
              // Konvertiere OptimizationResult in UI-Format
              setOptimizationResult({
                bestWeights: {
                  technical: result.optimizationResult.bestConfig.combinedWeights.technical * 100,
                  fundamental: result.optimizationResult.bestConfig.combinedWeights.fundamental * 100,
                  technicalIndicators: {
                    rsi: result.optimizationResult.bestConfig.technicalWeights.rsi,
                    movingAverage: result.optimizationResult.bestConfig.technicalWeights.ma,
                    support: result.optimizationResult.bestConfig.technicalWeights.support,
                  },
                  fundamentalMetrics: result.optimizationResult.bestConfig.fundamentalWeights,
                },
                bestPerformance: result.optimizationResult.trainPerformance.balancedScore,
                allResults: result.optimizationResult.allResults.map(r => ({
                  config: {
                    techFund: {
                      tech: r.config.combinedWeights.technical * 100,
                      fund: r.config.combinedWeights.fundamental * 100
                    },
                    techIndicators: r.config.technicalWeights,
                    fundMetrics: r.config.fundamentalWeights
                  },
                  performance: r.trainPerformance.balancedScore,
                  winRate: r.trainPerformance.winRate,
                  totalReturn: r.trainPerformance.totalReturnPercent,
                  accuracy: r.trainPerformance.winRate
                }))
              })
            }
          
            // Hole Company Details separat für UI-Anzeige (falls nicht in Response enthalten)
            // UND Support/Resistance Levels müssen wir auch separat berechnen
            const [detailsResponse, stockResponse] = await Promise.all([
              fetch(`/api/stocks/${selectedStock.symbol}/details`, { signal: abortController.signal }),
              fetch(`/api/stocks/${selectedStock.symbol}?range=${timeRange}`, { signal: abortController.signal })
            ])
          
            // Setze Company Details
            if (detailsResponse.ok) {
              try {
                const detailsData = await detailsResponse.json()
                const details: CompanyDetails = {
                  peRatio: detailsData.peRatio || 0,
                  forwardPE: detailsData.forwardPE || 0,
                  pegRatio: detailsData.pegRatio || 0,
                  profitMargins: detailsData.profitMargins || 0,
                  revenueGrowth: detailsData.revenueGrowth || 0,
                  earningsGrowth: detailsData.earningsGrowth || 0,
                  dividendYield: detailsData.dividendYield || 0,
                  marketCap: detailsData.marketCap || 0,
                }
                setCompanyDetails(details)
              } catch (err) {
                console.warn('Could not parse company details:', err)
              }
            }
            
            // Berechne Support/Resistance Levels für UI
            if (stockResponse.ok) {
              const stockData = await stockResponse.json()
              if (stockData.historical && stockData.historical.length > 0) {
                const historicalCloseSeries = stockData.historical.map((h: { date: string; close: number }) => ({
                  date: h.date,
                  close: h.close
                }))
                
                const lastIndex = historicalCloseSeries.length - 1
                const configForLevels: IndicatorConfig = {
                  ...DEFAULT_INDICATOR_CONFIG,
                  maPeriod: period,
                  rsiPeriod: 14,
                }
                
                const levels = calculateSupportResistanceLevelsAtTime(
                  historicalCloseSeries,
                  lastIndex,
                  {
                    supportLookbackMonths: configForLevels.supportLookbackMonths,
                    supportClusterThreshold: configForLevels.supportClusterThreshold,
                    supportMinTouches: configForLevels.supportMinTouches,
                    supportMaxLevels: configForLevels.supportMaxLevels
                  }
                )
                
                const currentPrice = historicalCloseSeries[lastIndex].close
                
                const filterCloseLevels = (levelArray: number[], minDistance: number = 0.03): number[] => {
                  const sorted = [...levelArray].sort((a, b) => a - b)
                  const filtered: number[] = []
                  
                  for (const level of sorted) {
                    const isTooClose = filtered.some(existing => {
                      const distance = Math.abs(level - existing) / existing
                      return distance < minDistance
                    })
                    if (!isTooClose) {
                      filtered.push(level)
                    }
                  }
                  
                  return filtered
                }
                
                const filteredSupport = filterCloseLevels(levels.support)
                  .filter(level => level < currentPrice)
                  .sort((a, b) => b - a)
                
                const filteredResistance = filterCloseLevels(levels.resistance)
                  .filter(level => level > currentPrice)
                  .sort((a, b) => a - b)
                
                setSupportLevels(filteredSupport)
                setResistanceLevels(filteredResistance)
              }
            }
            
            console.log('[CustomIndicator] Server compute complete, data points:', result.series.length)
          } else {
            // CLIENT-SIDE COMPUTE PATH (original code)
            console.log("[Indicator] CLIENT PATH: GET /api/stocks/...")
            
            // Hole sowohl Kursdaten als auch Unternehmensdaten parallel
            const [stockResponse, detailsResponse] = await Promise.all([
              fetch(`/api/stocks/${selectedStock.symbol}?range=${timeRange}`, { signal: abortController.signal }),
              fetch(`/api/stocks/${selectedStock.symbol}/details`, { signal: abortController.signal })
            ])
          
            if (!stockResponse.ok) {
              throw new Error('Failed to fetch stock data')
            }
            
            const stockData = await stockResponse.json()
            
            // Hole Unternehmensdaten (optional, kann fehlschlagen)
            let details: CompanyDetails | null = null
            if (detailsResponse.ok) {
              try {
                const detailsData = await detailsResponse.json()
                details = {
                  peRatio: detailsData.peRatio || 0,
                  forwardPE: detailsData.forwardPE || 0,
                  pegRatio: detailsData.pegRatio || 0,
                  profitMargins: detailsData.profitMargins || 0,
                  revenueGrowth: detailsData.revenueGrowth || 0,
                  earningsGrowth: detailsData.earningsGrowth || 0,
                  dividendYield: detailsData.dividendYield || 0,
                  marketCap: detailsData.marketCap || 0,
                }
                setCompanyDetails(details)
                console.log('Company details loaded:', details)
              } catch (err) {
                console.warn('Could not parse company details:', err)
              }
            } else {
              console.warn('Details API not available:', detailsResponse.status)
            }
            
            if (!stockData.historical || stockData.historical.length === 0) {
              throw new Error('No historical data available')
            }
            
            // Berechne Indikator-Werte basierend auf historischen Preisen
            const historical = stockData.historical
            
            // Erstelle Config mit period (maPeriod kann von period State abweichen, aber für Kompatibilität verwenden wir period)
            const clientConfig: IndicatorConfig = {
              ...DEFAULT_INDICATOR_CONFIG,
              maPeriod: period,
              rsiPeriod: 14, // RSI bleibt bei 14 (wie im Original)
            }
            
            // Verwende optimierte Gewichtung falls verfügbar
            if (optimizationResult) {
              clientConfig.combinedWeights = {
                technical: optimizationResult.bestWeights.technical / 100,
                fundamental: optimizationResult.bestWeights.fundamental / 100
              }
            }
            
            // Bilde historische Daten auf einfaches Format ab (nur date, close)
            const historicalCloseSeries = historical.map((h: { date: string; close: number; open?: number; high?: number; low?: number; volume?: number; timestamp?: number }) => ({
              date: h.date,
              close: h.close
            }))
            
            // Baue Indikator-Serie mit zeitkorrekter Pipeline
            const newData = buildIndicatorSeries(historicalCloseSeries, details, clientConfig)
            
            // Berechne Support/Resistance Levels für UI (für den letzten Zeitpunkt)
            if (historicalCloseSeries.length > 0) {
              const lastIndex = historicalCloseSeries.length - 1
              const levels = calculateSupportResistanceLevelsAtTime(
                historicalCloseSeries,
                lastIndex,
                {
                  supportLookbackMonths: clientConfig.supportLookbackMonths,
                  supportClusterThreshold: clientConfig.supportClusterThreshold,
                  supportMinTouches: clientConfig.supportMinTouches,
                  supportMaxLevels: clientConfig.supportMaxLevels
                }
              )
              
              // Aktueller Preis (letzter verfügbarer Preis)
              const currentPrice = historicalCloseSeries[lastIndex].close
              
              // Filtere Levels, die zu nah beieinander sind (mindestens 3% Abstand)
              const filterCloseLevels = (levelArray: number[], minDistance: number = 0.03): number[] => {
                const sorted = [...levelArray].sort((a, b) => a - b)
                const filtered: number[] = []
                
                for (const level of sorted) {
                  const isTooClose = filtered.some(existing => {
                    const distance = Math.abs(level - existing) / existing
                    return distance < minDistance
                  })
                  if (!isTooClose) {
                    filtered.push(level)
                  }
                }
                
                return filtered
              }
              
              // Filtere Support: Nur Levels UNTERHALB des aktuellen Preises
              const filteredSupport = filterCloseLevels(levels.support)
                .filter(level => level < currentPrice)
                .sort((a, b) => b - a) // Sortiere absteigend (höchste zuerst)
              
              // Filtere Resistance: Nur Levels OBERHALB des aktuellen Preises
              const filteredResistance = filterCloseLevels(levels.resistance)
                .filter(level => level > currentPrice)
                .sort((a, b) => a - b) // Sortiere aufsteigend (niedrigste zuerst)
              
              setSupportLevels(filteredSupport)
              setResistanceLevels(filteredResistance)
              console.log('Current price:', currentPrice, 'Support levels (below):', filteredSupport, 'Resistance levels (above):', filteredResistance)
            }
            
            console.log('Data points created:', newData.length, 'First item:', newData[0], 'Last item:', newData[newData.length - 1])
            
            if (newData.length === 0) {
              console.error('No data points created!')
              throw new Error('No data points could be created')
            }
            
            setData(newData)
          }
        } catch (error) {
          // Ignoriere AbortError (normale Cancellation)
          if (error instanceof Error && error.name === 'AbortError') {
            console.log("[Indicator] Request aborted for", requestKey)
            // WICHTIG: Entferne Promise auch bei AbortError aus Map
            inflightRequestsRef.current.delete(requestKey)
            creatingRequestsRef.current.delete(requestKey)
            // Setze isFetchingRef nur zurück wenn dieser Request noch aktiv ist
            if (lastRequestKeyRef.current === requestKey) {
              isFetchingRef.current = false
            }
            return
          }
          console.error('Error fetching stock data:', error)
          // Nur setData wenn dieser Request noch der aktuelle ist
          if (lastRequestKeyRef.current === requestKey) {
            setData([])
          }
        } finally {
          // Nur isLoading zurücksetzen, wenn dieser Request noch aktiv ist
          if (lastRequestKeyRef.current === requestKey && !abortController.signal.aborted) {
            setIsLoading(false)
            isFetchingRef.current = false
          }
          // Entferne Promise aus in-flight Map (nur wenn nicht bereits bei AbortError entfernt)
          if (inflightRequestsRef.current.has(requestKey)) {
            inflightRequestsRef.current.delete(requestKey)
          }
          // Stelle sicher, dass "creating" Flag auch entfernt wird
          creatingRequestsRef.current.delete(requestKey)
        }
      })()
    
    // Speichere Promise SOFORT für Deduping (SYNCHRON, direkt nach Erstellung, VOR dem await)
    // Dies verhindert, dass React Strict Mode doppelte Requests erstellt
    // WICHTIG: Promise wird VOR dem await gespeichert, damit der zweite useEffect-Call sie findet
    // Die Promise wird als IIFE erstellt, aber sie wird SOFORT in die Map gespeichert
    inflightRequestsRef.current.set(requestKey, fetchPromise)
    
    // Entferne "creating" Flag, da Promise jetzt in Map ist
    creatingRequestsRef.current.delete(requestKey)
    
    // Starte Promise (nicht await, damit useEffect nicht blockiert)
    // Fehler werden im inneren catch behandelt, aber wir fangen auch unhandled errors ab
    fetchPromise.catch((error) => {
      // Nur loggen wenn es kein AbortError ist (AbortErrors sind normal)
      if (!(error instanceof Error && error.name === 'AbortError')) {
        console.error('[Indicator] Unhandled error in fetchPromise:', error)
      }
      // Stelle sicher, dass Promise aus Map entfernt wird auch bei unhandled errors
      inflightRequestsRef.current.delete(requestKey)
      creatingRequestsRef.current.delete(requestKey)
    })
    
    // Cleanup: Abort bei Unmount oder Dependency-Change
    // WICHTIG: Speichere requestKey und abortController in Closure, damit Cleanup weiß, welcher Request abgebrochen werden soll
    const cleanupRequestKey = requestKey
    const cleanupAbortController = abortController
    
    return () => {
      // Nur abbrechen wenn es der GLEICHE abortController ist (nicht ein neuer)
      // Das verhindert, dass React Strict Mode den Request abbricht
      // Wenn abortControllerRef.current !== cleanupAbortController, dann wurde bereits ein neuer Request gestartet
      if (abortControllerRef.current === cleanupAbortController) {
        // Es ist noch der gleiche Request - nur abbrechen wenn es wirklich ein anderer Request ist
        if (lastRequestKeyRef.current !== cleanupRequestKey) {
          console.log("[Indicator] Cleanup: Aborting old request", lastRequestKeyRef.current, "vs current", cleanupRequestKey)
          cleanupAbortController.abort()
          abortControllerRef.current = null
          isFetchingRef.current = false
          // Entferne nur den alten Request aus der Map
          if (lastRequestKeyRef.current) {
            inflightRequestsRef.current.delete(lastRequestKeyRef.current)
            creatingRequestsRef.current.delete(lastRequestKeyRef.current)
          }
        } else {
          // Es ist der gleiche Request - NICHT abbrechen (React Strict Mode Protection)
          console.log("[Indicator] Cleanup: Same request key, NOT aborting", cleanupRequestKey)
        }
      } else if (!selectedStock?.symbol) {
        // Komponente wird unmounted oder selectedStock ist weg - dann alles abbrechen
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
          abortControllerRef.current = null
        }
        isFetchingRef.current = false
        inflightRequestsRef.current.clear()
        creatingRequestsRef.current.clear()
      }
      // Wenn abortControllerRef.current !== cleanupAbortController, dann wurde bereits ein neuer Request gestartet
      // und wir müssen nichts tun (der neue Request hat bereits den alten abgebrochen)
    }
  }, [selectedStock?.symbol, timeRange, period]) // symbol, timeRange, period - optimizationResult/backtestResult NICHT in Dependencies (wird nur intern verwendet)

  if (isLoading) {
    return (
      <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
        <div className="animate-pulse">
          <div className="h-6 bg-luxury-anthracite rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-luxury-anthracite rounded"></div>
        </div>
      </div>
    )
  }

  const currentData = data[data.length - 1]
  
  // Kombinierte Empfehlung: Berücksichtigt sowohl technische als auch fundamentale Analyse
  // Gewichtung: 70% technisch, 30% fundamental (technische Analyse ist wichtiger für Timing)
  // Technisch: RSI 30%, MA 70%
  // Fundamental: KGV 10%, PEG 15%, Gewinnmarge 15%, Umsatzwachstum 30%, Gewinnwachstum 25%, Dividende 5%
  const getRecommendation = (dataPoint?: IndicatorData) => {
    const data = dataPoint || currentData
    if (!data) return 'HALTEN'
    
    // Verwende getRecommendation aus core
    const config: IndicatorConfig = {
      ...DEFAULT_INDICATOR_CONFIG,
      maPeriod: period,
      rsiPeriod: 14
    }
    
    return getRecommendationCore(
      {
        signal: data.signal,
        value: data.value,
        fundamentalScore: data.fundamentalScore || 50,
        combinedScore: data.combinedScore || 50
      },
      config.thresholds
    )
  }
  
  const recommendation = getRecommendation()

  return (
    <div className="bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-white bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">
            Indikator-Analyse: {selectedStock.symbol}
          </h2>
          <div className="px-3 py-1 bg-luxury-dark/60 border border-luxury-anthracite/50 rounded-lg">
            <span className="text-xs text-slate-400">Aktie</span>
            <div className="text-sm font-semibold text-white">{selectedStock.name}</div>
          </div>
        </div>
        <p className="text-slate-400 text-sm">
          Technische Analyse und Indikator-Signale für {selectedStock.name}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
          <span className="text-slate-400 text-sm">Aktueller Preis</span>
          <p className="text-2xl font-bold text-white">
            €{currentData?.price.toFixed(2) || '0.00'}
          </p>
        </div>
        <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
          <span className="text-slate-400 text-sm">Moving Average</span>
          <p className="text-2xl font-bold text-primary-400">
            {currentData?.value.toFixed(2) || '0.00'}
          </p>
        </div>
        <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
          <span className="text-slate-400 text-sm">Techn. Signal</span>
          <p className="text-2xl font-bold text-gold-400">
            {currentData?.signal.toFixed(2) || '0.00'}
          </p>
        </div>
        <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
          <span className="text-slate-400 text-sm">Fundamentaler Score</span>
          <p className={`text-2xl font-bold ${
            (currentData?.fundamentalScore ?? 50) > 60 ? 'text-gold-400' : 
            (currentData?.fundamentalScore ?? 50) < 40 ? 'text-red-400' : 
            'text-slate-400'
          }`}>
            {currentData?.fundamentalScore !== undefined && currentData?.fundamentalScore !== null
              ? currentData.fundamentalScore.toFixed(1)
              : (companyDetails ? calculateFundamentalScore(companyDetails, DEFAULT_INDICATOR_CONFIG.fundamentalWeights).toFixed(1) : 'N/A')}
          </p>
          <p className="text-xs text-slate-500 mt-1">0-100</p>
        </div>
        <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
          <span className="text-slate-400 text-sm">Empfehlung</span>
          <p className={`text-2xl font-bold ${
            recommendation === 'KAUFEN' ? 'text-gold-400' : 
            recommendation === 'VERKAUFEN' ? 'text-red-400' : 
            'text-slate-400'
          }`}>
            {recommendation}
          </p>
          <p className="text-xs text-slate-500 mt-1">Kombiniert</p>
        </div>
      </div>

      {/* Fundamentale Kennzahlen */}
      {companyDetails && (
        <div className="mb-4 p-4 bg-luxury-dark/60 rounded-lg border border-luxury-anthracite/30">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Fundamentale Kennzahlen</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {companyDetails.peRatio > 0 && (
              <div>
                <span className="text-slate-400">KGV</span>
                <p className="text-white font-medium">{companyDetails.peRatio.toFixed(2)}</p>
              </div>
            )}
            {companyDetails.pegRatio > 0 && (
              <div>
                <span className="text-slate-400">PEG Ratio</span>
                <p className="text-white font-medium">{companyDetails.pegRatio.toFixed(2)}</p>
              </div>
            )}
            {companyDetails.profitMargins > 0 && (
              <div>
                <span className="text-slate-400">Gewinnmarge</span>
                <p className="text-white font-medium">{(companyDetails.profitMargins * 100).toFixed(2)}%</p>
              </div>
            )}
            {companyDetails.revenueGrowth !== 0 && (
              <div>
                <span className="text-slate-400">Umsatzwachstum</span>
                <p className={`font-medium ${companyDetails.revenueGrowth >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                  {(companyDetails.revenueGrowth * 100).toFixed(2)}%
                </p>
              </div>
            )}
            {companyDetails.earningsGrowth !== 0 && (
              <div>
                <span className="text-slate-400">Gewinnwachstum</span>
                <p className={`font-medium ${companyDetails.earningsGrowth >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                  {(companyDetails.earningsGrowth * 100).toFixed(2)}%
                </p>
              </div>
            )}
            {companyDetails.dividendYield > 0 && (
              <div>
                <span className="text-slate-400">Dividendenrendite</span>
                <p className="text-white font-medium">{(companyDetails.dividendYield * 100).toFixed(2)}%</p>
              </div>
            )}
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div className="h-96 flex items-center justify-center">
          <p className="text-slate-400">Keine Chart-Daten verfügbar</p>
        </div>
      ) : (
        <div>
          {(supportLevels.length > 0 || resistanceLevels.length > 0) && (
            <div className="mb-2 text-xs text-slate-400 flex gap-4">
              {supportLevels.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-green-500"></span>
                  Unterstützung ({supportLevels.length})
                </span>
              )}
              {resistanceLevels.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-red-500"></span>
                  Widerstand ({resistanceLevels.length})
                </span>
              )}
            </div>
          )}
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis 
            dataKey="time" 
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a1a1a', 
              border: '1px solid #f97316',
              borderRadius: '8px',
              color: '#fff'
            }}
            labelStyle={{ color: '#fff' }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="#94a3b8" 
            strokeWidth={1.5}
            name="Aktienpreis"
            dot={false}
            strokeDasharray="5 5"
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#f97316" 
            strokeWidth={2}
            name="Indikator Wert"
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="signal" 
            stroke="#d4af37" 
            strokeWidth={2}
            name="Techn. Signal"
            dot={false}
          />
          {/* Support-Linien (grün) */}
          {supportLevels.map((level, index) => (
            <ReferenceLine 
              key={`support-${index}`}
              y={level} 
              stroke="#10b981" 
              strokeWidth={1.5}
              strokeDasharray="5 5"
              label={{ value: `Support ${level.toFixed(2)}`, position: "right", fill: "#10b981", fontSize: 10 }}
            />
          ))}
          {/* Resistance-Linien (rot) */}
          {resistanceLevels.map((level, index) => (
            <ReferenceLine 
              key={`resistance-${index}`}
              y={level} 
              stroke="#ef4444" 
              strokeWidth={1.5}
              strokeDasharray="5 5"
              label={{ value: `Resistance ${level.toFixed(2)}`, position: "right", fill: "#ef4444", fontSize: 10 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      </div>
      )}

      <div className="mt-4 p-4 bg-luxury-dark/60 rounded-lg border border-luxury-anthracite/30">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Indikator-Einstellungen</h3>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => setShowParameterModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-lg text-sm transition-all shadow-lg shadow-primary-600/30 hover:shadow-primary-500/50 font-medium"
          >
            Parameter anpassen
          </button>
          <button 
            onClick={() => setShowTimeframeModal(true)}
            className="px-4 py-2 bg-luxury-anthracite hover:bg-luxury-anthracite/80 text-white rounded-lg text-sm transition-all border border-luxury-anthracite/50 font-medium"
          >
            Zeitraum ändern
          </button>
          <button 
            onClick={() => {
              runBacktest()
              setShowBacktest(true)
            }}
            disabled={isRunningBacktest || data.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-white rounded-lg text-sm transition-all shadow-lg shadow-gold-600/30 hover:shadow-gold-500/50 font-medium disabled:opacity-50"
          >
            {isRunningBacktest ? 'Backtest läuft...' : '📊 Backtesting'}
          </button>
          <button 
            onClick={() => {
              optimizeWeights()
            }}
            disabled={isOptimizing || data.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-lg text-sm transition-all shadow-lg shadow-purple-600/30 hover:shadow-purple-500/50 font-medium disabled:opacity-50"
          >
            {isOptimizing ? 'Optimierung läuft...' : '🤖 Gewichtung optimieren'}
          </button>
          <button 
            onClick={() => {
              const csv = [
                ['Datum', 'Preis', 'Indikator Wert', 'Signal', 'Fundamentaler Score', 'Komb. Score'].join(','),
                ...data.map(d => [
                  d.time,
                  d.price.toFixed(2),
                  d.value.toFixed(2),
                  d.signal.toFixed(2),
                  (d.fundamentalScore || 0).toFixed(1),
                  (d.combinedScore || 0).toFixed(1)
                ].join(','))
              ].join('\n')
              
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${selectedStock.symbol}_indikator_${new Date().toISOString().split('T')[0]}.csv`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              window.URL.revokeObjectURL(url)
            }}
            className="px-4 py-2 bg-luxury-anthracite hover:bg-luxury-anthracite/80 text-white rounded-lg text-sm transition-all border border-luxury-anthracite/50 font-medium"
          >
            Exportieren
          </button>
        </div>
      </div>

      {/* Backtesting-Ergebnisse */}
      {showBacktest && backtestResult && (
        <div className="mt-6 bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-white bg-gradient-to-r from-white to-gold-300 bg-clip-text text-transparent">
                Backtesting-Ergebnisse
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Zeitraum: {
                  timeRange === '1mo' ? '1 Monat' :
                  timeRange === '3mo' ? '3 Monate' :
                  timeRange === '6mo' ? '6 Monate' :
                  timeRange === '1y' ? '1 Jahr' :
                  timeRange === '2y' ? '2 Jahre' :
                  timeRange === '5y' ? '5 Jahre' : timeRange
                } • Datenpunkte: {data.length} • Moving Average: {period} Tage
              </p>
            </div>
            <button
              onClick={() => setShowBacktest(false)}
              className="px-3 py-1 bg-luxury-anthracite hover:bg-luxury-anthracite/80 text-white rounded-lg text-sm transition-all border border-luxury-anthracite/50"
            >
              Schließen
            </button>
          </div>

          {/* Übersicht */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
              <p className="text-slate-400 text-sm mb-1">Gesamt Trades</p>
              <p className="text-2xl font-bold text-white">{backtestResult.totalTrades}</p>
            </div>
            <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
              <p className="text-slate-400 text-sm mb-1">Gewinnwahrscheinlichkeit</p>
              <p className={`text-2xl font-bold ${backtestResult.winRate >= 50 ? 'text-gold-400' : 'text-red-400'}`}>
                {backtestResult.winRate.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {backtestResult.winningTrades} Gewinner / {backtestResult.losingTrades} Verlierer
              </p>
            </div>
            <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
              <p className="text-slate-400 text-sm mb-1">Durchschn. Rendite</p>
              <p className={`text-2xl font-bold ${backtestResult.averageReturn >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                {backtestResult.averageReturn >= 0 ? '+' : ''}{backtestResult.averageReturn.toFixed(2)}€
              </p>
            </div>
            <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
              <p className="text-slate-400 text-sm mb-1">Gesamt-Rendite</p>
              <p className={`text-2xl font-bold ${backtestResult.totalReturn >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                {backtestResult.totalReturn >= 0 ? '+' : ''}{backtestResult.totalReturn.toFixed(2)}€
              </p>
              <p className="text-xs text-slate-500 mt-1">
                ({backtestResult.totalReturnPercent >= 0 ? '+' : ''}{backtestResult.totalReturnPercent.toFixed(2)}%)
              </p>
            </div>
          </div>

          {/* Best/Worst Trade */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
              <p className="text-slate-400 text-sm mb-1">Bester Trade</p>
              <p className="text-xl font-bold text-gold-400">
                +{backtestResult.bestTrade.toFixed(2)}%
              </p>
            </div>
            <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
              <p className="text-slate-400 text-sm mb-1">Schlechtester Trade</p>
              <p className="text-xl font-bold text-red-400">
                {backtestResult.worstTrade.toFixed(2)}%
              </p>
            </div>
          </div>
          
          {/* NEU (Phase 2): Erweiterte Metriken */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
              <p className="text-slate-400 text-sm mb-1">Max Drawdown</p>
              <p className="text-xl font-bold text-red-400">{backtestResult.maxDrawdown.toFixed(2)}%</p>
            </div>
            <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
              <p className="text-slate-400 text-sm mb-1">Profit Factor</p>
              <p className="text-xl font-bold text-white">
                {backtestResult.profitFactor === Infinity ? '∞' : backtestResult.profitFactor.toFixed(2)}
              </p>
            </div>
            <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
              <p className="text-slate-400 text-sm mb-1">Expectancy</p>
              <p className={`text-xl font-bold ${backtestResult.expectancy >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                {backtestResult.expectancy >= 0 ? '+' : ''}{backtestResult.expectancy.toFixed(2)}€
              </p>
            </div>
            <div className="bg-luxury-dark/60 rounded-lg p-4 border border-luxury-anthracite/30">
              <p className="text-slate-400 text-sm mb-1">Ø Haltedauer</p>
              <p className="text-xl font-bold text-white">{backtestResult.avgHoldDays.toFixed(1)} Tage</p>
            </div>
          </div>

          {/* Trade-Liste */}
          {backtestResult.trades.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-white mb-3">Einzelne Trades</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-luxury-anthracite/30">
                      <th className="text-left py-2 px-3 text-slate-400">Einstieg</th>
                      <th className="text-left py-2 px-3 text-slate-400">Ausstieg</th>
                      <th className="text-right py-2 px-3 text-slate-400">Einstiegspreis</th>
                      <th className="text-right py-2 px-3 text-slate-400">Ausstiegspreis</th>
                      <th className="text-right py-2 px-3 text-slate-400">Rendite</th>
                      <th className="text-right py-2 px-3 text-slate-400">Rendite %</th>
                      {/* NEU (Phase 2) */}
                      <th className="text-right py-2 px-3 text-slate-400 text-xs">Haltedauer</th>
                      <th className="text-left py-2 px-3 text-slate-400 text-xs">Exit Grund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtestResult.trades.map((trade, index) => (
                      <tr key={index} className="border-b border-luxury-anthracite/20">
                        <td className="py-2 px-3 text-slate-300">{trade.entryDate}</td>
                        <td className="py-2 px-3 text-slate-300">{trade.exitDate}</td>
                        <td className="py-2 px-3 text-right text-white">{trade.entryPrice.toFixed(2)}€</td>
                        <td className="py-2 px-3 text-right text-white">{trade.exitPrice.toFixed(2)}€</td>
                        <td className={`py-2 px-3 text-right font-medium ${trade.return >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                          {trade.return >= 0 ? '+' : ''}{trade.return.toFixed(2)}€
                        </td>
                        <td className={`py-2 px-3 text-right font-medium ${trade.returnPercent >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                          {trade.returnPercent >= 0 ? '+' : ''}{trade.returnPercent.toFixed(2)}%
                        </td>
                        {/* NEU (Phase 2): Erweiterte Trade-Informationen */}
                        <td className="py-2 px-3 text-right text-slate-400 text-xs">{trade.holdDays || 0} Tage</td>
                        <td className="py-2 px-3 text-left text-slate-400 text-xs">{trade.exitReason || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {backtestResult.trades.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-400">Keine Trades im gewählten Zeitraum gefunden.</p>
              <p className="text-slate-500 text-sm mt-2">Versuche einen längeren Zeitraum oder andere Parameter.</p>
            </div>
          )}
        </div>
      )}

      {/* Parameter-Modal */}
      {showParameterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-luxury-charcoal rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Parameter anpassen</h3>
            <div className="mb-4">
              <label className="block text-slate-300 text-sm mb-2">
                Moving Average Period (aktuell: {period})
              </label>
              <input
                type="number"
                min="5"
                max="50"
                value={period}
                onChange={(e) => setPeriod(parseInt(e.target.value) || 14)}
                className="w-full px-4 py-2 bg-luxury-dark border border-luxury-anthracite/50 rounded-lg text-white focus:outline-none focus:border-primary-500"
              />
              <p className="text-slate-400 text-xs mt-2">
                Empfohlen: 14-20 Tage für kurzfristige, 20-50 für langfristige Analysen
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowParameterModal(false)
                }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white rounded-lg transition-all font-medium"
              >
                Übernehmen
              </button>
              <button
                onClick={() => {
                  setPeriod(14)
                  setShowParameterModal(false)
                }}
                className="px-4 py-2 bg-luxury-anthracite hover:bg-luxury-anthracite/80 text-white rounded-lg transition-all border border-luxury-anthracite/50 font-medium"
              >
                Zurücksetzen
              </button>
              <button
                onClick={() => setShowParameterModal(false)}
                className="px-4 py-2 bg-luxury-anthracite hover:bg-luxury-anthracite/80 text-white rounded-lg transition-all border border-luxury-anthracite/50 font-medium"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zeitraum-Modal */}
      {showTimeframeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-luxury-charcoal rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Zeitraum ändern</h3>
            <div className="space-y-2">
              {[
                { value: '1mo', label: '1 Monat' },
                { value: '3mo', label: '3 Monate' },
                { value: '6mo', label: '6 Monate' },
                { value: '1y', label: '1 Jahr' },
                { value: '2y', label: '2 Jahre' },
                { value: '5y', label: '5 Jahre' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setTimeRange(option.value)
                    setShowTimeframeModal(false)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                    timeRange === option.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-luxury-dark text-slate-300 hover:bg-luxury-anthracite/50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowTimeframeModal(false)}
              className="mt-4 w-full px-4 py-2 bg-luxury-anthracite hover:bg-luxury-anthracite/80 text-white rounded-lg transition-all border border-luxury-anthracite/50 font-medium"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* Optimierungs-Ergebnisse */}
      {showOptimizer && optimizationResult && (
        <div className="mt-6 bg-luxury-charcoal/80 backdrop-blur-sm rounded-xl p-6 border border-luxury-anthracite/50 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-white bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
                Optimierungs-Ergebnisse
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Analyse optimaler historischer Zeitpunkte zur Gewichtungsfindung
              </p>
            </div>
            <button
              onClick={() => {
                setShowOptimizer(false)
                // Die optimale Gewichtung wird automatisch beim nächsten Datenladen angewendet
              }}
              className="px-3 py-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-lg text-sm transition-all shadow-lg shadow-purple-600/30 hover:shadow-purple-500/50 font-medium"
            >
              Anwenden & Neu laden
            </button>
          </div>

          {/* Beste Gewichtung */}
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-600/20 to-purple-700/20 rounded-lg border border-purple-500/30">
            <div className="mb-4">
              <p className="text-slate-400 text-sm mb-1">Optimale Haupt-Gewichtung</p>
              <p className="text-3xl font-bold text-purple-300">
                {optimizationResult.bestWeights.technical}% technisch / {optimizationResult.bestWeights.fundamental}% fundamental
              </p>
              <p className="text-slate-400 text-sm mt-2">
                Performance-Score: {optimizationResult.bestPerformance.toFixed(2)}/100
              </p>
              {/* NEU (Phase 2): Train vs Test Performance Info */}
              <div className="mt-4 pt-4 border-t border-luxury-anthracite/30">
                <p className="text-slate-400 text-xs mb-2">Hinweis: Optimierung verwendet Train/Test Split (70/30)</p>
                <p className="text-slate-400 text-xs">Performance basiert auf Train-Set. Test-Set dient zur Validierung.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-luxury-dark/60 rounded-lg p-3 border border-luxury-anthracite/30">
                <p className="text-slate-400 text-xs mb-2">Technische Indikatoren</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">RSI:</span>
                    <span className="text-white font-medium">{optimizationResult.bestWeights.technicalIndicators.rsi}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Moving Average:</span>
                    <span className="text-white font-medium">{optimizationResult.bestWeights.technicalIndicators.movingAverage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Unterstützung:</span>
                    <span className="text-white font-medium">{optimizationResult.bestWeights.technicalIndicators.support}%</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-luxury-dark/60 rounded-lg p-3 border border-luxury-anthracite/30">
                <p className="text-slate-400 text-xs mb-2">Fundamentale Metriken</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-300">KGV:</span>
                    <span className="text-white font-medium">{optimizationResult.bestWeights.fundamentalMetrics.peRatio}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">PEG:</span>
                    <span className="text-white font-medium">{optimizationResult.bestWeights.fundamentalMetrics.pegRatio}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Gewinnmarge:</span>
                    <span className="text-white font-medium">{optimizationResult.bestWeights.fundamentalMetrics.profitMargin}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Umsatzwachstum:</span>
                    <span className="text-white font-medium">{optimizationResult.bestWeights.fundamentalMetrics.revenueGrowth}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Gewinnwachstum:</span>
                    <span className="text-white font-medium">{optimizationResult.bestWeights.fundamentalMetrics.earningsGrowth}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Dividende:</span>
                    <span className="text-white font-medium">{optimizationResult.bestWeights.fundamentalMetrics.dividendYield}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top 10 Gewichtungen */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">Top 10 Gewichtungskombinationen</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-luxury-anthracite/30">
                    <th className="text-left py-2 px-3 text-slate-400">Tech/Fund</th>
                    <th className="text-left py-2 px-3 text-slate-400">RSI/MA/Support</th>
                    <th className="text-right py-2 px-3 text-slate-400">Performance</th>
                    <th className="text-right py-2 px-3 text-slate-400">Win Rate</th>
                    <th className="text-right py-2 px-3 text-slate-400">Rendite</th>
                  </tr>
                </thead>
                <tbody>
                  {optimizationResult.allResults
                    .sort((a, b) => b.performance - a.performance)
                    .slice(0, 10)
                    .map((result, index) => {
                      const isBest = result.config.techFund.tech === optimizationResult.bestWeights.technical &&
                                    result.config.techIndicators.rsi === optimizationResult.bestWeights.technicalIndicators.rsi &&
                                    result.config.techIndicators.ma === optimizationResult.bestWeights.technicalIndicators.movingAverage &&
                                    result.config.techIndicators.support === optimizationResult.bestWeights.technicalIndicators.support
                      return (
                        <tr 
                          key={`${result.config.techFund.tech}-${result.config.techIndicators.rsi}-${index}`}
                          className={`border-b border-luxury-anthracite/20 ${
                            isBest ? 'bg-purple-600/10' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-slate-300">
                            {result.config.techFund.tech}/{result.config.techFund.fund}%
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {result.config.techIndicators.rsi}/{result.config.techIndicators.ma}/{result.config.techIndicators.support}%
                          </td>
                          <td className={`py-2 px-3 text-right font-medium ${
                            isBest ? 'text-purple-300 font-bold' : 'text-white'
                          }`}>
                            {result.performance.toFixed(2)}
                            {isBest && ' ⭐'}
                          </td>
                          <td className={`py-2 px-3 text-right ${
                            result.winRate >= 50 ? 'text-gold-400' : 'text-red-400'
                          }`}>
                            {result.winRate.toFixed(1)}%
                          </td>
                          <td className={`py-2 px-3 text-right ${
                            result.totalReturn >= 0 ? 'text-gold-400' : 'text-red-400'
                          }`}>
                            {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)}€
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 p-3 bg-luxury-dark/60 rounded-lg border border-luxury-anthracite/30">
            <p className="text-slate-400 text-xs">
              💡 <strong>Hinweis:</strong> Die Optimierung verwendet Walk-Forward-Analyse (Train/Test Split) ohne Lookahead-Bias. 
              Vergangene Performance garantiert keine zukünftigen Ergebnisse.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
