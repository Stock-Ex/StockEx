# Refactor-Plan: StockEx V2
**Senior Software Architect + Quant Engineer Blueprint**

**Ziel:** Minimal-invasive Trennung von UI und Logik, Lookahead-Bias-Fixes, Vorbereitung auf Server-Migration

**Referenz:** `ARCHITEKTUR_ANALYSE.md` (1741 Zeilen)

---

## 1️⃣ Zielzustand (klar, minimal)

### Neue Verzeichnisstruktur

```
/Users/olegreiten/stockex-v2/
├── app/                          # Unverändert (Next.js App Router)
├── components/
│   ├── CustomIndicator.tsx       # NUR UI (ca. 300-400 Zeilen, statt 1732)
│   └── ... (andere Components unverändert)
└── core/                          # NEU: Indikator-Engine
    ├── types/
    │   ├── indicator.ts          # IndicatorData, IndicatorConfig
    │   ├── company.ts             # CompanyDetails
    │   ├── stock.ts               # Stock, StockData
    │   └── backtest.ts            # BacktestResult, BacktestConfig
    ├── features/
    │   ├── rsi.ts                 # RSI-Berechnung
    │   ├── movingAverage.ts       # MA-Berechnung
    │   └── index.ts               # Re-Export
    ├── levels/
    │   ├── supportResistance.ts    # Support/Resistance-Berechnung
    │   └── index.ts
    ├── scoring/
    │   ├── fundamental.ts         # calculateFundamentalScore
    │   ├── technical.ts           # Technical Score Berechnung
    │   ├── combined.ts            # Combined Score Berechnung
    │   └── index.ts
    ├── signals/
    │   ├── recommendation.ts      # getRecommendation
    │   └── index.ts
    ├── backtest/
    │   ├── engine.ts              # runBacktest (zeitkorrekt)
    │   ├── metrics.ts             # Metriken-Berechnung
    │   └── index.ts
    ├── optimization/
    │   ├── walkForward.ts         # Walk-Forward-Optimierung
    │   ├── objective.ts           # Zielfunktion
    │   └── index.ts
    ├── pipeline/
    │   ├── builder.ts             # buildIndicatorSeries (Haupt-Funktion)
    │   └── index.ts
    └── index.ts                    # Haupt-Export
```

### Type-Migration

**Von:** `components/CustomIndicator.tsx:6-55`

**Nach:**

1. **`core/types/indicator.ts`**
   ```typescript
   // Aus CustomIndicator.tsx:6-13
   export interface IndicatorData {
     time: string
     value: number          // Moving Average
     signal: number         // Technisches Signal
     price: number
     fundamentalScore: number
     combinedScore: number
     // NEU (für Backtest):
     technicalScore?: number
     rsi?: number
     maDistance?: number
     supportScore?: number
   }
   
   export interface IndicatorConfig {
     // Technische Parameter
     rsiPeriod: number              // Default: 14
     maPeriod: number               // Default: 14
     supportLookbackMonths: number  // Default: 12
     supportClusterThreshold: number // Default: 0.01 (1%)
     supportMinTouches: number      // Default: 2
     supportMaxLevels: number        // Default: 5
     
     // Gewichtungen
     technicalWeights: {
       rsi: number      // Default: 0.30
       ma: number       // Default: 0.60
       support: number  // Default: 0.10
     }
     combinedWeights: {
       technical: number    // Default: 0.60
       fundamental: number   // Default: 0.40
     }
     
     // Fundamental-Gewichtungen
     fundamentalWeights: {
       peRatio: number        // Default: 0.10
       pegRatio: number       // Default: 0.15
       profitMargin: number   // Default: 0.15
       revenueGrowth: number  // Default: 0.30
       earningsGrowth: number // Default: 0.25
       dividendYield: number  // Default: 0.05
     }
     
     // Signal-Schwellenwerte
     thresholds: {
       buyFundamentalMin: number      // Default: 50
       buyCombinedMin: number         // Default: 52
       sellFundamentalMax: number     // Default: 45
       sellCombinedMax: number        // Default: 48
     }
   }
   ```

2. **`core/types/company.ts`**
   ```typescript
   // Aus CustomIndicator.tsx:21-30
   export interface CompanyDetails {
     peRatio: number
     forwardPE: number
     pegRatio: number
     profitMargins: number
     revenueGrowth: number
     earningsGrowth: number
     dividendYield: number
     marketCap: number
   }
   ```

3. **`core/types/stock.ts`**
   ```typescript
   // Aus CustomIndicator.tsx:15-19
   export interface Stock {
     symbol: string
     name: string
     price: number
   }
   
   // Aus app/aktien/[symbol]/page.tsx:9-24
   export interface StockData {
     symbol: string
     name: string
     price: number
     change: number
     changePercent: number
     currency: string
     historical: Array<{
       date: string
       open: number
       high: number
       low: number
       close: number
       volume: number
       timestamp?: number
     }>
   }
   ```

4. **`core/types/backtest.ts`**
   ```typescript
   // Aus CustomIndicator.tsx:36-55, erweitert
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
     // NEU:
     maxDrawdown: number
     profitFactor: number
     expectancy: number
     avgHoldDays: number
     sharpeRatio?: number
     trades: Array<{
       entryDate: string
       exitDate: string
       entryPrice: number
       exitPrice: number
       return: number
       returnPercent: number
       type: 'BUY' | 'SELL'
       // NEU:
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
     fees?: number                  // Default: 0
     slippage?: number               // Default: 0
     minHoldDays?: number           // Default: 0
     maxHoldDays?: number           // Default: Infinity
   }
   ```

### Funktions-Migration

**Von:** `components/CustomIndicator.tsx`

**Nach:**

1. **`core/features/rsi.ts`**
   - **Funktion:** `calculateRSI(prices: number[], period: number, index: number): number`
   - **Quelle:** CustomIndicator.tsx:979-991 (inline RSI-Berechnung)
   - **Anforderung:** Nur Daten `[index - period, index]` verwenden

2. **`core/features/movingAverage.ts`**
   - **Funktion:** `calculateMA(prices: number[], period: number, index: number): number`
   - **Quelle:** CustomIndicator.tsx:970-977 (inline MA-Berechnung)
   - **Anforderung:** Nur Daten `[index - period + 1, index]` verwenden

3. **`core/levels/supportResistance.ts`**
   - **Funktion:** `calculateSupportResistanceLevels(historical: Array<{date: string, close: number}>, referenceDate: Date): {support: number[], resistance: number[]}`
   - **Quelle:** CustomIndicator.tsx:273-364
   - **Änderung:** `referenceDate` Parameter statt `new Date()` (Fix für Lookahead-Bias)
   - **Funktion:** `calculateSupportResistanceLevelsAtTime(historical: Array<{date: string, close: number}>, timeIndex: number, lookbackMonths: number): {support: number[], resistance: number[]}`
   - **NEU:** Berechnet Levels für Zeitpunkt `timeIndex` mit Lookback

4. **`core/scoring/fundamental.ts`**
   - **Funktion:** `calculateFundamentalScore(details: CompanyDetails | null, weights: FundamentalWeights): number`
   - **Quelle:** CustomIndicator.tsx:112-218
   - **Änderung:** Gewichtungen als Parameter statt hart codiert

5. **`core/scoring/technical.ts`**
   - **Funktion:** `calculateTechnicalScore(rsi: number, maDistance: number, supportScore: number, weights: TechnicalWeights): number`
   - **Quelle:** CustomIndicator.tsx:993-1004 (inline)
   - **Änderung:** Gewichtungen als Parameter

6. **`core/scoring/combined.ts`**
   - **Funktion:** `calculateCombinedScore(technicalScore: number, fundamentalScore: number, weights: CombinedWeights): number`
   - **Quelle:** CustomIndicator.tsx:1006-1016 (inline)
   - **Änderung:** Gewichtungen als Parameter

7. **`core/signals/recommendation.ts`**
   - **Funktion:** `getRecommendation(data: IndicatorData, thresholds: SignalThresholds): 'KAUFEN' | 'VERKAUFEN' | 'HALTEN'`
   - **Quelle:** CustomIndicator.tsx:1067-1088
   - **Änderung:** Schwellenwerte als Parameter

8. **`core/backtest/engine.ts`**
   - **Funktion:** `runBacktest(historical: Array<{date: string, close: number}>, companyDetails: CompanyDetails | null, config: IndicatorConfig, backtestConfig: BacktestConfig): BacktestResult`
   - **Quelle:** CustomIndicator.tsx:367-466
   - **KRITISCH:** Verwendet `buildIndicatorSeries()` für zeitkorrekte Features

9. **`core/optimization/walkForward.ts`**
   - **Funktion:** `optimizeWeights(historical: Array<{date: string, close: number}>, companyDetails: CompanyDetails | null, config: OptimizationConfig): OptimizationResult`
   - **Quelle:** CustomIndicator.tsx:469-873
   - **KRITISCH:** Walk-Forward statt Lookahead-Labeling

10. **`core/pipeline/builder.ts`**
    - **Funktion:** `buildIndicatorSeries(historical: Array<{date: string, close: number}>, companyDetails: CompanyDetails | null, config: IndicatorConfig): IndicatorData[]`
    - **Quelle:** CustomIndicator.tsx:875-1047 (useEffect-Logik)
    - **KRITISCH:** Zeitkorrekte Berechnung pro Index

---

## 2️⃣ Lookahead-Bias: konkrete Fix-Strategie

### Bias A: Support/Resistance - aktuelles Datum als Referenz

**Problem-Stelle:**
- **Datei:** `components/CustomIndicator.tsx:279-285`
- **Code:**
  ```typescript
  const twelveMonthsAgo = new Date()  // PROBLEM: Verwendet HEUTE
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const recentData = historical.filter(item => {
    const itemDate = new Date(item.date)
    return itemDate >= twelveMonthsAgo  // PROBLEM: Filtert relativ zu HEUTE
  })
  ```

**Ursache:**
- Im Backtest für Zeitpunkt `t` (z.B. vor 2 Jahren) werden Support-Levels aus Daten berechnet, die **nach** Zeitpunkt `t` liegen.

**Fix-Strategie:**

**Option 1: Rolling Lookback (empfohlen für Backtest)**
- **Neue Funktion:** `calculateSupportResistanceLevelsAtTime(historical, timeIndex, lookbackMonths)`
- **Logik:**
  ```typescript
  // Für Zeitpunkt timeIndex:
  const referenceDate = new Date(historical[timeIndex].date)
  const lookbackDate = new Date(referenceDate)
  lookbackDate.setMonth(lookbackDate.getMonth() - lookbackMonths)
  
  const recentData = historical
    .slice(0, timeIndex + 1)  // Nur Daten bis timeIndex
    .filter(item => {
      const itemDate = new Date(item.date)
      return itemDate >= lookbackDate && itemDate <= referenceDate
    })
  ```
- **Verwendung:** In `buildIndicatorSeries()` für jeden Index `i` separat aufrufen
- **Performance:** O(n²) - kann optimiert werden mit inkrementeller Berechnung

**Option 2: Inkrementelle Berechnung (für Performance)**
- **Konzept:** Swing-Points werden pro Bar aktualisiert
- **Implementierung:** In Phase 2 (später)

**Betroffene Dateien:**
- `components/CustomIndicator.tsx:928` → `core/levels/supportResistance.ts`
- `components/CustomIndicator.tsx:1001` → `core/pipeline/builder.ts`

**UI-Änderung:** Keine - Output-Format bleibt gleich

---

### Bias B: optimizeWeights - lookAhead=5 Labeling

**Problem-Stelle:**
- **Datei:** `components/CustomIndicator.tsx:512-522`
- **Code:**
  ```typescript
  for (let i = 0; i < data.length - 5; i++) {
    const current = data[i]
    const lookAhead = 5  // PROBLEM: 5 Tage in die Zukunft
    const futureIndex = Math.min(i + lookAhead, data.length - 1)
    const futurePrice = data[futureIndex].price
    const priceChangePercent = (priceChange / current.price) * 100
    
    if (priceChangePercent > 3) {  // PROBLEM: Identifiziert "optimale Trades" mit Zukunftswissen
      // ... speichert als optimaler Trade
    }
  }
  ```

**Ursache:**
- Optimierung identifiziert Trades, die **in Zukunft** profitabel wären, was zum Zeitpunkt `i` nicht bekannt war.

**Fix-Strategie: Walk-Forward-Optimierung**

**Neue Funktion:** `optimizeWeightsWalkForward(historical, companyDetails, config)`

**Logik:**
1. **Train/Test Split:**
   ```typescript
   const trainSize = 0.7  // 70% Training, 30% Test
   const splitIndex = Math.floor(historical.length * trainSize)
   const trainData = historical.slice(0, splitIndex)
   const testData = historical.slice(splitIndex)
   ```

2. **Grid Search auf Train-Set:**
   - Teste verschiedene Gewichtungs-Kombinationen
   - **KEIN Lookahead:** Verwende nur historische Signale
   - **Zielfunktion:** `(winRate * 0.4) + (normalizedReturn * 0.3) + (tradeFrequency * 0.3)`
   - **Constraint:** `tradesPerYear >= minTradesPerYear` (z.B. 10)

3. **Evaluation auf Test-Set:**
   - Wende beste Konfiguration auf Test-Set an
   - Berechne Metriken (Win Rate, Return, etc.)

4. **Walk-Forward (optional, Phase 3):**
   - Wiederhole mit rollierendem Fenster

**Parameter-Optimierung:**
- **Wird optimiert:**
  - Tech/Fund Gewichtung (50-80% Tech, Schritt 10%)
  - Tech-Indikator-Gewichtungen (RSI, MA, Support)
  - Fundamental-Metrik-Gewichtungen
  - Signal-Schwellenwerte (buyFundamentalMin, sellCombinedMax, etc.)

- **Wird NICHT optimiert (Overfitting-Schutz):**
  - RSI-Period (bleibt 14)
  - MA-Period (bleibt 14)
  - Support-Lookback (bleibt 12 Monate)
  - Support-Cluster-Threshold (bleibt 1%)

**Betroffene Dateien:**
- `components/CustomIndicator.tsx:469-873` → `core/optimization/walkForward.ts`
- `components/CustomIndicator.tsx:512-663` → Entfernt (Lookahead-Labeling)

**UI-Änderung:** Keine - Optimierungs-Ergebnis-Format bleibt gleich

---

### Bias C: Backtest - vorberechnete Features

**Problem-Stelle:**
- **Datei:** `components/CustomIndicator.tsx:382-387`
- **Code:**
  ```typescript
  for (let i = 1; i < data.length; i++) {
    const current = data[i]  // PROBLEM: data[i] enthält bereits berechnete Scores
    const recommendation = getRecommendation(current)  // PROBLEM: Verwendet Scores, die mit Zukunftswissen berechnet wurden
  }
  ```

**Ursache:**
- `data` Array wurde in `useEffect` (Zeile 875-1047) **einmal für alle Datenpunkte** berechnet
- Support-Levels wurden aus **gesamten** historischen Daten berechnet (inklusive zukünftiger Daten)

**Fix-Strategie: Zeitkorrekte Feature-Pipeline**

**Neue Funktion:** `runBacktest(historical, companyDetails, config, backtestConfig)`

**Logik:**
1. **Für jeden Backtest-Zeitpunkt `i`:**
   ```typescript
   for (let i = period; i < historical.length; i++) {
     // Berechne Features NUR mit Daten <= i
     const features = buildIndicatorSeries(
       historical.slice(0, i + 1),  // Nur Daten bis i
       companyDetails,
       config
     )
     const current = features[features.length - 1]  // Letzter berechneter Punkt
     
     // Verwende getRecommendation mit zeitkorrekten Features
     const recommendation = getRecommendation(current, config.thresholds)
     
     // Trade-Logik...
   }
   ```

2. **Support-Levels pro Zeitpunkt:**
   - Rufe `calculateSupportResistanceLevelsAtTime(historical, i, 12)` auf
   - Nur Daten `[i - 365, i]` verwenden

3. **RSI/MA pro Zeitpunkt:**
   - Rufe `calculateRSI(prices, period, i)` auf
   - Rufe `calculateMA(prices, period, i)` auf
   - Nur Daten `[i - period, i]` verwenden

**Betroffene Dateien:**
- `components/CustomIndicator.tsx:367-466` → `core/backtest/engine.ts`
- `components/CustomIndicator.tsx:875-1047` → `core/pipeline/builder.ts`

**UI-Änderung:** Keine - BacktestResult-Format bleibt gleich (erweitert um neue Metriken)

---

## 3️⃣ Feature-Pipeline (zeitkorrekt)

### Haupt-Funktion: buildIndicatorSeries

**Datei:** `core/pipeline/builder.ts`

**Signatur:**
```typescript
export function buildIndicatorSeries(
  historical: Array<{ date: string; close: number; open?: number; high?: number; low?: number; volume?: number }>,
  companyDetails: CompanyDetails | null,
  config: IndicatorConfig
): IndicatorData[]
```

**Anforderungen:**
1. **Zeitkorrekte Berechnung:** Pro Index `i` nur Daten `[0, i]` verwenden
2. **Rolling Windows:** RSI/MA nur mit past data
3. **Support/Resistance:** Pro Index `i` Levels aus `[i - lookbackMonths, i]` berechnen
4. **Output-Format:** Identisch zu aktueller `IndicatorData[]` für UI-Kompatibilität

**Implementierungs-Logik:**

```typescript
export function buildIndicatorSeries(
  historical: Array<{ date: string; close: number }>,
  companyDetails: CompanyDetails | null,
  config: IndicatorConfig
): IndicatorData[] {
  if (historical.length < config.maPeriod) {
    return []
  }
  
  const result: IndicatorData[] = []
  const prices = historical.map(h => h.close)
  
  // Berechne fundamentalen Score einmal (statisch)
  const fundamentalScore = calculateFundamentalScore(
    companyDetails,
    config.fundamentalWeights
  )
  
  // Für jeden Datenpunkt (zeitkorrekt)
  for (let i = config.rsiPeriod; i < historical.length; i++) {
    const price = prices[i]
    const date = historical[i].date
    
    // 1. RSI: Nur Daten [i - period, i]
    const rsi = calculateRSI(prices, config.rsiPeriod, i)
    
    // 2. MA: Nur Daten [i - period + 1, i]
    const ma = calculateMA(prices, config.maPeriod, i)
    const maDistance = ((price - ma) / ma) * 100
    const maValue = 50 + Math.min(Math.max(maDistance * 5, -50), 50)
    
    // 3. Support/Resistance: Nur Daten [i - lookbackMonths, i]
    const levels = calculateSupportResistanceLevelsAtTime(
      historical,
      i,
      config.supportLookbackMonths
    )
    const supportLevels = levels.support.filter(s => s < price)
    const supportScore = calculateSupportScore(price, supportLevels)
    
    // 4. Technical Score
    const technicalScore = calculateTechnicalScore(
      rsi,
      maValue,
      supportScore,
      config.technicalWeights
    )
    
    // 5. Combined Score
    const combinedScore = calculateCombinedScore(
      technicalScore,
      fundamentalScore,
      config.combinedWeights
    )
    
    // 6. Signal (für Chart-Visualisierung)
    const technicalSignal = (technicalScore / 100) * price * 1.1
    
    result.push({
      time: new Date(date).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }),
      value: Math.round(ma * 100) / 100,
      signal: Math.round(technicalSignal * 100) / 100,
      price: Math.round(price * 100) / 100,
      fundamentalScore: Math.round(fundamentalScore * 10) / 10,
      combinedScore: Math.round(combinedScore * 10) / 10,
      // NEU (optional, für Debugging):
      technicalScore,
      rsi,
      maDistance,
      supportScore
    })
  }
  
  return result
}
```

**Parameter-Struktur (Config-Objekt):**

**Datei:** `core/types/indicator.ts`

```typescript
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
```

**Migration:**
- Alle hart codierten Werte in `CustomIndicator.tsx` werden durch `config` ersetzt
- Default-Werte entsprechen aktuellen hart codierten Werten
- UI kann `config` anpassen (später)

---

## 4️⃣ Backtest-Engine (korrekt + erweiterbar)

### Haupt-Funktion: runBacktest

**Datei:** `core/backtest/engine.ts`

**Signatur:**
```typescript
export function runBacktest(
  historical: Array<{ date: string; close: number }>,
  companyDetails: CompanyDetails | null,
  config: IndicatorConfig,
  backtestConfig: BacktestConfig
): BacktestResult
```

**Anforderungen:**
1. **Kein Lookahead:** Features werden pro Zeitpunkt `i` mit Daten `[0, i]` berechnet
2. **Trade-Logging:** Erweitert um `entryReason`, `exitReason`, `scoreSnapshot`
3. **Neue Metriken:** MaxDrawdown, ProfitFactor, Expectancy, AvgHoldDays
4. **Fees & Slippage:** Als Parameter (default 0)

**Implementierungs-Logik:**

```typescript
export function runBacktest(
  historical: Array<{ date: string; close: number }>,
  companyDetails: CompanyDetails | null,
  config: IndicatorConfig,
  backtestConfig: BacktestConfig = {}
): BacktestResult {
  const {
    stopLossPercent = 0.05,
    fees = 0,
    slippage = 0,
    minHoldDays = 0,
    maxHoldDays = Infinity
  } = backtestConfig
  
  const trades: BacktestResult['trades'] = []
  let position: 'LONG' | null = null
  let entryPrice = 0
  let entryDate = ''
  let entryIndex = -1
  let entryScores: { technical: number; fundamental: number; combined: number } | undefined
  
  let peakValue = 0
  let maxDrawdown = 0
  let totalGains = 0
  let totalLosses = 0
  
  // Zeitkorrekte Feature-Berechnung pro Bar
  for (let i = config.rsiPeriod; i < historical.length; i++) {
    // Berechne Features NUR mit Daten [0, i]
    const features = buildIndicatorSeries(
      historical.slice(0, i + 1),
      companyDetails,
      config
    )
    
    if (features.length === 0) continue
    
    const current = features[features.length - 1]
    const currentPrice = historical[i].close
    const currentDate = historical[i].date
    
    // Empfehlung mit zeitkorrekten Features
    const recommendation = getRecommendation(current, config.thresholds)
    
    // Exit-Logik
    if (position === 'LONG') {
      const holdDays = Math.floor(
        (new Date(currentDate).getTime() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      
      let shouldExit = false
      let exitReason = ''
      
      if (recommendation === 'VERKAUFEN') {
        shouldExit = true
        exitReason = 'VERKAUFEN-Signal'
      } else if (currentPrice < entryPrice * (1 - stopLossPercent)) {
        shouldExit = true
        exitReason = 'Stop-Loss'
      } else if (holdDays >= maxHoldDays) {
        shouldExit = true
        exitReason = 'Max Hold Days'
      } else if (holdDays < minHoldDays && recommendation === 'VERKAUFEN') {
        // Warte auf minHoldDays
      } else {
        shouldExit = false
      }
      
      if (shouldExit && holdDays >= minHoldDays) {
        const exitPrice = currentPrice * (1 - slippage)  // Slippage
        const returnAmount = exitPrice - entryPrice - fees  // Fees
        const returnPercent = (returnAmount / entryPrice) * 100
        
        trades.push({
          entryDate,
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
        
        if (returnAmount > 0) totalGains += returnAmount
        else totalLosses += Math.abs(returnAmount)
        
        position = null
      }
    }
    
    // Entry-Logik
    if (position === null && recommendation === 'KAUFEN') {
      const entryPriceWithSlippage = currentPrice * (1 + slippage)
      position = 'LONG'
      entryPrice = entryPriceWithSlippage + fees  // Fees
      entryDate = currentDate
      entryIndex = i
      entryScores = {
        technical: current.technicalScore || 0,
        fundamental: current.fundamentalScore,
        combined: current.combinedScore
      }
      peakValue = entryPrice
    }
    
    // Track Drawdown
    if (position === 'LONG') {
      const currentValue = currentPrice
      if (currentValue > peakValue) peakValue = currentValue
      const drawdown = ((peakValue - currentValue) / peakValue) * 100
      if (drawdown > maxDrawdown) maxDrawdown = drawdown
    }
  }
  
  // Schließe offene Position
  if (position === 'LONG') {
    const last = historical[historical.length - 1]
    const exitPrice = last.close * (1 - slippage)
    const returnAmount = exitPrice - entryPrice - fees
    const returnPercent = (returnAmount / entryPrice) * 100
    const holdDays = Math.floor(
      (new Date(last.date).getTime() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    
    trades.push({
      entryDate,
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
    
    if (returnAmount > 0) totalGains += returnAmount
    else totalLosses += Math.abs(returnAmount)
  }
  
  // Berechne Metriken
  const winningTrades = trades.filter(t => t.return > 0).length
  const losingTrades = trades.filter(t => t.return <= 0).length
  const totalReturn = trades.reduce((sum, t) => sum + t.return, 0)
  const avgReturn = trades.length > 0 ? totalReturn / trades.length : 0
  const avgWin = winningTrades > 0 ? trades.filter(t => t.return > 0).reduce((sum, t) => sum + t.return, 0) / winningTrades : 0
  const avgLoss = losingTrades > 0 ? Math.abs(trades.filter(t => t.return <= 0).reduce((sum, t) => sum + t.return, 0) / losingTrades) : 0
  const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? Infinity : 0
  const expectancy = (winningTrades / trades.length) * avgWin - (losingTrades / trades.length) * avgLoss
  const avgHoldDays = trades.length > 0 ? trades.reduce((sum, t) => sum + t.holdDays, 0) / trades.length : 0
  
  return {
    totalTrades: trades.length,
    winningTrades,
    losingTrades,
    winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
    totalReturn,
    totalReturnPercent: trades.length > 0 ? trades.reduce((sum, t) => sum + t.returnPercent, 0) / trades.length : 0,
    bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.returnPercent)) : 0,
    worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.returnPercent)) : 0,
    averageReturn: avgReturn,
    maxDrawdown,
    profitFactor,
    expectancy,
    avgHoldDays,
    trades
  }
}
```

**Metriken-Berechnung:**

**Datei:** `core/backtest/metrics.ts`

```typescript
export function calculateMaxDrawdown(trades: BacktestResult['trades']): number {
  // Berechnet maximale Drawdown-Serie
  // ...
}

export function calculateSharpeRatio(trades: BacktestResult['trades'], riskFreeRate: number = 0): number {
  // Sharpe Ratio = (Return - RiskFreeRate) / StdDev(Returns)
  // ...
}
```

---

## 5️⃣ Optimierung (ohne Overfitting) + Trade-Frequenz Constraint

### Walk-Forward-Optimierung

**Datei:** `core/optimization/walkForward.ts`

**Signatur:**
```typescript
export interface OptimizationConfig {
  trainTestSplit: number        // Default: 0.7 (70% Training)
  minTradesPerYear: number       // Default: 10
  techWeightRange: { min: number; max: number; step: number }  // Default: { min: 50, max: 80, step: 10 }
  techIndicatorConfigs: Array<{ rsi: number; ma: number; support: number }>
  fundamentalConfigs: Array<FundamentalWeights>
  thresholdConfigs: Array<SignalThresholds>
}

export interface OptimizationResult {
  bestConfig: IndicatorConfig
  trainPerformance: {
    winRate: number
    totalReturn: number
    tradeFrequency: number
    balancedScore: number
  }
  testPerformance: {
    winRate: number
    totalReturn: number
    tradeFrequency: number
    balancedScore: number
  }
  allResults: Array<{
    config: IndicatorConfig
    trainPerformance: {...}
    testPerformance: {...}
  }>
}

export function optimizeWeightsWalkForward(
  historical: Array<{ date: string; close: number }>,
  companyDetails: CompanyDetails | null,
  optimizationConfig: OptimizationConfig
): OptimizationResult
```

**Implementierungs-Logik:**

```typescript
export function optimizeWeightsWalkForward(
  historical: Array<{ date: string; close: number }>,
  companyDetails: CompanyDetails | null,
  optimizationConfig: OptimizationConfig
): OptimizationResult {
  const {
    trainTestSplit = 0.7,
    minTradesPerYear = 10,
    techWeightRange = { min: 50, max: 80, step: 10 },
    techIndicatorConfigs = [
      { rsi: 0.30, ma: 0.60, support: 0.10 },
      { rsi: 0.40, ma: 0.50, support: 0.10 },
      { rsi: 0.25, ma: 0.65, support: 0.10 },
      { rsi: 0.35, ma: 0.55, support: 0.10 }
    ],
    fundamentalConfigs = [
      // Standard + Variationen
    ],
    thresholdConfigs = [
      // Standard + Variationen
    ]
  } = optimizationConfig
  
  // Train/Test Split
  const splitIndex = Math.floor(historical.length * trainTestSplit)
  const trainData = historical.slice(0, splitIndex)
  const testData = historical.slice(splitIndex)
  
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
          const trainResult = runBacktest(trainData, companyDetails, config)
          
          // Trade-Frequenz prüfen
          const yearsInTrain = (new Date(trainData[trainData.length - 1].date).getTime() - new Date(trainData[0].date).getTime()) / (1000 * 60 * 60 * 24 * 365)
          const tradesPerYear = yearsInTrain > 0 ? trainResult.totalTrades / yearsInTrain : 0
          
          if (tradesPerYear < minTradesPerYear) {
            continue  // Überspringe Konfigurationen mit zu wenigen Trades
          }
          
          // Zielfunktion
          const balancedScore = calculateObjectiveScore(trainResult, minTradesPerYear)
          
          // Backtest auf Test-Set (für Evaluation)
          const testResult = runBacktest(testData, companyDetails, config)
          const testTradesPerYear = (new Date(testData[testData.length - 1].date).getTime() - new Date(testData[0].date).getTime()) / (1000 * 60 * 60 * 24 * 365)
          const testBalancedScore = calculateObjectiveScore(testResult, minTradesPerYear)
          
          allResults.push({
            config,
            trainPerformance: {
              winRate: trainResult.winRate,
              totalReturn: trainResult.totalReturnPercent,
              tradeFrequency: tradesPerYear,
              balancedScore
            },
            testPerformance: {
              winRate: testResult.winRate,
              totalReturn: testResult.totalReturnPercent,
              tradeFrequency: testTradesPerYear,
              balancedScore: testBalancedScore
            }
          })
        }
      }
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
    allResults
  }
}
```

**Zielfunktion:**

**Datei:** `core/optimization/objective.ts`

```typescript
export function calculateObjectiveScore(
  result: BacktestResult,
  minTradesPerYear: number
): number {
  // Balanced Score: WinRate + Return + Trade Frequency
  // Gewichtung: 40% WinRate, 30% Return, 30% Frequency
  const winRateScore = result.winRate / 100  // Normalisiert auf 0-1
  const returnScore = Math.min(result.totalReturnPercent / 50, 1)  // Normalisiert (50% = 1.0)
  const years = result.avgHoldDays > 0 ? (result.totalTrades * result.avgHoldDays) / 365 : 1
  const tradesPerYear = years > 0 ? result.totalTrades / years : 0
  const frequencyScore = Math.min(tradesPerYear / minTradesPerYear, 1)  // Normalisiert
  
  return (winRateScore * 0.4) + (returnScore * 0.3) + (frequencyScore * 0.3)
}
```

**Parameter-Optimierung:**

**Wird optimiert:**
- Tech/Fund Gewichtung (50-80% Tech, Schritt 10%)
- Tech-Indikator-Gewichtungen (RSI, MA, Support) - 4 Konfigurationen
- Fundamental-Metrik-Gewichtungen - 3 Konfigurationen
- Signal-Schwellenwerte (buyFundamentalMin, sellCombinedMax, etc.) - 3 Konfigurationen

**Wird NICHT optimiert (Overfitting-Schutz):**
- RSI-Period (14)
- MA-Period (14)
- Support-Lookback (12 Monate)
- Support-Cluster-Threshold (1%)
- Support-Min-Touches (2)
- Support-Max-Levels (5)

**Grund:** Diese Parameter sind technische Indikator-Parameter, die bei Optimierung zu Overfitting führen können.

---

## 6️⃣ Vorbereitung auf Server/Python

### API-Schnittstelle (Design, nicht implementiert)

**Zukünftige Route:** `app/api/indicator/compute/route.ts`

**Request:**
```typescript
POST /api/indicator/compute
Content-Type: application/json

{
  "symbol": "AAPL",
  "range": "1y",
  "config": {
    "rsiPeriod": 14,
    "maPeriod": 14,
    "technicalWeights": { "rsi": 0.30, "ma": 0.60, "support": 0.10 },
    // ... vollständiger IndicatorConfig
  },
  "backtestConfig": {
    "stopLossPercent": 0.05,
    "fees": 0,
    "slippage": 0
  }
}
```

**Response:**
```typescript
{
  "series": IndicatorData[],
  "meta": {
    "symbol": "AAPL",
    "range": "1y",
    "dataPoints": 252,
    "computedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Migration-Strategie:**

1. **Phase 1-2:** Alles client-seitig
   - `core/` Module können direkt im Browser verwendet werden
   - `CustomIndicator.tsx` importiert `buildIndicatorSeries` aus `core/`

2. **Phase 3:** Server-Migration
   - `core/` Module können 1:1 auf Server verschoben werden
   - API Route ruft `buildIndicatorSeries()` auf
   - Client sendet Request und empfängt `IndicatorData[]`
   - **Alternative:** Python-Implementierung mit gleicher Signatur

**Schnittstellen-Design:**

**Datei:** `core/types/api.ts` (NEU, für zukünftige Migration)

```typescript
export interface IndicatorComputeRequest {
  symbol: string
  range: string
  config: IndicatorConfig
  backtestConfig?: BacktestConfig
}

export interface IndicatorComputeResponse {
  series: IndicatorData[]
  meta: {
    symbol: string
    range: string
    dataPoints: number
    computedAt: string
  }
  backtestResult?: BacktestResult
}
```

**Aktuell:** Diese Datei wird erstellt, aber API Route wird **NICHT** implementiert (Phase 3).

---

## 7️⃣ Konkrete Task-Liste (3 Phasen)

### Phase 1: Kritische Fixes ohne UI-Änderung (1-2 Tage)

**Ziel:** Lookahead-Bias beheben, Types extrahieren, ohne UI zu ändern

#### Task 1.1: Types extrahieren
- [ ] **Datei erstellen:** `core/types/indicator.ts`
  - Kopiere `IndicatorData` Interface aus `components/CustomIndicator.tsx:6-13`
  - Erweitere um `technicalScore?`, `rsi?`, `maDistance?`, `supportScore?`
  - Erstelle `IndicatorConfig` Interface mit allen Default-Werten
- [ ] **Datei erstellen:** `core/types/company.ts`
  - Kopiere `CompanyDetails` aus `components/CustomIndicator.tsx:21-30`
- [ ] **Datei erstellen:** `core/types/stock.ts`
  - Kopiere `Stock` aus `components/CustomIndicator.tsx:15-19`
  - Kopiere `StockData` aus `app/aktien/[symbol]/page.tsx:9-24`
- [ ] **Datei erstellen:** `core/types/backtest.ts`
  - Kopiere `BacktestResult` aus `components/CustomIndicator.tsx:36-55`
  - Erweitere um `maxDrawdown`, `profitFactor`, `expectancy`, `avgHoldDays`
  - Erweitere `trades` um `entryReason`, `exitReason`, `holdDays`, `entryScore`
  - Erstelle `BacktestConfig` Interface
- [ ] **Erwartetes Ergebnis:** Alle Types sind in `core/types/` verfügbar, `CustomIndicator.tsx` importiert sie

#### Task 1.2: Support/Resistance Zeitreferenz-Fix
- [ ] **Datei erstellen:** `core/levels/supportResistance.ts`
  - Kopiere `calculateSupportResistanceLevels` aus `components/CustomIndicator.tsx:273-364`
  - **Ändere:** Füge `referenceDate: Date` Parameter hinzu statt `new Date()`
  - **NEU:** Erstelle `calculateSupportResistanceLevelsAtTime(historical, timeIndex, lookbackMonths)`
    - Filtert Daten `[timeIndex - lookbackMonths, timeIndex]`
    - Verwendet `historical[timeIndex].date` als Referenz
- [ ] **Test:** Unit Test für `calculateSupportResistanceLevelsAtTime`
  - Input: 100 Datenpunkte, timeIndex=50, lookbackMonths=12
  - Erwartung: Nur Daten [0, 50] werden verwendet
- [ ] **Erwartetes Ergebnis:** Support/Resistance kann für jeden Zeitpunkt separat berechnet werden

#### Task 1.3: Feature-Funktionen extrahieren
- [ ] **Datei erstellen:** `core/features/rsi.ts`
  - Funktion: `calculateRSI(prices: number[], period: number, index: number): number`
  - Logik aus `components/CustomIndicator.tsx:979-991`
  - **Sicherstellen:** Nur Daten `[index - period, index]` verwendet werden
- [ ] **Datei erstellen:** `core/features/movingAverage.ts`
  - Funktion: `calculateMA(prices: number[], period: number, index: number): number`
  - Logik aus `components/CustomIndicator.tsx:970-977`
  - **Sicherstellen:** Nur Daten `[index - period + 1, index]` verwendet werden
- [ ] **Datei erstellen:** `core/features/index.ts`
  - Re-Export: `export * from './rsi'`, `export * from './movingAverage'`
- [ ] **Erwartetes Ergebnis:** RSI und MA können isoliert getestet werden

#### Task 1.4: Scoring-Funktionen extrahieren
- [ ] **Datei erstellen:** `core/scoring/fundamental.ts`
  - Funktion: `calculateFundamentalScore(details: CompanyDetails | null, weights: FundamentalWeights): number`
  - Logik aus `components/CustomIndicator.tsx:112-218`
  - **Ändere:** Gewichtungen als Parameter statt hart codiert
- [ ] **Datei erstellen:** `core/scoring/technical.ts`
  - Funktion: `calculateTechnicalScore(rsi: number, maValue: number, supportScore: number, weights: TechnicalWeights): number`
  - Logik aus `components/CustomIndicator.tsx:993-1004`
- [ ] **Datei erstellen:** `core/scoring/combined.ts`
  - Funktion: `calculateCombinedScore(technicalScore: number, fundamentalScore: number, weights: CombinedWeights): number`
  - Logik aus `components/CustomIndicator.tsx:1006-1016`
- [ ] **Datei erstellen:** `core/scoring/index.ts`
  - Re-Export aller Scoring-Funktionen
- [ ] **Erwartetes Ergebnis:** Scoring-Logik ist modular und testbar

#### Task 1.5: Signal-Funktion extrahieren
- [ ] **Datei erstellen:** `core/signals/recommendation.ts`
  - Funktion: `getRecommendation(data: IndicatorData, thresholds: SignalThresholds): 'KAUFEN' | 'VERKAUFEN' | 'HALTEN'`
  - Logik aus `components/CustomIndicator.tsx:1067-1088`
  - **Ändere:** Schwellenwerte als Parameter statt hart codiert
- [ ] **Erwartetes Ergebnis:** Signal-Logik ist isoliert

#### Task 1.6: Pipeline-Builder erstellen (zeitkorrekt)
- [ ] **Datei erstellen:** `core/pipeline/builder.ts`
  - Funktion: `buildIndicatorSeries(historical, companyDetails, config): IndicatorData[]`
  - **Logik:** Loop über `historical`, für jeden Index `i`:
    - Rufe `calculateRSI(prices, period, i)` auf
    - Rufe `calculateMA(prices, period, i)` auf
    - Rufe `calculateSupportResistanceLevelsAtTime(historical, i, lookbackMonths)` auf
    - Berechne Scores mit extrahierten Funktionen
  - **Wichtig:** Nur Daten `[0, i]` für Index `i` verwenden
- [ ] **Test:** Unit Test für `buildIndicatorSeries`
  - Input: 100 Datenpunkte, config mit period=14
  - Erwartung: Erste 14 Datenpunkte haben keine RSI/MA, ab Index 14 werden Features berechnet
- [ ] **Erwartetes Ergebnis:** Feature-Pipeline ist zeitkorrekt

#### Task 1.7: CustomIndicator.tsx anpassen (minimal)
- [ ] **Datei ändern:** `components/CustomIndicator.tsx`
  - Importiere Types aus `core/types/`
  - Importiere `buildIndicatorSeries` aus `core/pipeline/builder`
  - **Ändere:** In `useEffect` (Zeile 875-1047):
    - Ersetze gesamte Berechnungs-Logik durch: `const newData = buildIndicatorSeries(historical, details, config)`
    - Verwende `DEFAULT_INDICATOR_CONFIG` als Basis
  - **Behalte:** Alle UI-Logik, States, Modals, Charts
- [ ] **Test:** Manuell testen, dass Chart weiterhin funktioniert
- [ ] **Erwartetes Ergebnis:** UI funktioniert identisch, aber Logik ist ausgelagert

---

### Phase 2: Modularisierung & Tests (3-7 Tage)

**Ziel:** Backtest/Optimierung zeitkorrekt machen, Unit Tests, Snapshot Tests

#### Task 2.1: Backtest-Engine erstellen (zeitkorrekt)
- [ ] **Datei erstellen:** `core/backtest/engine.ts`
  - Funktion: `runBacktest(historical, companyDetails, config, backtestConfig): BacktestResult`
  - **Logik:** Siehe Abschnitt 4️⃣
  - **Wichtig:** Verwendet `buildIndicatorSeries()` für jeden Zeitpunkt `i` mit Daten `[0, i]`
  - **Erweitert:** Trade-Logging um `entryReason`, `exitReason`, `holdDays`, `entryScore`
- [ ] **Datei erstellen:** `core/backtest/metrics.ts`
  - Funktionen: `calculateMaxDrawdown()`, `calculateSharpeRatio()`
- [ ] **Datei erstellen:** `core/backtest/index.ts`
  - Re-Export: `export * from './engine'`, `export * from './metrics'`
- [ ] **Test:** Unit Test für `runBacktest`
  - Input: 100 Datenpunkte, config, backtestConfig
  - Erwartung: Keine Trades mit Lookahead-Bias
  - Erwartung: `maxDrawdown`, `profitFactor`, `expectancy`, `avgHoldDays` sind berechnet
- [ ] **Erwartetes Ergebnis:** Backtest ist zeitkorrekt und erweiterbar

#### Task 2.2: CustomIndicator.tsx Backtest anpassen
- [ ] **Datei ändern:** `components/CustomIndicator.tsx`
  - **Ändere:** `runBacktest()` Funktion (Zeile 367-466)
    - Ersetze durch: `const result = runBacktest(historical, companyDetails, config, backtestConfig)`
    - Verwende `buildIndicatorSeries()` NICHT mehr (wird in `runBacktest` aufgerufen)
  - **Erweitere:** UI zeigt neue Metriken (`maxDrawdown`, `profitFactor`, etc.)
- [ ] **Test:** Manuell testen, dass Backtest-Ergebnisse angezeigt werden
- [ ] **Erwartetes Ergebnis:** Backtest funktioniert ohne Lookahead-Bias

#### Task 2.3: Optimierung Walk-Forward implementieren
- [ ] **Datei erstellen:** `core/optimization/walkForward.ts`
  - Funktion: `optimizeWeightsWalkForward(historical, companyDetails, optimizationConfig): OptimizationResult`
  - **Logik:** Siehe Abschnitt 5️⃣
  - **Wichtig:** Train/Test Split, KEIN Lookahead-Labeling
- [ ] **Datei erstellen:** `core/optimization/objective.ts`
  - Funktion: `calculateObjectiveScore(result, minTradesPerYear): number`
- [ ] **Datei erstellen:** `core/optimization/index.ts`
  - Re-Export aller Optimierungs-Funktionen
- [ ] **Test:** Unit Test für `optimizeWeightsWalkForward`
  - Input: 200 Datenpunkte, trainTestSplit=0.7
  - Erwartung: Train-Set hat 140 Datenpunkte, Test-Set hat 60
  - Erwartung: Optimierung verwendet nur Train-Set für Grid Search
- [ ] **Erwartetes Ergebnis:** Optimierung ist ohne Lookahead-Bias

#### Task 2.4: CustomIndicator.tsx Optimierung anpassen
- [ ] **Datei ändern:** `components/CustomIndicator.tsx`
  - **Ändere:** `optimizeWeights()` Funktion (Zeile 469-873)
    - Ersetze durch: `const result = optimizeWeightsWalkForward(historical, companyDetails, optimizationConfig)`
    - Entferne Lookahead-Labeling (Zeile 512-663)
  - **Erweitere:** UI zeigt Train/Test Performance
- [ ] **Test:** Manuell testen, dass Optimierung Ergebnisse anzeigt
- [ ] **Erwartetes Ergebnis:** Optimierung funktioniert ohne Lookahead-Bias

#### Task 2.5: Unit Tests für alle Core-Module
- [ ] **Datei erstellen:** `core/features/__tests__/rsi.test.ts`
  - Test: RSI-Berechnung mit bekannten Werten
  - Test: RSI verwendet nur past data
- [ ] **Datei erstellen:** `core/features/__tests__/movingAverage.test.ts`
  - Test: MA-Berechnung mit bekannten Werten
- [ ] **Datei erstellen:** `core/levels/__tests__/supportResistance.test.ts`
  - Test: Support/Resistance für Zeitpunkt `i` verwendet nur Daten `[i-12M, i]`
- [ ] **Datei erstellen:** `core/scoring/__tests__/fundamental.test.ts`
  - Test: Fundamental Score mit bekannten CompanyDetails
- [ ] **Datei erstellen:** `core/pipeline/__tests__/builder.test.ts`
  - Test: `buildIndicatorSeries` ist zeitkorrekt
  - Test: Output-Format entspricht `IndicatorData[]`
- [ ] **Datei erstellen:** `core/backtest/__tests__/engine.test.ts`
  - Test: Backtest verwendet zeitkorrekte Features
  - Test: Metriken werden korrekt berechnet
- [ ] **Erwartetes Ergebnis:** Alle Core-Module haben Unit Tests

#### Task 2.6: Snapshot Tests für Output-Kompatibilität
- [ ] **Datei erstellen:** `core/__tests__/snapshots.test.ts`
  - Test: `buildIndicatorSeries` Output für bekannte Inputs
  - Test: `runBacktest` Output für bekannte Inputs
  - **Zweck:** Sicherstellen, dass Refactor Output-Format nicht ändert
- [ ] **Erwartetes Ergebnis:** Snapshot Tests dokumentieren erwartetes Output-Format

#### Task 2.7: Support-Score Funktion extrahieren
- [ ] **Datei erstellen:** `core/levels/supportResistance.ts` (erweitern)
  - Funktion: `calculateSupportScore(currentPrice: number, supportLevels: number[]): number`
  - Logik aus `components/CustomIndicator.tsx:221-270`
- [ ] **Erwartetes Ergebnis:** Support-Score ist isoliert testbar

#### Task 2.8: Core Index-Datei erstellen
- [ ] **Datei erstellen:** `core/index.ts`
  - Re-Export: `export * from './types'`, `export * from './features'`, etc.
  - **Zweck:** Einfacher Import: `import { buildIndicatorSeries, runBacktest } from '@/core'`
- [ ] **Erwartetes Ergebnis:** Core-Module können einfach importiert werden

---

### Phase 3: Skalierung & Daten-Limits (später)

**Ziel:** Server-Migration, Caching, Rate-Limit-Handling

#### Task 3.1: API-Schnittstelle definieren (Design)
- [ ] **Datei erstellen:** `core/types/api.ts`
  - Interfaces: `IndicatorComputeRequest`, `IndicatorComputeResponse`
  - **Zweck:** Dokumentation für zukünftige Server-Migration
- [ ] **Erwartetes Ergebnis:** API-Design ist dokumentiert

#### Task 3.2: Server-Route erstellen (optional)
- [ ] **Datei erstellen:** `app/api/indicator/compute/route.ts`
  - POST Handler: Empfängt `IndicatorComputeRequest`
  - Ruft `buildIndicatorSeries()` auf (Server-seitig)
  - Gibt `IndicatorComputeResponse` zurück
  - **Caching:** `Cache-Control` Header basierend auf `symbol` + `range` + `config` Hash
- [ ] **Test:** API Route mit Postman/curl testen
- [ ] **Erwartetes Ergebnis:** Indikator-Berechnung kann server-seitig erfolgen

#### Task 3.3: Client anpassen (optional)
- [ ] **Datei ändern:** `components/CustomIndicator.tsx`
  - **Option A:** Weiterhin client-seitig (Standard)
  - **Option B:** API-Call zu `/api/indicator/compute` (wenn Server-Route existiert)
  - **Feature-Flag:** `USE_SERVER_COMPUTATION` Environment-Variable
- [ ] **Erwartetes Ergebnis:** Client kann wahlweise client- oder server-seitig berechnen

#### Task 3.4: Caching-Strategie (Redis, optional)
- [ ] **Datei erstellen:** `core/cache/cache.ts`
  - Funktionen: `getCachedResult(key)`, `setCachedResult(key, result, ttl)`
  - **Implementierung:** Redis oder In-Memory-Cache
- [ ] **Integration:** In `app/api/indicator/compute/route.ts`
  - Cache-Key: Hash von `symbol` + `range` + `config`
  - TTL: 1 Stunde für historische Daten, 1 Minute für aktuelle Daten
- [ ] **Erwartetes Ergebnis:** Berechnungen werden gecacht

#### Task 3.5: Rate-Limit-Handling
- [ ] **Datei erstellen:** `core/utils/rateLimit.ts`
  - Funktionen: `checkRateLimit(key)`, `incrementRateLimit(key)`
  - **Implementierung:** In-Memory oder Redis
- [ ] **Integration:** In `app/api/indicator/compute/route.ts`
  - Rate-Limit: 10 Requests/Minute pro IP
  - Response: 429 Too Many Requests
- [ ] **Erwartetes Ergebnis:** Rate-Limits werden eingehalten

#### Task 3.6: Python-Migration (optional, später)
- [ ] **Datei erstellen:** `python/indicator_engine.py`
  - Funktionen: `build_indicator_series()`, `run_backtest()`
  - **Signatur:** Identisch zu TypeScript-Versionen
- [ ] **API:** Flask/FastAPI Endpoint
  - POST `/api/indicator/compute`
  - Input/Output: JSON (identisch zu TypeScript-API)
- [ ] **Erwartetes Ergebnis:** Python-Implementierung kann TypeScript ersetzen

---

## Zusammenfassung

**Phase 1 (1-2 Tage):**
- Types extrahieren
- Support/Resistance Zeitreferenz-Fix
- Feature-Funktionen extrahieren
- Pipeline-Builder erstellen
- CustomIndicator.tsx minimal anpassen

**Phase 2 (3-7 Tage):**
- Backtest-Engine zeitkorrekt
- Optimierung Walk-Forward
- Unit Tests
- Snapshot Tests

**Phase 3 (später):**
- Server-Migration
- Caching
- Rate-Limit-Handling
- Python-Migration (optional)

**Erwartetes Endergebnis:**
- `CustomIndicator.tsx`: ~300-400 Zeilen (nur UI)
- `core/`: Modulare, testbare Engine
- Kein Lookahead-Bias
- Vorbereitet für Server-Migration

---

**Ende des Refactor-Plans**
