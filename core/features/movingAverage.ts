/**
 * Berechnet den Moving Average für einen gegebenen Index.
 * Verwendet nur Daten <= index (zeitkorrekt).
 * 
 * @param prices Array von Preisen
 * @param period MA-Period
 * @param index Index für den MA berechnet werden soll
 * @returns Moving Average, oder price wenn nicht genug Daten vorhanden
 */
export function calculateMA(prices: number[], period: number, index: number): number {
  if (prices.length === 0) {
    return 0
  }
  
  // Wenn nicht genug Daten, berechne MA über verfügbaren Bereich
  const startIndex = Math.max(0, index - period + 1)
  const endIndex = index + 1
  
  let sum = 0
  let count = 0
  
  for (let j = startIndex; j < endIndex && j < prices.length; j++) {
    sum += prices[j]
    count++
  }
  
  if (count > 0) {
    return sum / count
  }
  
  // Fallback: aktueller Preis
  return prices[index] || 0
}
