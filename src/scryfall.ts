import type { ScryfallCard, ScryfallSet } from "./types";

const SETS_URL = "https://api.scryfall.com/sets";
const SEARCH_URL = "https://api.scryfall.com/cards/search";

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
    const res: Response = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) break; // set has no paper cards indexed yet
      throw new Error(`Failed to fetch cards for ${code}: ${res.status}`);
    }
    const data: { data: ScryfallCard[]; has_more: boolean; next_page?: string } =
      await res.json();
    cards.push(...data.data);
    url = data.has_more && data.next_page ? data.next_page : null;
    if (url) {
      // Be polite to Scryfall's API between pages of the same request.
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return cards;
}
