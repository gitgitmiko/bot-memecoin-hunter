/**
 * Profit Floor Calculation Logic
 * 
 * ATURAN PROFIT FLOOR (Relatif terhadap invest amount):
 * - Profit floor AKTIF JIKA highest_price_ever >= 5x invest amount
 * - Threshold: highest_price >= 5x invest amount
 * - Formula: floor = Math.floor(highestPrice / (investAmount * 10)) * (investAmount * 5)
 * 
 * Contoh untuk invest $10:
 * - Highest $50 (5x) → Floor $20 (2x invest)
 * - Highest $100 (10x) → Floor $50 (5x invest)
 * - Highest $200 (20x) → Floor $100 (10x invest)
 * 
 * Contoh untuk invest $40:
 * - Highest $200 (5x) → Floor $80 (2x invest)
 * - Highest $400 (10x) → Floor $200 (5x invest)
 * - Highest $800 (20x) → Floor $400 (10x invest)
 * 
 * Formula umum:
 * - Threshold: highestPrice >= investAmount * 5
 * - Jika highestPrice >= investAmount * 5 dan < investAmount * 10: floor = investAmount * 2
 * - Jika highestPrice >= investAmount * 10: floor = Math.floor(highestPrice / (investAmount * 10)) * (investAmount * 5)
 */

/**
 * Calculate profit floor based on highest price ever and invested amount
 * @param highestPrice - Highest price ever reached (in USD value, not per token)
 * @param investAmount - Amount invested in USD (default: $10 for backward compatibility)
 * @returns Profit floor price or null if no floor should be set
 */
export function calculateProfitFloor(highestPrice: number, investAmount: number = 10): number | null {
  // Threshold: highest_price >= 5x invest amount
  const threshold = investAmount * 5;
  
  // Floor hanya aktif jika highest_price >= threshold
  if (highestPrice < threshold) {
    return null;
  }

  // Jika highest_price >= 5x dan < 10x invest: floor = 2x invest
  // Contoh: invest $10, highest $50 → floor $20
  // Contoh: invest $40, highest $200 → floor $80
  if (highestPrice >= threshold && highestPrice < investAmount * 10) {
    return investAmount * 2;
  }

  // Untuk >= 10x invest, gunakan formula: floor = Math.floor(highestPrice / (investAmount * 10)) * (investAmount * 5)
  // Contoh: invest $10, highest $100 → floor = Math.floor(100/100) * 50 = $50
  // Contoh: invest $40, highest $400 → floor = Math.floor(400/400) * 200 = $200
  return Math.floor(highestPrice / (investAmount * 10)) * (investAmount * 5);
}

/**
 * Check if sell condition is met
 * @param currentPrice - Current price (in USD value)
 * @param highestPrice - Highest price ever reached (in USD value)
 * @param investAmount - Amount invested in USD (default: $10 for backward compatibility)
 * @returns true if should sell (current price <= profit floor)
 */
export function shouldSell(currentPrice: number, highestPrice: number, investAmount: number = 10): boolean {
  const profitFloor = calculateProfitFloor(highestPrice, investAmount);
  
  if (profitFloor === null) {
    return false;
  }

  return currentPrice <= profitFloor;
}

