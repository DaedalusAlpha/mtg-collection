import type { CardEntry, CountsStore } from "./types";

const COUNTS_KEY = "mtg-checklist:counts:v1";
const SELECTED_SETS_KEY = "mtg-checklist:selected-sets:v1";

// Bump this version whenever CardEntry's shape changes — old cached data
// won't have new fields (e.g. adding `imageUrl` left previously-cached sets
// without images for up to 24h), so a version bump invalidates it instantly
// instead of waiting out the TTL.
const SET_CACHE_VERSION = "v2";
const SET_CACHE_PREFIX = `mtg-checklist:set-cache:${SET_CACHE_VERSION}:`;

// Scryfall only refreshes prices once a day, and asks API consumers to
// cache data for at least 24h rather than refetch more often than that.
const SET_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedSet {
  entries: CardEntry[];
  fetchedAt: number;
}

export function loadCachedSetEntries(code: string): CardEntry[] | null {
  try {
    const raw = localStorage.getItem(SET_CACHE_PREFIX + code);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedSet;
    if (Date.now() - cached.fetchedAt > SET_CACHE_TTL_MS) return null;
    return cached.entries;
  } catch {
    return null;
  }
}

export function saveCachedSetEntries(code: string, entries: CardEntry[]): void {
  try {
    const cached: CachedSet = { entries, fetchedAt: Date.now() };
    localStorage.setItem(SET_CACHE_PREFIX + code, JSON.stringify(cached));
  } catch {
    // Storage full or unavailable — this set just won't be cached.
  }
}

/** Remove set-cache entries left behind by an older SET_CACHE_VERSION. */
export function pruneStaleSetCaches(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("mtg-checklist:set-cache:") && !key.startsWith(SET_CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

export function loadCounts(): CountsStore {
  try {
    const raw = localStorage.getItem(COUNTS_KEY);
    return raw ? (JSON.parse(raw) as CountsStore) : {};
  } catch {
    return {};
  }
}

export function saveCounts(counts: CountsStore): void {
  try {
    localStorage.setItem(COUNTS_KEY, JSON.stringify(counts));
  } catch {
    // Storage full or unavailable — counts just won't persist this session.
  }
}

export function clearCounts(): void {
  try {
    localStorage.removeItem(COUNTS_KEY);
  } catch {
    // ignore
  }
}

export function loadSelectedSets(): string[] {
  try {
    const raw = localStorage.getItem(SELECTED_SETS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveSelectedSets(codes: string[]): void {
  try {
    localStorage.setItem(SELECTED_SETS_KEY, JSON.stringify(codes));
  } catch {
    // ignore
  }
}
