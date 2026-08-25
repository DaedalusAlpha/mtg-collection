export type ColorCategory = "W" | "U" | "B" | "R" | "G" | "M" | "C" | "L";

export const COLOR_FILTER_KEYS: ColorCategory[] = ["W", "U", "B", "R", "G", "M", "C", "L"];

export interface ScryfallSet {
  code: string;
  name: string;
  card_count: number;
  released_at?: string;
  digital: boolean;
  set_type: string;
  icon_svg_uri: string;
}

export interface ScryfallCardFace {
  mana_cost?: string;
  colors?: string[];
  type_line?: string;
}

export interface ScryfallCard {
  id: string;
  name: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  mana_cost?: string;
  colors?: string[];
  type_line?: string;
  foil: boolean;
  card_faces?: ScryfallCardFace[];
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
  };
}

export interface ManaSymbol {
  label: string;
  bg: string;
  fg: string;
}

export interface CardEntry {
  scryfallId: string;
  name: string;
  setName: string;
  collectorNumber: string;
  rarity: string;
  manaCost: string;
  color: ColorCategory;
  nonfoilPrice: number | null;
  foilPrice: number | null;
  foilAvailable: boolean;
}

export interface RowVariant {
  key: string;
  cardIndex: number;
  foil: boolean;
  price: number | null;
}

export type FoilFilter = "all" | "foil" | "nonfoil";

export interface ChecklistFilters {
  foilFilter: FoilFilter;
  countedOnly: boolean;
  colorFilters: Record<ColorCategory, boolean>;
}

/** setCode -> variantKey -> quantity */
export type CountsStore = Record<string, Record<string, number>>;
