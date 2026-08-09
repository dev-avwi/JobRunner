/**
 * Lightweight in-memory TTL+LRU cache, dependency-free.
 *
 * Used for hot-read caching (business settings, team rosters, catalogs, etc).
 * Each cache namespace tracks hit/miss/invalidation counters for /api/metrics.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheStat {
  hits: number;
  misses: number;
  invalidations: number;
}

const stats = new Map<string, CacheStat>();

function bumpStat(ns: string, field: keyof CacheStat) {
  let s = stats.get(ns);
  if (!s) {
    s = { hits: 0, misses: 0, invalidations: 0 };
    stats.set(ns, s);
  }
  s[field]++;
}

export interface HotCacheOptions {
  ttlMs: number;
  max?: number;
}

export class HotCache<T> {
  private readonly map = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly max: number;

  constructor(public readonly namespace: string, opts: HotCacheOptions) {
    this.ttlMs = opts.ttlMs;
    this.max = opts.max ?? 1000;
  }

  private evictIfNeeded() {
    while (this.map.size > this.max) {
      // Map preserves insertion order; first key is oldest.
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      this.map.delete(oldestKey);
    }
  }

  private getValid(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency: re-insert to move to the end of the iteration order.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  /**
   * Synchronous read with TTL + LRU recency + hit/miss accounting.
   * Returns undefined on miss/expiry; caller is responsible for repopulating via set().
   */
  get(key: string): T | undefined {
    const hit = this.getValid(key);
    if (hit !== undefined) {
      bumpStat(this.namespace, "hits");
      return hit;
    }
    bumpStat(this.namespace, "misses");
    return undefined;
  }

  async getOrLoad(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = this.getValid(key);
    if (hit !== undefined) {
      bumpStat(this.namespace, "hits");
      return hit;
    }
    bumpStat(this.namespace, "misses");
    const val = await loader();
    if (val !== undefined && val !== null) {
      this.set(key, val);
    }
    return val;
  }

  set(key: string, value: T) {
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    this.evictIfNeeded();
  }

  invalidate(key: string) {
    if (this.map.delete(key)) {
      bumpStat(this.namespace, "invalidations");
    }
  }

  invalidatePrefix(prefix: string) {
    let count = 0;
    for (const k of Array.from(this.map.keys())) {
      if (k.startsWith(prefix)) {
        this.map.delete(k);
        count++;
      }
    }
    if (count > 0) {
      const s = stats.get(this.namespace);
      if (s) s.invalidations += count;
    }
  }

  clear() {
    const size = this.map.size;
    this.map.clear();
    if (size > 0) {
      const s = stats.get(this.namespace);
      if (s) s.invalidations += size;
    }
  }

  size(): number {
    return this.map.size;
  }
}

// Hot caches for read-heavy, low-churn data
export const businessSettingsCache = new HotCache<any>("businessSettings", { ttlMs: 60_000, max: 500 });
export const teamRosterCache = new HotCache<any>("teamRoster", { ttlMs: 30_000, max: 500 });
export const lineItemCatalogCache = new HotCache<any>("lineItemCatalog", { ttlMs: 60_000, max: 500 });
export const rateCardCache = new HotCache<any>("rateCards", { ttlMs: 60_000, max: 500 });
export const userCache = new HotCache<any>("user", { ttlMs: 30_000, max: 1000 });
export const aggregateDashboardCache = new HotCache<any>("aggregateDashboard", { ttlMs: 15_000, max: 500 });

// Drive-time/distance matrix cache (Task #285 — Day Planner route optimiser).
// Repeated optimise calls for the same day reuse the OSRM table result for a
// short TTL instead of re-hitting the rate-limited public OSRM server. Keyed by
// the rounded, ordered coordinate list, so an unchanged job set is a cache hit.
export const driveMatrixCache = new HotCache<any>("driveMatrix", { ttlMs: 300_000, max: 500 });

// Road-route geometry cache (Task #291 — Job Map driving path).
// The public OSRM server is rate-limited and occasionally slow, so identical
// stop sequences reuse the cached GeoJSON path for a short TTL instead of
// re-fetching. Keyed by the rounded, ordered coordinate list. Only successful
// OSRM responses are cached, so a true OSRM miss still falls back to straight
// lines on the next call.
export const routeGeometryCache = new HotCache<any>("routeGeometry", { ttlMs: 300_000, max: 500 });

// Accounting integration metadata caches (Task #91 — pull-and-cache for mapping UI)
// 60s TTL keeps the Integrations page snappy without serving stale data when a
// tenant adds a new account/tax-rate. Per-userId keys.
export const xeroAccountsCache = new HotCache<any>("xeroAccounts", { ttlMs: 60_000, max: 200 });
export const xeroTaxRatesCache = new HotCache<any>("xeroTaxRates", { ttlMs: 60_000, max: 200 });
export const xeroItemsCache = new HotCache<any>("xeroItems", { ttlMs: 60_000, max: 200 });
export const qboAccountsCache = new HotCache<any>("qboAccounts", { ttlMs: 60_000, max: 200 });
export const qboTaxRatesCache = new HotCache<any>("qboTaxRates", { ttlMs: 60_000, max: 200 });
export const qboItemsCache = new HotCache<any>("qboItems", { ttlMs: 60_000, max: 200 });
export const myobAccountsCache = new HotCache<any>("myobAccounts", { ttlMs: 60_000, max: 200 });
export const myobTaxCodesCache = new HotCache<any>("myobTaxCodes", { ttlMs: 60_000, max: 200 });
export const myobItemsCache = new HotCache<any>("myobItems", { ttlMs: 60_000, max: 200 });

export function getCacheStats() {
  const out: Record<string, CacheStat & { size: number }> = {};
  const caches: Record<string, HotCache<any>> = {
    businessSettings: businessSettingsCache,
    teamRoster: teamRosterCache,
    lineItemCatalog: lineItemCatalogCache,
    rateCards: rateCardCache,
    user: userCache,
    aggregateDashboard: aggregateDashboardCache,
    driveMatrix: driveMatrixCache,
    routeGeometry: routeGeometryCache,
  };
  for (const [ns, c] of Object.entries(caches)) {
    const s = stats.get(ns) ?? { hits: 0, misses: 0, invalidations: 0 };
    out[ns] = { ...s, size: c.size() };
  }
  return out;
}

// Convenience invalidators called from write paths
export function invalidateBusinessSettings(userId: string) {
  businessSettingsCache.invalidate(userId);
  aggregateDashboardCache.invalidate(userId);
}
export function invalidateTeamRoster(businessOwnerId: string) {
  teamRosterCache.invalidate(businessOwnerId);
  aggregateDashboardCache.invalidate(businessOwnerId);
}
export function invalidateCatalog(userId: string) {
  lineItemCatalogCache.invalidatePrefix(`${userId}:`);
}
export function invalidateRateCards(userId: string) {
  rateCardCache.invalidatePrefix(`${userId}:`);
}
export function invalidateUser(userId: string) {
  userCache.invalidate(userId);
}
export function invalidateAggregateDashboard(userId: string) {
  aggregateDashboardCache.invalidate(userId);
}
