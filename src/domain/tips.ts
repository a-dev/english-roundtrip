/**
 * Fixed Telegram Stars tip tiers (context.md §18). Gratitude only — tipping
 * grants no features, so these amounts are purely cosmetic. Kept in `domain/`
 * so both the keyboard (`ui/keyboards.ts`) and the handler (`handlers/tip.ts`)
 * share one source without a circular import.
 */
export const TIP_TIERS = [50, 100, 250] as const;

export type TipTier = (typeof TIP_TIERS)[number];

export function isTipTier(value: number): value is TipTier {
  return (TIP_TIERS as readonly number[]).includes(value);
}
