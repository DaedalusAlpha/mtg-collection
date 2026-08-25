import type { ScryfallCard, ScryfallSet } from "./types";

const SETS_URL = "https://api.scryfall.com/sets";
const SEARCH_URL = "https://api.scryfall.com/cards/search";

// Scryfall's hard limit for /cards/search is 2 requests/second (500ms).
// See https://scryfall.com/docs/api/rate-limits.
const SEARCH_MIN_INTERVAL_MS = 500;
const DEFAULT_429_COOLDOWN_MS = 30_000; // Scryfall's stated 429 lockout window

let lastSearchRequestAt = 0;
let searchQueue: Promise<unknown> = Promise.resolve();

/**
 * Serializes every /cards/search request through one queue so concurrent
 * callers (e.g. tapping between tabs quickly) can't burst past the 500ms
 * hard limit between requests, and retries once after a 429 per Scryfall's
 * rule that rate-limit responses must not be ignored.
 */
function enqueueSearchRequest(url: string): Promise<Response> {
  const run = searchQueue.then(async () => {
    const wait = SEARCH_MIN_INTERVAL_MS - (Date.now() - lastSearchRequestAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastSearchRequestAt = Date.now();

    let res = await fetch(url);
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      const cooldownMs = retryAfter ? Number(retryAfter) * 1000 : DEFAULT_429_COOLDOWN_MS;
      await new Promise((resolve) => setTimeout(resolve, cooldownMs));
      lastSearchRequestAt = Date.now();
      res = await fetch(url);
    }
    return res;
  });

  // Keep the queue alive even if this request ultimately fails.
  searchQueue = run.catch(() => undefined);
  return run;
}

/** Fetch all paper (non-digital) sets, newest first. */
export async function fetchSets(): Promise<ScryfallSet[]> {
  const res = await fetch(SETS_URL);
  if (!res.ok) throw new Error(`Failed to fetch sets: ${res.status}`);
  const data = (await res.json()) as { data: ScryfallSet[] };
  return data.data
    .filter((s) => !s.digital)
    .sort((a, b) => (b.released_at ?? "").localeCompare(a.released_at ?? ""));
}

/**
 * Fetch every paper printing in a set, paginating through Scryfall's search
 * results. Mirrors collection_sync/scryfall.py's search_set(): same query
 * (`e:{code} in:paper`, unique=prints) so results match the desktop tool.
 */
export async function fetchSetCards(code: string): Promise<ScryfallCard[]> {
  const query = encodeURIComponent(`e:${code} in:paper`);
  let url: string | null = `${SEARCH_URL}?order=set&q=${query}&unique=prints`;
  const cards: ScryfallCard[] = [];

  while (url) {
    const res: Response = await enqueueSearchRequest(url);
    if (!res.ok) {
      if (res.status === 404) break; // set has no paper cards indexed yet
      throw new Error(`Failed to fetch cards for ${code}: ${res.status}`);
    }
    const data: { data: ScryfallCard[]; has_more: boolean; next_page?: string } =
      await res.json();
    cards.push(...data.data);
    url = data.has_more && data.next_page ? data.next_page : null;
  }

  return cards;
}
