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

/**
 * Save a CSV to the device. iOS Safari frequently ignores the `download`
 * attribute's suggested filename on blob: URLs and saves with a random name
 * instead — but it does honor the real filename when a File is shared
 * through the native Share Sheet, so prefer that path when it's available.
 */
export async function triggerDownload(filename: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const file = new File([blob], filename, { type: "text/csv" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return; // user cancelled
      // Otherwise fall through to the anchor-download path below.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
