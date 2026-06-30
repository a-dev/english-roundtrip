/** Free sentences per UTC day for non-exempt users (context.md §16). */
export const DAILY_FREE_LIMIT = 10;

export function isOverDailyLimit(used: number): boolean {
  return used >= DAILY_FREE_LIMIT;
}
