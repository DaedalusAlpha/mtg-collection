import { describe, expect, it } from "vitest";
import { buildDeckboxCsv, buildManaboxCsv } from "./csv";
import type { ExportLine } from "./csv";

const elves: ExportLine = {
  setName: "Dominaria United",
  collectorNumber: "168",
  name: "Llanowar Elves",
  scryfallId: "a1b2c3d4-0000-0000-0000-000000000001",
  foil: false,
  qty: 3,
};

const atraxa: ExportLine = {
  setName: "Phyrexia: All Will Be One",
  collectorNumber: "196",
  name: "Atraxa, Grand Unifier",
  scryfallId: "a1b2c3d4-0000-0000-0000-000000000002",
  foil: true,
  qty: 1,
};

describe("buildDeckboxCsv", () => {
  it("writes the Deckbox header and one row per line", () => {
    expect(buildDeckboxCsv([elves, atraxa]).split("\n")).toEqual([
      "Count,Name,Edition,Card Number,Foil,Condition,Language",
      '3,"Llanowar Elves","Dominaria United",168,,Near Mint,English',
      '1,"Atraxa, Grand Unifier","Phyrexia: All Will Be One",196,Foil,Near Mint,English',
    ]);
  });

  it("escapes double quotes in names", () => {
    const line = { ...elves, name: 'Kongming, "Sleeping Dragon"' };
    expect(buildDeckboxCsv([line]).split("\n")[1]).toBe(
      '3,"Kongming, ""Sleeping Dragon""","Dominaria United",168,,Near Mint,English',
    );
  });

  it("writes just the header when there are no lines", () => {
    expect(buildDeckboxCsv([])).toBe("Count,Name,Edition,Card Number,Foil,Condition,Language");
  });
});

describe("buildManaboxCsv", () => {
  it("writes the ManaBox header and identifies cards by Scryfall ID", () => {
    expect(buildManaboxCsv([elves, atraxa]).split("\n")).toEqual([
      "Count,Condition,Language,Foil,Scryfall ID",
      "3,Near Mint,English,,a1b2c3d4-0000-0000-0000-000000000001",
      "1,Near Mint,English,Foil,a1b2c3d4-0000-0000-0000-000000000002",
    ]);
  });
});
