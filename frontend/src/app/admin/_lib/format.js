/**
 * Formats a cents amount as a USD string, e.g. money(7900) => "$79.00".
 * Pass `decimals: 0` for whole-dollar summaries (e.g. large aggregate totals).
 */
export function money(cents, decimals = 2) {
  return `$${((cents || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export default money;
