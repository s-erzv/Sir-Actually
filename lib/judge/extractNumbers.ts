/**
 * extractNumbers — helper for the rules engine.
 *
 * Extracts all numeric values from a text string.
 * Handles integers and decimals (both dot and comma as decimal separator).
 * Examples: "30 responden", "p = 0.03", "r² = 0,84", "10%" → [30, 0.03, 0.84, 10]
 */
export function extractNumbers(text: string): number[] {
  // Match numbers like: 30, 0.05, 0,84, 1.234, etc.
  const matches = text.match(/\d+[.,]?\d*/g);
  if (!matches) return [];
  return matches
    .map((m) => parseFloat(m.replace(",", ".")))
    .filter((n) => !isNaN(n));
}
