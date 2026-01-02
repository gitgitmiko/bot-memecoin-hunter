/**
 * Profit Floor Calculation Logic
 * 
 * ATURAN PROFIT FLOOR (Buy: $10):
 * - Profit floor AKTIF JIKA highest_price_ever >= $20
 * - Jika highest_price >= $30: floor = highest_price - $10
 * - Jika highest_price >= $20 dan < $30: floor = highest_price - $5
 * - Jika highest_price < $20: tidak ada floor (return null)
 * 
 * Contoh:
 * - Highest $20 → Floor $15 (auto sell jika price <= $15)
 * - Highest $30 → Floor $20 (auto sell jika price <= $20)
 * - Highest $40 → Floor $30 (auto sell jika price <= $30)
 * - Highest $50 → Floor $40 (auto sell jika price <= $40)
 */

/**
 * Calculate profit floor based on highest price ever
 * @param highestPrice - Highest price ever reached (in USD value, not per token)
 * @returns Profit floor price or null if no floor should be set
 */
export function calculateProfitFloor(highestPrice: number): number | null {
  // Floor hanya aktif jika highest_price >= $20
  if (highestPrice < 20) {
    return null;
  }

  // Jika highest_price >= $30: floor = highest_price - $10
  if (highestPrice >= 30) {
    return highestPrice - 10;
  }

  // Jika highest_price >= $20 dan < $30: floor = highest_price - $5
  // (ini untuk kasus $20 → floor $15)
  return highestPrice - 5;
}

/**
 * Check if sell condition is met
 * @param currentPrice - Current price (in USD value)
 * @param highestPrice - Highest price ever reached (in USD value)
 * @returns true if should sell (current price <= profit floor)
 */
export function shouldSell(currentPrice: number, highestPrice: number): boolean {
  const profitFloor = calculateProfitFloor(highestPrice);
  
  if (profitFloor === null) {
    return false;
  }

  return currentPrice <= profitFloor;
}

