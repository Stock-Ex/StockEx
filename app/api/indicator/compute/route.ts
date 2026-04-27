import { NextRequest, NextResponse } from 'next/server'
import type { IndicatorComputeRequest, IndicatorComputeResponse } from '@/core/types/api'
import { DEFAULT_INDICATOR_CONFIG } from '@/core/types/indicator'
import { buildIndicatorSeries } from '@/core/pipeline/builder'
import { runBacktest } from '@/core/backtest/engine'
import { optimizeWeightsWalkForward } from '@/core/optimization/walkForward'
import { fetchStockData, fetchCompanyDetails } from '@/core/data/index'
import type { IndicatorConfig, BacktestConfig } from '@/core/types'
import type { OptimizationConfig } from '@/core/optimization/walkForward'

/**
 * Per-IP Rate Limit (einfache In-Memory Implementierung)
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60000  // 1 Minute
// In Development: Höheres Limit (React Strict Mode führt zu doppelten Renders)
const RATE_LIMIT_MAX = process.env.NODE_ENV === 'development' ? 100 : 10

/**
 * In-Memory Response Cache mit TTL
 */
interface CacheEntry {
  response: IndicatorComputeResponse
  expiresAt: number
}

const responseCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 300_000 // 5 Minuten
const CACHE_MAX_ENTRIES = 100 // LRU-lite: max 100 Einträge

/**
 * Erstellt einen stabilen Hash für Config (nur relevante Keys)
 * Einfacher String-Hash (djb2-Algorithmus) - schnell und stabil
 */
function hashConfig(config: Partial<IndicatorConfig>): string {
  const relevantKeys = ['maPeriod', 'rsiPeriod', 'combinedWeights', 'technicalWeights', 'fundamentalWeights']
  const hashObj: Record<string, unknown> = {}
  for (const key of relevantKeys) {
    if (config[key as keyof IndicatorConfig] !== undefined) {
      hashObj[key] = config[key as keyof IndicatorConfig]
    }
  }
  const configString = JSON.stringify(hashObj)
  
  // djb2 Hash-Algorithmus (einfach und schnell)
  let hash = 5381
  for (let i = 0; i < configString.length; i++) {
    hash = ((hash << 5) + hash) + configString.charCodeAt(i)
  }
  return Math.abs(hash).toString(36).substring(0, 16) // 16 chars base36
}

/**
 * Erstellt Cache-Key: symbol|range|hash(config)
 */
function createCacheKey(symbol: string, range: string, config: Partial<IndicatorConfig>): string {
  const configHash = hashConfig(config)
  return `${symbol}|${range}|${configHash}`
}

/**
 * LRU-lite: Entfernt ältesten Eintrag wenn Cache zu groß wird
 */
function enforceCacheLimit(): void {
  if (responseCache.size > CACHE_MAX_ENTRIES) {
    // Entferne den ersten (ältesten) Eintrag
    const firstKey = responseCache.keys().next().value
    if (firstKey) {
      responseCache.delete(firstKey)
    }
  }
}

/**
 * Generiert eindeutige Request-ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false
  }

  record.count++
  return true
}

/**
 * Holt Client-IP aus Request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  return 'unknown'
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const startTime = Date.now()
  let symbol = 'unknown'
  let range = 'unknown'
  let errorMessage: string | null = null
  
  try {
    // Rate Limit Check
    const ip = getClientIP(request)
    if (!checkRateLimit(ip)) {
      errorMessage = 'Rate limit exceeded'
      console.log(`[API] ${requestId} | ${symbol}:${range} | RATE_LIMIT | ${Date.now() - startTime}ms`)
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse Body
    let body: IndicatorComputeRequest
    try {
      body = await request.json()
    } catch (error) {
      errorMessage = 'Invalid JSON body'
      console.log(`[API] ${requestId} | ${symbol}:${range} | ERROR | ${errorMessage} | ${Date.now() - startTime}ms`)
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    // Validation
    symbol = body.symbol || 'unknown'
    range = body.range || 'unknown'
    
    if (!body.symbol || typeof body.symbol !== 'string') {
      errorMessage = 'Missing or invalid symbol'
      console.log(`[API] ${requestId} | ${symbol}:${range} | ERROR | ${errorMessage} | ${Date.now() - startTime}ms`)
      return NextResponse.json(
        { error: 'Missing or invalid symbol' },
        { status: 400 }
      )
    }

    if (!body.range || typeof body.range !== 'string') {
      errorMessage = 'Missing or invalid range'
      console.log(`[API] ${requestId} | ${symbol}:${range} | ERROR | ${errorMessage} | ${Date.now() - startTime}ms`)
      return NextResponse.json(
        { error: 'Missing or invalid range' },
        { status: 400 }
      )
    }
    
    // Build Config für Cache-Key
    const config: IndicatorConfig = {
      ...DEFAULT_INDICATOR_CONFIG,
      ...body.config
    }
    
    // Cache-Key erstellen
    const cacheKey = createCacheKey(body.symbol, body.range, config)
    
    // Cache-Check
    const cached = responseCache.get(cacheKey)
    const now = Date.now()
    
    if (cached && now < cached.expiresAt) {
      // Cache-Hit
      const durationMs = Date.now() - startTime
      console.log(`[API] ${requestId} | ${symbol}:${range} | CACHE_HIT | ${durationMs}ms`)
      
      // Erweitere meta mit cache-Info
      const cachedResponse = {
        ...cached.response,
        meta: {
          ...cached.response.meta,
          cache: 'HIT' as const
        }
      }
      
      return NextResponse.json(cachedResponse, {
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-Request-Id': requestId
        }
      })
    }
    
    // Cache-Miss
    console.log(`[API] ${requestId} | ${symbol}:${range} | CACHE_MISS | starting...`)

    // Fetch Data
    let stockData
    let companyDetails

    try {
      [stockData, companyDetails] = await Promise.all([
        fetchStockData(body.symbol, body.range),
        fetchCompanyDetails(body.symbol)
      ])
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error)
      const durationMs = Date.now() - startTime
      console.log(`[API] ${requestId} | ${symbol}:${range} | ERROR | ${errorMessage} | ${durationMs}ms`)
      
      // Spezifische Fehlermeldung für Yahoo Finance 401
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        return NextResponse.json(
          { 
            error: 'Yahoo Finance API access denied. This may be a temporary rate limit or API restriction.',
            details: 'The data provider is currently blocking requests. Please try again in a few minutes.'
          },
          { 
            status: 503,
            headers: {
              'X-Request-Id': requestId
            }
          }
        )
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch stock data. Please try again later.',
          details: errorMessage
        },
        { 
          status: 503,
          headers: {
            'X-Request-Id': requestId
          }
        }
      )
    }

    // Validate historical data
    if (!stockData.historical || stockData.historical.length === 0) {
      errorMessage = 'No historical data available'
      const durationMs = Date.now() - startTime
      console.log(`[API] ${requestId} | ${symbol}:${range} | ERROR | ${errorMessage} | ${durationMs}ms`)
      return NextResponse.json(
        { error: 'No historical data available for this symbol/range' },
        { 
          status: 422,
          headers: {
            'X-Request-Id': requestId
          }
        }
      )
    }

    // Convert historical to required format
    const historical = stockData.historical.map(h => ({
      date: h.date,
      close: h.close
    }))

    // Build Indicator Series
    const series = buildIndicatorSeries(historical, companyDetails, config)

    if (series.length === 0) {
      errorMessage = 'Insufficient data to compute indicator series'
      const durationMs = Date.now() - startTime
      console.log(`[API] ${requestId} | ${symbol}:${range} | ERROR | ${errorMessage} | ${durationMs}ms`)
      return NextResponse.json(
        { error: 'Insufficient data to compute indicator series' },
        { 
          status: 422,
          headers: {
            'X-Request-Id': requestId
          }
        }
      )
    }

    // Meta (mit cache-Info)
    const source = companyDetails ? 'yahoo+alphaVantage' : 'yahoo'
    const meta = {
      symbol: body.symbol,
      range: body.range,
      dataPoints: series.length,
      computedAt: new Date().toISOString(),
      source,
      cache: 'MISS' as const
    }

    // Optional: Backtest
    let backtestResult
    if (body.backtestConfig) {
      try {
        backtestResult = runBacktest(
          historical,
          companyDetails,
          config,
          body.backtestConfig
        )
      } catch (error) {
        console.error(`[API] Backtest failed for ${body.symbol}:`, error)
        // Backtest ist optional, wir ignorieren Fehler
      }
    }

    // Optional: Optimization
    let optimizationResult
    if (body.optimization?.enabled && body.optimization.optimizationConfig) {
      try {
        optimizationResult = optimizeWeightsWalkForward(
          historical,
          companyDetails,
          {
            trainTestSplit: 0.7,
            minTradesPerYear: 10,
            techWeightRange: { min: 50, max: 80, step: 10 },
            ...body.optimization.optimizationConfig
          } as OptimizationConfig
        )
      } catch (error) {
        console.error(`[API] Optimization failed for ${body.symbol}:`, error)
        // Optimization ist optional, wir ignorieren Fehler
      }
    }

    // Build Response
    const response: IndicatorComputeResponse = {
      series,
      meta,
      ...(backtestResult && { backtestResult }),
      ...(optimizationResult && { optimizationResult })
    }
    
    // Cache Response (nur bei Erfolg, keine Fehler cachen)
    responseCache.set(cacheKey, {
      response,
      expiresAt: now + CACHE_TTL_MS
    })
    
    // LRU-lite: Enforce Cache-Limit
    enforceCacheLimit()
    
    // Cleanup: Entferne abgelaufene Cache-Einträge (periodisch)
    if (responseCache.size > CACHE_MAX_ENTRIES * 0.8) {
      const nowCleanup = Date.now()
      for (const [key, entry] of responseCache.entries()) {
        if (nowCleanup >= entry.expiresAt) {
          responseCache.delete(key)
        }
      }
    }
    
    const durationMs = Date.now() - startTime
    console.log(`[API] ${requestId} | ${symbol}:${range} | SUCCESS | ${durationMs}ms | dataPoints:${series.length}`)

    // Response Headers
    // Kein CDN-Caching, da Response von Config abhängt
    // Server-seitiges Caching erfolgt über core/data Layer
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'X-Request-Id': requestId
      }
    })
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error)
    const durationMs = Date.now() - startTime
    console.log(`[API] ${requestId} | ${symbol}:${range} | ERROR | ${errorMessage} | ${durationMs}ms`)
    console.error('[API] Unexpected error in /api/indicator/compute:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: {
          'X-Request-Id': requestId
        }
      }
    )
  }
}
