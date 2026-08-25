import type {
  CardEntry,
  ColorCategory,
  ManaSymbol,
  RowVariant,
  ScryfallCard,
} from "./types";

export const COLOR_STYLE: Record<ColorCategory, string> = {
  W: "#f9faf4",
  U: "#1a5276",
  B: "#1c1c1c",
  R: "#922b21",
  G: "#1e6e3e",
  M: "#b7950b",
  C: "#6c6c6c",
  L: "#6c3483",
};

export const COLOR_FG: Record<ColorCategory, string> = {
  W: "#333",
  U: "#fff",
  B: "#fff",
  R: "#fff",
  G: "#fff",
  M: "#000",
  C: "#000",
  L: "#fff",
};

const COLOR_ORDER: Record<ColorCategory, number> = {
  W: 1,
  U: 2,
  B: 3,
  R: 4,
  G: 5,
  M: 6,
  C: 7,
  L: 8,
};

const RARITY_MAP: Record<string, string> = {
  common: "C",
  uncommon: "U",
  rare: "R",
  mythic: "M",
  special: "S",
  bonus: "B",
};

const ARTICLES = ["a ", "an ", "the "];

/** Strip leading articles for alphabetical sorting, matching _sortable_name. */
function sortableName(name: string): string {
  const lower = name.toLowerCase();
  for (const article of ARTICLES) {
    if (lower.startsWith(article)) return name.slice(article.length);
  }
  return name;
}

/** Derive MTG color category from a Scryfall card object (_get_color_category). */
function getColorCategory(card: ScryfallCard): ColorCategory {
  const face = card.card_faces?.[0];
  const typeLine = face?.type_line ?? card.type_line ?? "";
  if (typeLine.includes("Land")) return "L";

  const colors = face?.colors ?? card.colors ?? [];
  if (colors.length === 1) return colors[0] as ColorCategory;
  if (colors.length > 1) return "M";
  return "C";
}

/** Mana cost string, using the front face for double-faced cards. */
function getManaCostString(card: ScryfallCard): string {
  return card.card_faces?.[0]?.mana_cost || card.mana_cost || "";
}

/**
 * Parse a Scryfall mana cost string (e.g. "{2}{W}{W}") into pip badges.
 * Hybrid/Phyrexian symbols ("{W/U}", "{W/P}") get a neutral pip showing the
 * raw token rather than a true split-color render — good enough to scan at
 * a glance without drawing two-tone circles.
 */
export function parseManaCost(cost: string): ManaSymbol[] {
  const tokens = cost.match(/\{([^}]+)\}/g) ?? [];
  return tokens.map((raw) => {
    const token = raw.slice(1, -1);
    if (/^\d+$/.test(token) || token === "X" || token === "Y" || token === "Z") {
      return { label: token, bg: "#3a3f5c", fg: "#eee" };
    }
    if (token.length === 1 && token in COLOR_STYLE) {
      const key = token as ColorCategory;
      return { label: token, bg: COLOR_STYLE[key], fg: COLOR_FG[key] };
    }
    return { label: token.replace("/P", "Φ"), bg: "#3a3f5c", fg: "#eee" };
  });
}

function toPrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convert raw Scryfall card objects into sorted CardEntry rows, matching
 * _build_rows' sort: color category order, then alphabetical (articles
 * stripped).
 */
export function buildCardEntries(cards: ScryfallCard[]): CardEntry[] {
  const entries: CardEntry[] = cards.map((card) => ({
    scryfallId: card.id,
    name: card.name,
    setName: card.set_name,
    collectorNumber: card.collector_number,
    rarity: RARITY_MAP[card.rarity] ?? "",
    manaCost: getManaCostString(card),
    color: getColorCategory(card),
    nonfoilPrice: toPrice(card.prices?.usd),
    foilPrice: toPrice(card.prices?.usd_foil),
    foilAvailable: card.foil === true,
  }));

  entries.sort((a, b) => {
    const ca = COLOR_ORDER[a.color] ?? 99;
    const cb = COLOR_ORDER[b.color] ?? 99;
    if (ca !== cb) return ca - cb;
    return sortableName(a.name)
      .toLowerCase()
      .localeCompare(sortableName(b.name).toLowerCase());
  });

  return entries;
}

/**
 * Expand card entries into up to two rows each (nonfoil + foil), matching
 * _build_rows: a row per priced finish, or a single unpriced fallback row
 * when neither price is available.
 */
export function buildVariants(entries: CardEntry[]): RowVariant[] {
  const variants: RowVariant[] = [];
  entries.forEach((entry, cardIndex) => {
    let emitted = false;
    if (entry.nonfoilPrice != null) {
      variants.push({ key: `${cardIndex}-n`, cardIndex, foil: false, price: entry.nonfoilPrice });
      emitted = true;
    }
    if (entry.foilPrice != null) {
      variants.push({ key: `${cardIndex}-f`, cardIndex, foil: true, price: entry.foilPrice });
      emitted = true;
    }
    if (!emitted) {
      variants.push({
        key: `${cardIndex}-n`,
        cardIndex,
        foil: entry.foilAvailable,
        price: null,
      });
    }
  });
  return variants;
}

export function priceTier(value: number | null): { bg: string; fg: string } {
  if (value == null) return { bg: "transparent", fg: "#8890a6" };
  if (value >= 15) return { bg: "#7a5e00", fg: "#ffd966" };
  if (value >= 1) return { bg: "#1e5631", fg: "#b7e1cd" };
  return { bg: "transparent", fg: "#8890a6" };
}

export function rarityStyle(rarity: string): { bg: string; fg: string } {
  if (rarity === "R" || rarity === "M") return { bg: "#8b4000", fg: "#ffc966" };
  return { bg: "transparent", fg: "#9aa0b4" };
}
