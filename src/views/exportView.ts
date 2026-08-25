import type { ExportLine } from "../csv";
import { buildDeckboxCsv, buildManaboxCsv, triggerDownload } from "../csv";
import { escapeHtml } from "../dom";
import { chevronDownSvg, chevronLeftSvg, checkFatSvg, downloadIconSvg, foilStarSvg } from "../icons";
import type { AppState } from "../state";

interface ExportLineItem {
  name: string;
  foil: boolean;
  qty: number;
  lineTotal: number;
}

interface SetSummary {
  code: string;
  name: string;
  iconUri: string;
  count: number;
  value: number;
  items: ExportLineItem[];
}

export function renderExport(root: HTMLElement, app: AppState): void {
  const perSet = app.selectedSetCodes.map((code) => buildSetSummary(app, code));
  const totalCards = perSet.reduce((sum, s) => sum + s.count, 0);
  const totalValue = perSet.reduce((sum, s) => sum + s.value, 0);

  if (totalCards === 0) {
    // Nothing logged yet — an empty export screen isn't useful, go back.
    app.goToChecklist();
    return;
  }

  root.innerHTML = `
    <div class="screen">
      <header class="header-row">
        <button class="icon-btn" id="back-btn" aria-label="Back to checklist">${chevronLeftSvg()}</button>
        <h1>Export</h1>
      </header>
      <p class="subtitle indent">Ready to send to your collection tools</p>

      <div class="scroll-body">
        <div class="set-summary-card">
          ${perSet.map((s) => setSummaryHtml(s, !!app.expandedExportSets[s.code])).join("")}
          <div class="total-row">
            <span>${totalCards} card${totalCards === 1 ? "" : "s"} total</span>
            <span class="total-value">$${totalValue.toFixed(2)}</span>
          </div>
        </div>

        <p class="footnote">Rows default to Near Mint / English — adjust condition after import.</p>

        <div class="export-actions">
          <button class="btn-export deckbox ${app.exportDone.deckbox ? "done" : ""}" id="deckbox-btn">
            ${app.exportDone.deckbox ? `${checkFatSvg()} Saved — Deckbox_Import.csv` : `${downloadIconSvg()} Download Deckbox CSV`}
          </button>
          <button class="btn-export manabox ${app.exportDone.manabox ? "done" : ""}" id="manabox-btn">
            ${app.exportDone.manabox ? `${checkFatSvg()} Saved — Manabox_Import.csv` : `${downloadIconSvg()} Download Manabox CSV`}
          </button>
        </div>

        <button class="btn-secondary" id="new-checklist-btn">Start New Checklist</button>
      </div>
    </div>
  `;

  root.querySelector("#back-btn")!.addEventListener("click", () => app.goToChecklist());

  root.querySelectorAll<HTMLElement>("[data-set-toggle]").forEach((el) => {
    el.addEventListener("click", () => app.toggleExportExpanded(el.dataset.setToggle!));
  });

  root.querySelector("#deckbox-btn")!.addEventListener("click", () => {
    triggerDownload(`Deckbox_Import_${dateStamp()}.csv`, buildDeckboxCsv(allExportLines(app)));
    app.markExportDone("deckbox");
  });

  root.querySelector("#manabox-btn")!.addEventListener("click", () => {
    triggerDownload(`Manabox_Import_${dateStamp()}.csv`, buildManaboxCsv(allExportLines(app)));
    app.markExportDone("manabox");
  });

  root.querySelector("#new-checklist-btn")!.addEventListener("click", () => {
    app.resetForNewChecklist();
  });
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function buildSetSummary(app: AppState, code: string): SetSummary {
  const data = app.setCardData.get(code);
  const setInfo = app.allSets.find((s) => s.code === code);
  const items: ExportLineItem[] = [];
  let count = 0;
  let value = 0;

  if (data && data.status === "loaded") {
    for (const variant of data.variants) {
      const qty = app.getCount(code, variant.key);
      if (qty <= 0) continue;
      const entry = data.entries[variant.cardIndex];
      const lineTotal = qty * (variant.price ?? 0);
      count += qty;
      value += lineTotal;
      items.push({ name: entry.name, foil: variant.foil, qty, lineTotal });
    }
  }

  return {
    code,
    name: setInfo?.name ?? code.toUpperCase(),
    iconUri: setInfo?.icon_svg_uri ?? "",
    count,
    value,
    items,
  };
}

function allExportLines(app: AppState): ExportLine[] {
  const lines: ExportLine[] = [];
  for (const code of app.selectedSetCodes) {
    const data = app.setCardData.get(code);
    if (!data || data.status !== "loaded") continue;
    for (const variant of data.variants) {
      const qty = app.getCount(code, variant.key);
      if (qty <= 0) continue;
      const entry = data.entries[variant.cardIndex];
      lines.push({
        setName: entry.setName,
        collectorNumber: entry.collectorNumber,
        name: entry.name,
        scryfallId: entry.scryfallId,
        foil: variant.foil,
        qty,
      });
    }
  }
  return lines;
}

function setSummaryHtml(s: SetSummary, expanded: boolean): string {
  return `
    <div class="export-set">
      <button type="button" class="export-set-header" data-set-toggle="${escapeHtml(s.code)}" aria-expanded="${expanded}">
        <div class="set-icon"><img src="${escapeHtml(s.iconUri)}" alt="" width="24" height="24"></div>
        <div class="export-set-info">
          <div class="set-name">${escapeHtml(s.name)}</div>
          <div class="set-meta">${s.count} card${s.count === 1 ? "" : "s"}</div>
        </div>
        <div class="export-set-value">$${s.value.toFixed(2)}</div>
        ${chevronDownSvg(expanded)}
      </button>
      ${expanded ? exportItemsHtml(s.items) : ""}
    </div>
  `;
}

function exportItemsHtml(items: ExportLineItem[]): string {
  return `
    <div class="export-items">
      ${items
        .map(
          (it) => `
        <div class="export-item">
          <span class="export-item-name">
            <span class="dim">${it.qty}×</span>
            ${escapeHtml(it.name)}
            ${it.foil ? foilStarSvg() : ""}
          </span>
          <span class="dim">$${it.lineTotal.toFixed(2)}</span>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}
