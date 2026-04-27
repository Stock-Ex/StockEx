/**
 * Berechnet den RSI (Relative Strength Index) für einen gegebenen Index.
 * Verwendet nur Daten <= index (zeitkorrekt).
 * 
 * @param prices Array von Preisen
 * @param period RSI-Period (Standard: 14)
 * @param index Index für den RSI berechnet werden soll
 * @returns RSI-Wert (0-100), oder 50 wenn nicht genug Daten vorhanden
 */
export function calculateRSI(prices: number[], period: number, index: number): number {
  if (index < period || prices.length < period + 1) {
    return 50 // Neutral wenn nicht genug Daten
  }
  
  let gains = 0
  let losses = 0
  const lookback = Math.min(period, index)
  
  // Berechne Gains/Losses nur mit Daten <= index
  for (let j = Math.max(0, index - lookback + 1); j < index; j++) {
    if (j + 1 < prices.length) {
      const change = prices[j + 1] - prices[j]
      if (change > 0) {
        gains += change
      } else {
        losses += Math.abs(change)
      }
    }
  }
  
  const avgGain = gains / lookback
  const avgLoss = losses / lookback
  const rs = avgLoss > 0 ? avgGain / avgLoss : 1
  const rsi = 100 - (100 / (1 + rs))
  
  return rsi
}
