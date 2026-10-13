import { describe, expect, it } from "vitest";
import { buildCardEntries, buildVariants, parseManaCost } from "./cardModel";
import type { CardEntry, ScryfallCard } from "./types";

function card(overrides: Partial<ScryfallCard>): ScryfallCard {
  return {
    id: "id",
    name: "Card",
    set_name: "Test Set",
    collector_number: "1",
    rarity: "common",
    type_line: "Creature",
    colors: [],
    foil: true,
    prices: { usd: "0.10", usd_foil: "0.50" },
    ...overrides,
  };
}

function entry(overrides: Partial<CardEntry>): CardEntry {
  return {
    scryfallId: "id",
    name: "Card",
    setName: "Test Set",
    collectorNumber: "1",
    rarity: "C",
    manaCost: "",
    color: "C",
    nonfoilPrice: null,
    foilPrice: null,
    foilAvailable: false,
    imageUrl: null,
    ...overrides,
  };
}

describe("parseManaCost", () => {
  it("splits a cost into pips with labels", () => {
    expect(parseManaCost("{2}{W}{W}").map((m) => m.label)).toEqual(["2", "W", "W"]);
  });

  it("gives colored pips their color and generic pips the neutral style", () => {
    const [generic, red] = parseManaCost("{X}{R}");
    expect(generic).toEqual({ label: "X", bg: "#3a3f5c", fg: "#eee" });
    expect(red.bg).toBe("#922b21");
  });

  it("shows hybrid symbols raw and Phyrexian mana with Φ", () => {
    expect(parseManaCost("{W/U}{G/P}").map((m) => m.label)).toEqual(["W/U", "GΦ"]);
  });

  it("returns no pips for an empty cost", () => {
    expect(parseManaCost("")).toEqual([]);
  });
});

describe("buildCardEntries", () => {
  it("categorizes color: lands, mono, multicolor, colorless", () => {
    const entries = buildCardEntries([
      card({ name: "Forest", type_line: "Basic Land — Forest", colors: [] }),
      card({ name: "Shock", colors: ["R"] }),
      card({ name: "Electrolyze", colors: ["U", "R"] }),
      card({ name: "Sol Ring", colors: [] }),
      // A land with a color identity is still a land.
      card({ name: "Dryad Arbor", type_line: "Land Creature — Forest Dryad", colors: ["G"] }),
    ]);
    const colorOf = (name: string) => entries.find((e) => e.name === name)!.color;
    expect(colorOf("Forest")).toBe("L");
    expect(colorOf("Shock")).toBe("R");
    expect(colorOf("Electrolyze")).toBe("M");
    expect(colorOf("Sol Ring")).toBe("C");
    expect(colorOf("Dryad Arbor")).toBe("L");
  });

  it("uses the front face of double-faced cards", () => {
    const [e] = buildCardEntries([
      card({
        name: "Delver of Secrets // Insectile Aberration",
        card_faces: [
          {
            mana_cost: "{U}",
            colors: ["U"],
            type_line: "Creature — Human Wizard",
            image_uris: { large: "front.jpg" } as ScryfallCard["image_uris"],
          },
          { mana_cost: "", colors: ["U"], type_line: "Creature — Human Insect" },
        ],
      }),
    ]);
    expect(e.color).toBe("U");
    expect(e.manaCost).toBe("{U}");
    expect(e.imageUrl).toBe("front.jpg");
  });

  it("sorts by color order (WUBRG, multi, colorless, land) then name, ignoring articles", () => {
    const names = buildCardEntries([
      card({ name: "Island", type_line: "Basic Land — Island" }),
      card({ name: "Sol Ring" }),
      card({ name: "Lightning Helix", colors: ["R", "W"] }),
      card({ name: "Shock", colors: ["R"] }),
      card({ name: "The Wanderer", colors: ["W"] }),
      card({ name: "Serra Angel", colors: ["W"] }),
      card({ name: "An Offer You Can't Refuse", colors: ["U"] }),
    ]).map((e) => e.name);
    expect(names).toEqual([
      "Serra Angel",
      "The Wanderer", // sorted as "Wanderer"
      "An Offer You Can't Refuse",
      "Shock",
      "Lightning Helix",
      "Sol Ring",
      "Island",
    ]);
  });

  it("maps rarity to a letter and parses prices, treating missing ones as null", () => {
    const [e] = buildCardEntries([
      card({ rarity: "mythic", prices: { usd: "12.34", usd_foil: null } }),
    ]);
    expect(e.rarity).toBe("M");
    expect(e.nonfoilPrice).toBe(12.34);
    expect(e.foilPrice).toBeNull();
  });
});

describe("buildVariants", () => {
  it("emits a non-foil and a foil row when both are priced", () => {
    expect(buildVariants([entry({ nonfoilPrice: 1, foilPrice: 3 })])).toEqual([
      { key: "0-n", cardIndex: 0, foil: false, price: 1 },
      { key: "0-f", cardIndex: 0, foil: true, price: 3 },
    ]);
  });

  it("emits only the finishes that have a price", () => {
    expect(buildVariants([entry({ foilPrice: 3 })])).toEqual([
      { key: "0-f", cardIndex: 0, foil: true, price: 3 },
    ]);
  });

  it("falls back to one unpriced row when neither finish is priced", () => {
    expect(buildVariants([entry({ foilAvailable: true })])).toEqual([
      { key: "0-n", cardIndex: 0, foil: true, price: null },
    ]);
  });

  it("keys rows by card position so counts stay attached to the right card", () => {
    const keys = buildVariants([
      entry({ nonfoilPrice: 1 }),
      entry({ nonfoilPrice: 1, foilPrice: 2 }),
    ]).map((v) => v.key);
    expect(keys).toEqual(["0-n", "1-n", "1-f"]);
  });
});
