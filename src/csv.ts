export interface ExportLine {
  setName: string;
  collectorNumber: string;
  name: string;
  scryfallId: string;
  foil: boolean;
  qty: number;
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Deckbox import CSV — same columns as checklist.py's exportCSV('deckbox'). */
export function buildDeckboxCsv(lines: ExportLine[]): string {
  const header = "Count,Name,Edition,Card Number,Foil,Condition,Language";
  const rows = lines.map((l) =>
    [
      l.qty,
      csvEscape(l.name),
      csvEscape(l.setName),
      l.collectorNumber,
      l.foil ? "Foil" : "",
      "Near Mint",
      "English",
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

/** Manabox import CSV — same columns as checklist.py's exportCSV('manabox'). */
export function buildManaboxCsv(lines: ExportLine[]): string {
  const header = "Count,Condition,Language,Foil,Scryfall ID";
  const rows = lines.map((l) =>
    [l.qty, "Near Mint", "English", l.foil ? "Foil" : "", l.scryfallId].join(","),
  );
  return [header, ...rows].join("\n");
}

export function triggerDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
