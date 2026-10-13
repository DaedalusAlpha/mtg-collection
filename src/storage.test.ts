// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCounts,
  loadCachedSetEntries,
  loadCounts,
  loadSelectedSets,
  loadSetTypeFilter,
  pruneStaleSetCaches,
  saveCachedSetEntries,
  saveCounts,
  saveSelectedSets,
  saveSetTypeFilter,
} from "./storage";
import type { CardEntry } from "./types";

const sampleEntry: CardEntry = {
  scryfallId: "id",
  name: "Llanowar Elves",
  setName: "Dominaria United",
  collectorNumber: "168",
  rarity: "C",
  manaCost: "{G}",
  color: "G",
  nonfoilPrice: 0.25,
  foilPrice: 1.5,
  foilAvailable: true,
  imageUrl: "elves.jpg",
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe("counts", () => {
  it("round-trips counts and starts empty", () => {
    expect(loadCounts()).toEqual({});
    saveCounts({ dmu: { "0-n": 3, "0-f": 1 } });
    expect(loadCounts()).toEqual({ dmu: { "0-n": 3, "0-f": 1 } });
  });

  it("clears counts", () => {
    saveCounts({ dmu: { "0-n": 3 } });
    clearCounts();
    expect(loadCounts()).toEqual({});
  });

  it("returns empty instead of throwing on corrupt data", () => {
    localStorage.setItem("mtg-checklist:counts:v1", "{not json");
    expect(loadCounts()).toEqual({});
  });
});

describe("selected sets and set-type filter", () => {
  it("round-trips both lists", () => {
    expect(loadSelectedSets()).toEqual([]);
    expect(loadSetTypeFilter()).toEqual([]);
    saveSelectedSets(["dmu", "one"]);
    saveSetTypeFilter(["expansion", "commander"]);
    expect(loadSelectedSets()).toEqual(["dmu", "one"]);
    expect(loadSetTypeFilter()).toEqual(["expansion", "commander"]);
  });
});

describe("set card cache", () => {
  it("returns cached entries within 24 hours and drops them after", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    saveCachedSetEntries("dmu", [sampleEntry]);

    vi.setSystemTime(new Date("2026-10-14T11:59:00Z"));
    expect(loadCachedSetEntries("dmu")).toEqual([sampleEntry]);

    vi.setSystemTime(new Date("2026-10-14T12:01:00Z"));
    expect(loadCachedSetEntries("dmu")).toBeNull();
  });

  it("returns null for a set that was never cached", () => {
    expect(loadCachedSetEntries("dmu")).toBeNull();
  });

  it("prunes caches from older versions but keeps current ones and other data", () => {
    saveCachedSetEntries("dmu", [sampleEntry]);
    localStorage.setItem("mtg-checklist:set-cache:v1:dmu", "old");
    saveCounts({ dmu: { "0-n": 1 } });

    pruneStaleSetCaches();

    expect(localStorage.getItem("mtg-checklist:set-cache:v1:dmu")).toBeNull();
    expect(loadCachedSetEntries("dmu")).toEqual([sampleEntry]);
    expect(loadCounts()).toEqual({ dmu: { "0-n": 1 } });
  });
});
