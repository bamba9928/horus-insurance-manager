/**
 * Limitation des tentatives de connexion (en mémoire, par IP).
 *
 * @module auth/rateLimit
 */

interface Bucket {
  failures: number;
  windowStart: number;
}

export class LoginRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxFailures = 10,
    private readonly windowMs = 15 * 60_000,
    private readonly maxEntries = 50_000,
  ) {}

  /** Vrai si la clé a dépassé le nombre de tentatives autorisées. */
  isBlocked(key: string): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket) return false;
    if (Date.now() - bucket.windowStart > this.windowMs) {
      this.buckets.delete(key);
      return false;
    }
    return bucket.failures >= this.maxFailures;
  }

  recordFailure(key: string): void {
    const bucket = this.buckets.get(key);
    if (!bucket || Date.now() - bucket.windowStart > this.windowMs) {
      // Borne mémoire : purge avant d'insérer si la table a trop grossi
      // (protège contre un flood d'IP variées, réelles ou usurpées).
      if (this.buckets.size >= this.maxEntries) this.sweep();
      this.buckets.set(key, { failures: 1, windowStart: Date.now() });
      return;
    }
    bucket.failures++;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** Supprime les fenêtres expirées ; appelé périodiquement et sur saturation. */
  sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStart > this.windowMs) this.buckets.delete(key);
    }
  }
}

/**
 * Limiteur générique à fenêtre glissante (en mémoire, par clé).
 * Utilisé pour plafonner le débit des mutations d'un utilisateur connecté :
 * une clé qui dépasse `max` requêtes dans `windowMs` est temporairement
 * refusée (429). Généreux pour l'usage normal, il ne bloque que les abus.
 */
export class SlidingWindowLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly max = 240,
    private readonly windowMs = 60_000,
    private readonly maxEntries = 50_000,
  ) {}

  /** Enregistre un appel ; renvoie `false` si la clé a dépassé le quota. */
  hit(key: string): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket || Date.now() - bucket.windowStart > this.windowMs) {
      if (this.buckets.size >= this.maxEntries) this.sweep();
      this.buckets.set(key, { failures: 1, windowStart: Date.now() });
      return true;
    }
    bucket.failures++;
    return bucket.failures <= this.max;
  }

  sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStart > this.windowMs) this.buckets.delete(key);
    }
  }
}
