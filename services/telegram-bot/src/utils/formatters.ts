/**
 * Message formatting utilities for Telegram
 */

export interface CoinAlert {
  coinAddress: string;
  score: number;
  analysis: {
    priceScore: number;
    volumeScore: number;
    socialScore: number;
    riskScore: number;
  };
  recommendations: string[];
}

/**
 * Format coin alert message
 */
export function formatCoinAlert(alert: CoinAlert): string {
  const { coinAddress, score, analysis, recommendations } = alert;

  // Format address (shortened)
  const addressShort = `${coinAddress.slice(0, 6)}...${coinAddress.slice(-4)}`;

  // Format score with emoji
  const scoreEmoji = score >= 80 ? '🟢' : score >= 70 ? '🟡' : '🔴';
  const scoreText = `${scoreEmoji} Score: ${score}/100`;

  // Format recommendations
  const recText = recommendations.length > 0
    ? `\n\n✅ ${recommendations.join(', ')}`
    : '';

  // Build message
  const message = `
🚀 <b>New High-Score Coin Detected!</b>

📍 <b>Token:</b> <code>${addressShort}</code>
🔗 <b>Address:</b> <code>${coinAddress}</code>

${scoreText}

📊 <b>Breakdown:</b>
• Price Score: ${analysis.priceScore}/100
• Volume Score: ${analysis.volumeScore}/100
• Social Score: ${analysis.socialScore}/100
• Risk Score: ${analysis.riskScore}/100
${recText}

⚠️ <i>Always do your own research before investing!</i>
  `.trim();

  return message;
}

/**
 * Format coin address for display
 */
export function formatAddress(address: string, length: number = 6): string {
  if (!address || address.length <= length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

/**
 * Escape special characters for Telegram HTML
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

