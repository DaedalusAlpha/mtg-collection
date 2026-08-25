import { escapeHtml } from "../dom";
import { checkIconSvg, searchIconSvg } from "../icons";
import type { AppState } from "../state";
import type { ScryfallSet } from "../types";

let searchQuery = "";
let listScrollTop = 0;

export function renderSetPicker(root: HTMLElement, app: AppState): void {
  root.innerHTML = `
    <div class="screen">
      <header class="header">
        <h1>New Checklist</h1>
        <p class="subtitle">Pick the sets you want to log cards for</p>
        <div class="search-box">
          ${searchIconSvg()}
          <input type="text" id="set-search" placeholder="Search sets..." value="${escapeHtml(searchQuery)}">
        </div>
      </header>

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
    const filtered = query
      ? app.allSets.filter(
          (s) => s.code.toLowerCase().includes(query) || s.name.toLowerCase().includes(query),
        )
      : app.allSets;

    if (filtered.length === 0) {
      listEl.innerHTML = `<p class="status-msg">No sets match "${escapeHtml(searchQuery)}".</p>`;
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

  listEl.addEventListener("scroll", () => {
    listScrollTop = listEl.scrollTop;
  });

  listEl.addEventListener("click", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-code]");
    if (row) app.toggleSetSelection(row.dataset.code!);
  });

  buildBtn.addEventListener("click", () => app.goToChecklist());
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
