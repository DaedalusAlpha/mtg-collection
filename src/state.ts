import { buildCardEntries, buildVariants } from "./cardModel";
import { fetchSetCards, fetchSets } from "./scryfall";
import {
  clearCounts,
  loadCachedSetEntries,
  loadCounts,
  loadSelectedSets,
  saveCachedSetEntries,
  saveCounts,
  saveSelectedSets,
} from "./storage";
import { COLOR_FILTER_KEYS } from "./types";
import type {
  CardEntry,
  ChecklistFilters,
  ColorCategory,
  CountsStore,
  FoilFilter,
  RowVariant,
  ScryfallSet,
} from "./types";

export type ViewName = "picker" | "checklist" | "export";

export interface SetCardData {
  entries: CardEntry[];
  variants: RowVariant[];
  status: "loading" | "loaded" | "error";
  error?: string;
}

function defaultColorFilters(): Record<ColorCategory, boolean> {
  const filters = {} as Record<ColorCategory, boolean>;
  for (const key of COLOR_FILTER_KEYS) filters[key] = true;
  return filters;
}

export class AppState {
  view: ViewName = "picker";

  allSets: ScryfallSet[] = [];
  setsStatus: "loading" | "loaded" | "error" = "loading";

  selectedSetCodes: string[] = loadSelectedSets();
  setCardData = new Map<string, SetCardData>();
  activeTabIndex = 0;

  counts: CountsStore = loadCounts();

  filters: ChecklistFilters = {
    foilFilter: "all",
    countedOnly: false,
    colorFilters: defaultColorFilters(),
  };

  expandedExportSets: Record<string, boolean> = {};
  exportDone = { deckbox: false, manabox: false };

  private renderFn: () => void = () => {};

  onRender(fn: () => void): void {
    this.renderFn = fn;
  }

  private update(): void {
    this.renderFn();
  }

  async init(): Promise<void> {
    try {
      this.allSets = await fetchSets();
      this.setsStatus = "loaded";
    } catch (err) {
      this.setsStatus = "error";
      console.error("Failed to load sets", err);
    }
    this.update();
  }

  // --- Set picker ---

  toggleSetSelection(code: string): void {
    const index = this.selectedSetCodes.indexOf(code);
    if (index === -1) this.selectedSetCodes.push(code);
    else this.selectedSetCodes.splice(index, 1);
    saveSelectedSets(this.selectedSetCodes);
    this.update();
  }

  goToChecklist(): void {
    if (this.selectedSetCodes.length === 0) return;
    this.view = "checklist";
    this.activeTabIndex = 0;
    this.update();
    void this.ensureSetLoaded(this.selectedSetCodes[0]);
  }

  goToPicker(): void {
    this.view = "picker";
    this.update();
  }

  goToExport(): void {
    this.view = "export";
    this.exportDone = { deckbox: false, manabox: false };
    this.update();
  }

  // --- Checklist ---

  setActiveTab(index: number): void {
    this.activeTabIndex = index;
    this.update();
    const code = this.selectedSetCodes[index];
    if (code) void this.ensureSetLoaded(code);
  }

  async ensureSetLoaded(code: string): Promise<void> {
    const existing = this.setCardData.get(code);
    if (existing && (existing.status === "loaded" || existing.status === "loading")) return;

    // Scryfall only refreshes prices once a day and asks API consumers to
    // cache for at least that long rather than refetch more often.
    const cached = loadCachedSetEntries(code);
    if (cached) {
      this.setCardData.set(code, { entries: cached, variants: buildVariants(cached), status: "loaded" });
      this.update();
      return;
    }

    this.setCardData.set(code, { entries: [], variants: [], status: "loading" });
    this.update();

    try {
      const cards = await fetchSetCards(code);
      const entries = buildCardEntries(cards);
      const variants = buildVariants(entries);
      this.setCardData.set(code, { entries, variants, status: "loaded" });
      saveCachedSetEntries(code, entries);
    } catch (err) {
      this.setCardData.set(code, {
        entries: [],
        variants: [],
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    this.update();
  }

  getCount(setCode: string, variantKey: string): number {
    return this.counts[setCode]?.[variantKey] ?? 0;
  }

  setCount(setCode: string, variantKey: string, value: number): void {
    const clamped = Math.max(0, value);
    if (!this.counts[setCode]) this.counts[setCode] = {};
    if (clamped === 0) delete this.counts[setCode][variantKey];
    else this.counts[setCode][variantKey] = clamped;
    saveCounts(this.counts);
    this.update();
  }

  hasAnyCounts(setCode: string): boolean {
    const setCounts = this.counts[setCode];
    if (!setCounts) return false;
    return Object.values(setCounts).some((qty) => qty > 0);
  }

  setFoilFilter(target: FoilFilter): void {
    if (target === "all") this.filters.foilFilter = "all";
    else this.filters.foilFilter = this.filters.foilFilter === target ? "all" : target;
    this.update();
  }

  toggleCountedOnly(): void {
    this.filters.countedOnly = !this.filters.countedOnly;
    this.update();
  }

  toggleColorFilter(key: ColorCategory): void {
    this.filters.colorFilters[key] = !this.filters.colorFilters[key];
    this.update();
  }

  totalAcrossAllSets(): { cards: number; value: number } {
    let cards = 0;
    let value = 0;
    for (const code of this.selectedSetCodes) {
      const data = this.setCardData.get(code);
      if (!data || data.status !== "loaded") continue;
      for (const variant of data.variants) {
        const qty = this.getCount(code, variant.key);
        if (qty > 0) {
          cards += qty;
          value += qty * (variant.price ?? 0);
        }
      }
    }
    return { cards, value };
  }

  // --- Export ---

  toggleExportExpanded(code: string): void {
    this.expandedExportSets[code] = !this.expandedExportSets[code];
    this.update();
  }

  markExportDone(format: "deckbox" | "manabox"): void {
    this.exportDone[format] = true;
    this.update();
  }

  resetForNewChecklist(): void {
    this.counts = {};
    clearCounts();
    this.selectedSetCodes = [];
    saveSelectedSets([]);
    this.expandedExportSets = {};
    this.exportDone = { deckbox: false, manabox: false };
    this.view = "picker";
    this.update();
  }
}
