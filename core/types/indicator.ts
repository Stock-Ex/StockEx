export interface IndicatorData {
  time: string
  value: number          // Moving Average
  signal: number         // Technisches Signal (normalisiert auf Preis)
  price: number
  fundamentalScore: number
  combinedScore: number
  // Optional (für Debug/Später):
  technicalScore?: number
  rsi?: number
  maDistance?: number
  supportScore?: number
  // Intern (für Backtest): Mapping zurück zu historical Index
  isoDate?: string       // ISO-Datum für Date-Matching
}

export interface IndicatorConfig {
  // Technische Parameter
  rsiPeriod: number
  maPeriod: number
  supportLookbackMonths: number
  supportClusterThreshold: number
  supportMinTouches: number
  supportMaxLevels: number
  
  // Gewichtungen
  technicalWeights: {
    rsi: number
    ma: number
    support: number
  }
  combinedWeights: {
    technical: number
    fundamental: number
  }
  fundamentalWeights: {
    peRatio: number
    pegRatio: number
    profitMargin: number
    revenueGrowth: number
    earningsGrowth: number
    dividendYield: number
  }
  
  // Signal-Schwellenwerte
  thresholds: {
    buyFundamentalMin: number
    buyCombinedMin: number
    sellFundamentalMax: number
    sellCombinedMax: number
  }
}

export const DEFAULT_INDICATOR_CONFIG: IndicatorConfig = {
  // Technische Parameter
  rsiPeriod: 14,
  maPeriod: 14,
  supportLookbackMonths: 12,
  supportClusterThreshold: 0.01,  // 1%
  supportMinTouches: 2,
  supportMaxLevels: 5,
  
  // Gewichtungen
  technicalWeights: {
    rsi: 0.30,
    ma: 0.60,
    support: 0.10
  },
  combinedWeights: {
    technical: 0.60,
    fundamental: 0.40
  },
  fundamentalWeights: {
    peRatio: 0.10,
    pegRatio: 0.15,
    profitMargin: 0.15,
    revenueGrowth: 0.30,
    earningsGrowth: 0.25,
    dividendYield: 0.05
  },
  
  // Signal-Schwellenwerte
  thresholds: {
    buyFundamentalMin: 50,
    buyCombinedMin: 52,
    sellFundamentalMax: 45,
    sellCombinedMax: 48
  }
}
