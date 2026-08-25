import type { CountsStore } from "./types";

const COUNTS_KEY = "mtg-checklist:counts:v1";
const SELECTED_SETS_KEY = "mtg-checklist:selected-sets:v1";

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
