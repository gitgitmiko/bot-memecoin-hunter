/**
 * Profit Floor Calculation Logic
 * 
 * ATURAN PROFIT FLOOR:
 * - Profit floor AKTIF HANYA JIKA highest_price_ever >= $50
 * - Floor = 50% dari kelipatan 100 terdekat
 */

/**
 * Calculate profit floor based on highest price ever
 */
export function calculateProfitFloor(highestPrice: number): number | null {
  if (highestPrice < 50) {
    return null;
  }

  if (highestPrice >= 50 && highestPrice < 100) {
    return 20;
  }

  const floor = Math.floor(highestPrice / 100) * 50;
  return floor;
}

/**
 * Check if sell condition is met
 */
export function shouldSell(currentPrice: number, highestPrice: number): boolean {
  const profitFloor = calculateProfitFloor(highestPrice);
  
  if (profitFloor === null) {
    return false;
  }

  return currentPrice <= profitFloor;
}

