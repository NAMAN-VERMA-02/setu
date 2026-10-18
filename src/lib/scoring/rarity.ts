import { TRAIT_KEYS, TRAIT_POINTS, traitMatches, type TraitKey, type Traits } from "./traits";

/** How much of a trait's points the rarest possible match adds on top. */
export const RARITY_WEIGHT = 0.5;

export type Rarity = Record<TraitKey, number>;

/**
 * Rarity of each trait for this student: 1 minus the share of the pool that matches
 * the student on it. A trait nobody else shares scores near 1; one everybody shares, 0.
 */
export function computeRarity(me: Traits, pool: Traits[]): Rarity {
  const out = {} as Rarity;
  for (const key of TRAIT_KEYS) {
    if (pool.length === 0) {
      out[key] = 0;
      continue;
    }
    const sharing = pool.filter((p) => traitMatches(key, me, p)).length;
    out[key] = 1 - sharing / pool.length;
  }
  return out;
}

/** Extra points for each shared trait, larger the fewer people share it. */
export function rarityBonus(matched: TraitKey[], rarity: Rarity): number {
  const total = matched.reduce((sum, k) => sum + TRAIT_POINTS[k] * RARITY_WEIGHT * rarity[k], 0);
  return Math.round(total * 100) / 100;
}

/** The rarest shared trait among those allowed to be mentioned; ties go to the heavier trait. */
export function rarestTrait(matched: TraitKey[], rarity: Rarity, mentionable: (k: TraitKey) => boolean): TraitKey | null {
  const candidates = matched.filter((k) => k !== "tier" && mentionable(k));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, k) =>
    rarity[k] > rarity[best] || (rarity[k] === rarity[best] && TRAIT_POINTS[k] > TRAIT_POINTS[best]) ? k : best,
  );
}
