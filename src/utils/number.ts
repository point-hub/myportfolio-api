/**
 * Number Utilities for financial applications
 * - formatNumber: format number with thousand separators and fixed decimals
 * - parseNumber: convert formatted string to number
 * - roundNumber: round number to fixed decimals
 */

export function formatNumber(
  value: number | null | undefined,
  decimals: number = 0,
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return `0.${'0'.repeat(decimals)}`;
  }

  // Round value first
  const rounded = roundNumber(value, decimals);

  const [integer, fraction] = rounded.toFixed(decimals).split('.');
  const integerWithCommas = (integer ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${integerWithCommas}.${fraction}` : integerWithCommas;
}

export function parseNumber(value: string | null | undefined): number {
  if (!value) return 0;
  // Remove all commas, then parse
  const cleaned = value.replace(/,/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function roundNumber(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
