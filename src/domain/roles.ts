/** Roles exempt from the daily cap (context.md §17). Set manually in D1. */
export const EXEMPT_ROLES = new Set(['premium', 'admin']);

export function isExempt(role: string | null): boolean {
  return role !== null && EXEMPT_ROLES.has(role);
}
