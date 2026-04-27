import type { IndicatorConfig } from '../types/indicator'

/**
 * Berechnet Support-Score basierend auf Nähe zu Support-Linien.
 * Logik 1:1 aus CustomIndicator.tsx:221-270
 */
export function calculateSupportScore(currentPrice: number, supportLevels: number[]): number {
  if (supportLevels.length === 0) {
    return 50 // Neutral wenn keine Support-Levels vorhanden
  }

  // Finde die nächstgelegene Support-Linie
  let nearestSupport = supportLevels[0]
  let minDistance = Math.abs(currentPrice - nearestSupport) / currentPrice

  for (const support of supportLevels) {
    const distance = Math.abs(currentPrice - support) / currentPrice
    if (distance < minDistance) {
      minDistance = distance
      nearestSupport = support
    }
  }

  // Berechne Score basierend auf Position relativ zur Support-Linie
  const priceDiff = currentPrice - nearestSupport
  const priceDiffPercent = (priceDiff / nearestSupport) * 100

  // Punktesystem:
  // - Kurs genau an Support (±0.5%) → Score 90-100 (starkes Kaufsignal)
  // - Kurs leicht über Support (0.5-2%) → Score 70-90 (Kaufsignal)
  // - Kurs über Support (2-5%) → Score 50-70 (neutral bis leicht positiv)
  // - Kurs deutlich über Support (>5%) → Score 30-50 (neutral)
  // - Kurs unter Support → Score 0-30 (Verkaufssignal, je weiter desto schlechter)

  if (priceDiffPercent >= -0.5 && priceDiffPercent <= 0.5) {
    // Sehr nah an Support (±0.5%)
    return 90 + (0.5 - Math.abs(priceDiffPercent)) * 20 // 90-100
  } else if (priceDiffPercent > 0.5 && priceDiffPercent <= 2) {
    // Leicht über Support (0.5-2%)
    return 70 + (2 - priceDiffPercent) * 10 // 70-90
  } else if (priceDiffPercent > 2 && priceDiffPercent <= 5) {
    // Über Support (2-5%)
    return 50 + (5 - priceDiffPercent) * 6.67 // 50-70
  } else if (priceDiffPercent > 5) {
    // Deutlich über Support (>5%)
    return Math.max(30, 50 - (priceDiffPercent - 5) * 2) // 30-50
  } else {
    // Unter Support (negativ)
    const distanceBelow = Math.abs(priceDiffPercent)
    if (distanceBelow <= 2) {
      return 30 - distanceBelow * 10 // 10-30
    } else {
      return Math.max(0, 10 - (distanceBelow - 2) * 2.5) // 0-10
    }
  }
}

/**
 * Berechnet Support- und Resistance-Levels basierend auf historischen Daten.
 * FIX: Verwendet referenceDate statt new Date() (Lookahead-Bias-Fix).
 * 
 * @param historical Historische Preisdaten
 * @param referenceDate Referenzdatum (statt "heute")
 * @param config Config mit supportLookbackMonths, supportClusterThreshold, supportMinTouches, supportMaxLevels
 */
export function calculateSupportResistanceLevels(
  historical: Array<{ date: string; close: number }>,
  referenceDate: Date,
  config: Pick<IndicatorConfig, 'supportLookbackMonths' | 'supportClusterThreshold' | 'supportMinTouches' | 'supportMaxLevels'>
): { support: number[]; resistance: number[] } {
  if (historical.length < 20) {
    return { support: [], resistance: [] }
  }

  // Filtere die letzten supportLookbackMonths relativ zu referenceDate (FIX: nicht "heute")
  const lookbackDate = new Date(referenceDate)
  lookbackDate.setMonth(lookbackDate.getMonth() - config.supportLookbackMonths)
  
  const recentData = historical.filter(item => {
    const itemDate = new Date(item.date)
    return itemDate >= lookbackDate && itemDate <= referenceDate
  })

  if (recentData.length < 10) {
    return { support: [], resistance: [] }
  }

  // Finde lokale Minima (Support) und Maxima (Resistance)
  // Ein lokales Minimum/Maximum ist ein Punkt, der niedriger/höher ist als seine Nachbarn
  const windowSize = Math.max(3, Math.floor(recentData.length / 20)) // Dynamisches Fenster
  const localMinima: number[] = []
  const localMaxima: number[] = []

  for (let i = windowSize; i < recentData.length - windowSize; i++) {
    const currentPrice = recentData[i].close
    let isLocalMin = true
    let isLocalMax = true

    // Prüfe Nachbarn im Fenster
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j === i) continue
      if (recentData[j].close < currentPrice) {
        isLocalMin = false
      }
      if (recentData[j].close > currentPrice) {
        isLocalMax = false
      }
    }

    if (isLocalMin) {
      localMinima.push(currentPrice)
    }
    if (isLocalMax) {
      localMaxima.push(currentPrice)
    }
  }

  // Gruppiere ähnliche Preise zusammen
  const clusterLevels = (levels: number[], threshold: number): number[] => {
    if (levels.length === 0) return []
    
    const sorted = [...levels].sort((a, b) => a - b)
    const clusters: number[][] = []
    
    for (const price of sorted) {
      let foundCluster = false
      for (const cluster of clusters) {
        const clusterAvg = cluster.reduce((sum, p) => sum + p, 0) / cluster.length
        const diff = Math.abs(price - clusterAvg) / clusterAvg
        if (diff <= threshold) {
          cluster.push(price)
          foundCluster = true
          break
        }
      }
      if (!foundCluster) {
        clusters.push([price])
      }
    }

    // Berechne Durchschnitt für jeden Cluster und sortiere nach Häufigkeit
    const clusterAverages = clusters
      .map(cluster => ({
        avg: cluster.reduce((sum, p) => sum + p, 0) / cluster.length,
        count: cluster.length,
        min: Math.min(...cluster),
        max: Math.max(...cluster)
      }))
      .filter(cluster => cluster.count >= config.supportMinTouches) // Nur Levels mit mindestens X Berührungen
      .sort((a, b) => b.count - a.count) // Sortiere nach Häufigkeit
      .map(item => item.avg)

    // Nimm die stärksten Levels
    return clusterAverages.slice(0, config.supportMaxLevels)
  }

  const supportLevels = clusterLevels(localMinima, config.supportClusterThreshold)
  const resistanceLevels = clusterLevels(localMaxima, config.supportClusterThreshold)

  return { support: supportLevels, resistance: resistanceLevels }
}

/**
 * Berechnet Support- und Resistance-Levels für einen spezifischen Zeitpunkt (zeitkorrekt).
 * Verwendet nur Daten bis einschließlich timeIndex.
 * 
 * @param historical Historische Preisdaten
 * @param timeIndex Index des Zeitpunkts, für den Levels berechnet werden sollen
 * @param config Config mit supportLookbackMonths, supportClusterThreshold, supportMinTouches, supportMaxLevels
 */
export function calculateSupportResistanceLevelsAtTime(
  historical: Array<{ date: string; close: number }>,
  timeIndex: number,
  config: Pick<IndicatorConfig, 'supportLookbackMonths' | 'supportClusterThreshold' | 'supportMinTouches' | 'supportMaxLevels'>
): { support: number[]; resistance: number[] } {
  if (timeIndex < 0 || timeIndex >= historical.length) {
    return { support: [], resistance: [] }
  }
  
  // Verwende nur Daten bis einschließlich timeIndex (zeitkorrekt)
  const dataUpToTime = historical.slice(0, timeIndex + 1)
  
  if (dataUpToTime.length === 0) {
    return { support: [], resistance: [] }
  }
  
  // Referenzdatum ist der Zeitpunkt timeIndex (nicht "heute")
  const referenceDate = new Date(historical[timeIndex].date)
  
  // Rufe calculateSupportResistanceLevels mit zeitkorrektem referenceDate auf
  return calculateSupportResistanceLevels(dataUpToTime, referenceDate, config)
}

/**
 * Kompatibilitäts-Funktion für Legacy-Code (z.B. Optimierung in Phase 1).
 * Berechnet Support/Resistance für den letzten Zeitpunkt (wie bisher).
 * 
 * @deprecated Verwende calculateSupportResistanceLevelsAtTime für zeitkorrekte Berechnung
 */
export function calculateSupportResistanceLevelsLegacy(
  historical: Array<{ date: string; close: number }>
): { support: number[]; resistance: number[] } {
  if (historical.length === 0) {
    return { support: [], resistance: [] }
  }
  
  // Verwende letzten Zeitpunkt als Referenz (wie bisher)
  const lastIndex = historical.length - 1
  const referenceDate = new Date(historical[lastIndex].date)
  
  return calculateSupportResistanceLevels(historical, referenceDate, {
    supportLookbackMonths: 12,
    supportClusterThreshold: 0.01,
    supportMinTouches: 2,
    supportMaxLevels: 5
  })
}
