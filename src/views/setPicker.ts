import { escapeHtml } from "../dom";
import { checkIconSvg, searchIconSvg } from "../icons";
import type { AppState } from "../state";
import { loadSetTypeFilter, saveSetTypeFilter } from "../storage";
import type { ScryfallSet } from "../types";

let searchQuery = "";
let listScrollTop = 0;
// Empty means no type filter — every set type is shown.
const selectedSetTypes = new Set<string>(loadSetTypeFilter());
// Set types that always show as chips, in this order; the rest sit behind "More".
const PINNED_SET_TYPES = ["expansion", "commander", "core"];
// Start expanded if a saved selection includes a type hidden behind "More".
let moreTypesExpanded = [...selectedSetTypes].some((t) => !PINNED_SET_TYPES.includes(t));

export function renderSetPicker(root: HTMLElement, app: AppState): void {
  const hasProgress = app.selectedSetCodes.length > 0 || app.hasAnyLoggedCounts();

  root.innerHTML = `
    <div class="screen">
      <header class="header">
        <div class="header-title-row">
          <h1>New Checklist</h1>
          ${hasProgress ? `<button type="button" class="reset-link" id="reset-btn">Reset</button>` : ""}
        </div>
        <p class="subtitle">Pick the sets you want to log cards for</p>
        <div class="search-box">
          ${searchIconSvg()}
          <input type="text" id="set-search" placeholder="Search sets..." value="${escapeHtml(searchQuery)}">
        </div>
      </header>

      ${app.setsStatus === "loaded" ? setTypeChipsHtml(app.allSets) : ""}

      <div class="list" id="set-list"></div>

      <footer class="sticky-footer">
        <span class="muted" id="selected-label"></span>
        <button class="btn-primary" id="build-btn">Build Checklists</button>
      </footer>
    </div>
  `;

  const listEl = root.querySelector<HTMLDivElement>("#set-list")!;
  const footerLabel = root.querySelector<HTMLSpanElement>("#selected-label")!;
  const buildBtn = root.querySelector<HTMLButtonElement>("#build-btn")!;
  const searchInput = root.querySelector<HTMLInputElement>("#set-search")!;

  function renderList(): void {
    if (app.setsStatus === "loading") {
      listEl.innerHTML = `<p class="status-msg">Loading sets…</p>`;
      return;
    }
    if (app.setsStatus === "error") {
      listEl.innerHTML = `<p class="status-msg error">Couldn't load the set list. Check your connection and reload.</p>`;
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const filtered = app.allSets.filter(
      (s) =>
        (selectedSetTypes.size === 0 || selectedSetTypes.has(s.set_type)) &&
        (!query || s.code.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)),
    );

    if (filtered.length === 0) {
      const msg = query
        ? `No sets match "${escapeHtml(searchQuery)}"${selectedSetTypes.size ? " in the selected set types" : ""}.`
        : "No sets of the selected types.";
      listEl.innerHTML = `<p class="status-msg">${msg}</p>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((s) => setRowHtml(s, app.selectedSetCodes.includes(s.code)))
      .join("");
    listEl.scrollTop = listScrollTop;
  }

  function renderFooter(): void {
    const n = app.selectedSetCodes.length;
    footerLabel.textContent = n === 0 ? "No sets selected" : `${n} set${n > 1 ? "s" : ""} selected`;
    buildBtn.classList.toggle("disabled", n === 0);
    buildBtn.disabled = n === 0;
  }

  renderList();
  renderFooter();

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    renderList();
  });

  const typeChipsEl = root.querySelector<HTMLDivElement>("#set-type-chips");
  if (typeChipsEl) {
    typeChipsEl.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("#more-types-btn")) {
        moreTypesExpanded = !moreTypesExpanded;
        typeChipsEl.innerHTML = setTypeChipsInnerHtml(app.allSets);
        return;
      }

      const chip = target.closest<HTMLElement>("[data-set-type]");
      if (!chip) return;
      const type = chip.dataset.setType!;
      if (type === "") selectedSetTypes.clear();
      else if (selectedSetTypes.has(type)) selectedSetTypes.delete(type);
      else selectedSetTypes.add(type);
      saveSetTypeFilter([...selectedSetTypes]);

      typeChipsEl.innerHTML = setTypeChipsInnerHtml(app.allSets);
      listScrollTop = 0;
      renderList();
    });
  }

  listEl.addEventListener("scroll", () => {
    listScrollTop = listEl.scrollTop;
  });

  listEl.addEventListener("click", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-code]");
    if (row) app.toggleSetSelection(row.dataset.code!);
  });

  buildBtn.addEventListener("click", () => app.goToChecklist());

  root.querySelector("#reset-btn")?.addEventListener("click", () => {
    const logged = app.totalLoggedCount();
    if (logged > 0) {
      const ok = window.confirm(
        `This clears ${logged} logged card${logged === 1 ? "" : "s"} and your selected sets. Continue?`,
      );
      if (!ok) return;
    }
    app.resetForNewChecklist();
  });
}

/** Wrapping chip row for filtering by set_type. */
function setTypeChipsHtml(sets: ScryfallSet[]): string {
  return `
    <div class="chip-row chip-row-wrap" id="set-type-chips">
      ${setTypeChipsInnerHtml(sets)}
    </div>
  `;
}

/** "All types", the pinned types, then a "More" toggle revealing the rest (most common first). */
function setTypeChipsInnerHtml(sets: ScryfallSet[]): string {
  const counts = new Map<string, number>();
  for (const s of sets) counts.set(s.set_type, (counts.get(s.set_type) ?? 0) + 1);
  const pinned = PINNED_SET_TYPES.filter((t) => counts.has(t));
  const others = [...counts.keys()]
    .filter((t) => !PINNED_SET_TYPES.includes(t))
    .sort((a, b) => counts.get(b)! - counts.get(a)!);

  const chip = (type: string, label: string, active: boolean) =>
    `<button type="button" class="chip ${active ? "active" : ""}" data-set-type="${escapeHtml(type)}" aria-pressed="${active}">${escapeHtml(label)}</button>`;

  // When collapsed, show how many hidden types are selected so the filter isn't invisible.
  const hiddenSelected = others.filter((t) => selectedSetTypes.has(t)).length;
  const moreLabel = moreTypesExpanded
    ? "Less"
    : hiddenSelected > 0
      ? `More (${hiddenSelected})`
      : "More…";
  const moreBtn = others.length
    ? `<button type="button" class="chip chip-more ${!moreTypesExpanded && hiddenSelected ? "has-selection" : ""}" id="more-types-btn" aria-expanded="${moreTypesExpanded}">${moreLabel}</button>`
    : "";

  return `
    ${chip("", "All types", selectedSetTypes.size === 0)}
    ${pinned.map((t) => chip(t, setTypeLabel(t), selectedSetTypes.has(t))).join("")}
    ${moreTypesExpanded ? others.map((t) => chip(t, setTypeLabel(t), selectedSetTypes.has(t))).join("") : ""}
    ${moreBtn}
  `;
}

/** "duel_deck" -> "Duel deck" */
function setTypeLabel(type: string): string {
  const words = type.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function setRowHtml(s: ScryfallSet, selected: boolean): string {
  return `
    <button type="button" class="set-row ${selected ? "selected" : ""}" data-code="${escapeHtml(s.code)}" aria-pressed="${selected}">
      <div class="set-icon"><img src="${escapeHtml(s.icon_svg_uri)}" alt="" loading="lazy" width="24" height="24"></div>
      <div class="set-info">
        <div class="set-name">${escapeHtml(s.name)}</div>
        <div class="set-meta">${escapeHtml(s.code.toUpperCase())} · ${s.card_count} cards</div>
      </div>
      ${selected ? `<div class="set-check">${checkIconSvg()}</div>` : `<div class="set-check-empty"></div>`}
    </button>
  `;
}
