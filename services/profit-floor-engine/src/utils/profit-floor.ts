/**
 * Profit Floor Calculation Logic
 * 
 * ATURAN PROFIT FLOOR:
 * - Profit floor AKTIF HANYA JIKA highest_price_ever >= $50
 * - Floor = 50% dari kelipatan 100 terdekat
 * 
 * TABEL:
 * Highest Price    Profit Floor
 * ≥ $50            $20
 * ≥ $100           $50
 * ≥ $200           $100
 * ≥ $300           $150
 * ≥ $400           $200
 * ≥ $500           $250
 * dst              Math.floor(highestPrice / 100) * 50
 */

/**
 * Calculate profit floor based on highest price ever
 * @param highestPrice Highest price ever reached (in USD)
 * @returns Profit floor in USD, or null if highest price < $50
 */
export function calculateProfitFloor(highestPrice: number): number | null {
  // Profit floor hanya aktif jika highest_price >= $50
  if (highestPrice < 50) {
    return null;
  }

  // Special case: $50 - $99.99 -> floor = $20
  if (highestPrice >= 50 && highestPrice < 100) {
    return 20;
  }

  // General formula: floor = Math.floor(highestPrice / 100) * 50
  const floor = Math.floor(highestPrice / 100) * 50;
  return floor;
}

/**
 * Check if sell condition is met (current price <= profit floor)
 * @param currentPrice Current price (in USD)
 * @param highestPrice Highest price ever (in USD)
 * @returns true if should sell, false otherwise
 */
export function shouldSell(currentPrice: number, highestPrice: number): boolean {
  const profitFloor = calculateProfitFloor(highestPrice);
  
  // No profit floor = no sell (hold)
  if (profitFloor === null) {
    return false;
  }

  // Sell if current price <= profit floor
  return currentPrice <= profitFloor;
}

/**
 * Get profit floor info for display
 */
export function getProfitFloorInfo(highestPrice: number): {
  hasFloor: boolean;
  floor: number | null;
  isActive: boolean;
} {
  const floor = calculateProfitFloor(highestPrice);
  return {
    hasFloor: floor !== null,
    floor: floor,
    isActive: floor !== null,
  };
}

