import { COLOR_FG, COLOR_STYLE, parseManaCost, priceTier, rarityStyle } from "../cardModel";
import { escapeHtml } from "../dom";
import { caretDownSvg, chevronLeftSvg, foilStarSvg } from "../icons";
import type { AppState } from "../state";
import { COLOR_FILTER_KEYS } from "../types";
import type { CardEntry, ColorCategory, FoilFilter, RowVariant } from "../types";

let listScrollTop = 0;
let lastActiveTab = -1;
let focusedIndex = 0;
let setMenuOpen = false;
// Kept across re-renders so the preview stays up while ←/→ change the previewed card's count.
let previewOpen = false;
let activeKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

export function renderChecklist(root: HTMLElement, app: AppState): void {
  if (activeKeydownHandler) {
    window.removeEventListener("keydown", activeKeydownHandler);
    activeKeydownHandler = null;
  }

  const codes = app.selectedSetCodes;
  if (codes.length === 0) {
    app.goToPicker();
    return;
  }

  if (app.activeTabIndex !== lastActiveTab) {
    listScrollTop = 0;
    focusedIndex = 0;
    lastActiveTab = app.activeTabIndex;
    previewOpen = false;
  }

  const activeCode = codes[app.activeTabIndex];
  const data = app.setCardData.get(activeCode);
  const totals = app.totalAcrossAllSets();

  root.innerHTML = `
    <div class="screen">
      <header class="header-row">
        <button class="icon-btn" id="back-btn" aria-label="Back to set picker">${chevronLeftSvg()}</button>
        <h1>Checklists</h1>
      </header>

      ${setSwitcherHtml(app)}

      <div class="chip-row scroll-x">
        ${foilChipHtml("all", "All", app.filters.foilFilter)}
        ${foilChipHtml("foil", "Foils only", app.filters.foilFilter)}
        ${foilChipHtml("nonfoil", "Non-foils only", app.filters.foilFilter)}
        <button class="chip ${app.filters.countedOnly ? "active" : ""}" id="counted-chip">With counts</button>
      </div>

      <div class="chip-row scroll-x">
        ${COLOR_FILTER_KEYS.map((k) => colorPipHtml(k, app.filters.colorFilters[k])).join("")}
        ${
          COLOR_FILTER_KEYS.some((k) => app.filters.colorFilters[k])
            ? `<button type="button" class="chip" id="color-all-btn" data-on="false">Clear</button>`
            : `<button type="button" class="chip" id="color-all-btn" data-on="true">All</button>`
        }
      </div>

      <div class="row-toolbar">
        <div class="kbd-hint-bar">
          <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> Move</span>
          <span><kbd>&larr;</kbd><kbd>&rarr;</kbd> Count</span>
          <span><kbd>0&ndash;9</kbd> Set count</span>
          <span><kbd>Enter</kbd> Image</span>
          <span><kbd>[</kbd><kbd>]</kbd> Switch set</span>
        </div>
        <div class="visible-label" id="visible-label"></div>
      </div>

      <div class="row-list" id="row-list"></div>

      <footer class="sticky-footer">
        <div>
          <div class="total-cards">${totals.cards} card${totals.cards === 1 ? "" : "s"} counted</div>
          <div class="muted total-value">$${totals.value.toFixed(2)} across all sets</div>
        </div>
        <button class="btn-primary ${totals.cards === 0 ? "disabled" : ""}" id="export-btn">Review &amp; Export</button>
      </footer>

      <div class="image-modal" id="image-modal" hidden>
        <button class="image-modal-backdrop" id="image-modal-close" aria-label="Close"></button>
        <figure class="image-modal-figure">
          <img class="image-modal-img" id="image-modal-img" alt="">
          <figcaption class="image-modal-caption" id="image-modal-caption"></figcaption>
          <div class="stepper preview-stepper" id="preview-stepper">
            <button type="button" class="step-btn" data-preview-step="-1" aria-label="Decrease count">−</button>
            <div class="step-count" id="preview-step-count">0</div>
            <button type="button" class="step-btn" data-preview-step="1" aria-label="Increase count">+</button>
          </div>
        </figure>
      </div>
    </div>
  `;

  const rowListEl = root.querySelector<HTMLDivElement>("#row-list")!;
  const visibleLabelEl = root.querySelector<HTMLDivElement>("#visible-label")!;

  let currentVisible: RowVariant[] = [];

  function passesFilters(v: RowVariant, entry: CardEntry): boolean {
    const f = app.filters;
    if (f.foilFilter === "foil" && !v.foil) return false;
    if (f.foilFilter === "nonfoil" && v.foil) return false;
    if (f.countedOnly && app.getCount(activeCode, v.key) === 0) return false;
    if (!f.colorFilters[entry.color]) return false;
    return true;
  }

  function applyFocusVisual(): void {
    Array.from(rowListEl.children).forEach((child, i) => {
      child.classList.toggle("row-focused", i === focusedIndex);
    });
  }

  function moveFocus(newIndex: number): void {
    if (currentVisible.length === 0) return;
    focusedIndex = Math.min(Math.max(newIndex, 0), currentVisible.length - 1);
    applyFocusVisual();
    (rowListEl.children[focusedIndex] as HTMLElement | undefined)?.scrollIntoView({
      block: "nearest",
    });
  }

  function renderRows(): void {
    if (!data || data.status === "loading") {
      rowListEl.innerHTML = `<p class="status-msg">Loading ${escapeHtml(activeCode.toUpperCase())}…</p>`;
      visibleLabelEl.textContent = "";
      currentVisible = [];
      return;
    }
    if (data.status === "error") {
      rowListEl.innerHTML = `<p class="status-msg error">Couldn't load this set.${data.error ? ` ${escapeHtml(data.error)}` : ""}</p>`;
      visibleLabelEl.textContent = "";
      currentVisible = [];
      return;
    }

    const allRows = data.variants;
    currentVisible = allRows.filter((v) => passesFilters(v, data.entries[v.cardIndex]));
    visibleLabelEl.textContent = `${currentVisible.length} / ${allRows.length} rows`;
    rowListEl.innerHTML = currentVisible.length
      ? currentVisible.map((v) => rowHtml(v, data.entries[v.cardIndex])).join("")
      : `<p class="status-msg">No cards match the current filters.</p>`;
    rowListEl.scrollTop = listScrollTop;
    if (focusedIndex >= currentVisible.length) focusedIndex = Math.max(0, currentVisible.length - 1);
    applyFocusVisual();
  }

  function rowHtml(v: RowVariant, entry: CardEntry): string {
    const count = app.getCount(activeCode, v.key);
    const rs = rarityStyle(entry.rarity);
    const ps = priceTier(v.price);
    const priceLabel = v.price == null ? "—" : `$${v.price.toFixed(2)}`;
    const pips = parseManaCost(entry.manaCost)
      .map(
        (m) =>
          `<span class="mana-pip" style="background:${m.bg};color:${m.fg}">${escapeHtml(m.label)}</span>`,
      )
      .join("");

    const imageAttrs = entry.imageUrl
      ? ` data-image="${escapeHtml(entry.imageUrl)}" data-name="${escapeHtml(entry.name)}"${v.foil ? " data-foil" : ""}`
      : "";

    return `
      <div class="row">
        <div class="row-tap-area${entry.imageUrl ? " has-image" : ""}"${imageAttrs}>
          <div class="row-stripe" style="background:${COLOR_STYLE[entry.color]}"></div>
          <div class="row-main">
            <div class="row-name">${escapeHtml(entry.name)}</div>
            <div class="row-meta">
              <span class="mana-row">${pips}</span>
              <span class="dim">· #${escapeHtml(entry.collectorNumber)}</span>
              <span class="rarity-badge" style="background:${rs.bg};color:${rs.fg}">${escapeHtml(entry.rarity)}</span>
              ${v.foil ? `<span class="foil-tag">${foilStarSvg()}Foil</span>` : ""}
            </div>
          </div>
        </div>
        <div class="price-badge" style="background:${ps.bg};color:${ps.fg}">${priceLabel}</div>
        <div class="stepper">
          <button class="step-btn" data-step="-1" data-key="${escapeHtml(v.key)}" aria-label="Decrease count">−</button>
          <div class="step-count ${count > 0 ? "active" : ""}">${count}</div>
          <button class="step-btn" data-step="1" data-key="${escapeHtml(v.key)}" aria-label="Increase count">+</button>
        </div>
      </div>
    `;
  }

  renderRows();

  rowListEl.addEventListener("scroll", () => {
    listScrollTop = rowListEl.scrollTop;
  });

  root.querySelector("#back-btn")!.addEventListener("click", () => app.goToPicker());

  root.querySelector("#export-btn")!.addEventListener("click", () => {
    if (totals.cards > 0) app.goToExport();
  });

  const switcherEl = root.querySelector<HTMLDivElement>("#set-switcher")!;

  function setSwitcherOpen(open: boolean): void {
    setMenuOpen = open;
    switcherEl.classList.toggle("open", open);
    switcherEl.querySelector("#set-switcher-btn")?.setAttribute("aria-expanded", String(open));
  }

  switcherEl.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const option = target.closest<HTMLElement>("[data-tab-index]");
    if (option) {
      setMenuOpen = false;
      app.setActiveTab(Number(option.dataset.tabIndex));
      return;
    }
    if (target.closest("#set-switcher-btn") && codes.length > 1) setSwitcherOpen(!setMenuOpen);
  });

  // Close the menu on any click outside it. The .screen element is rebuilt each render,
  // so this listener goes away with it.
  root.querySelector(".screen")!.addEventListener("click", (event) => {
    if (setMenuOpen && !switcherEl.contains(event.target as Node)) setSwitcherOpen(false);
  });

  root.querySelectorAll<HTMLElement>("[data-foil-filter]").forEach((btn) => {
    btn.addEventListener("click", () => app.setFoilFilter(btn.dataset.foilFilter as FoilFilter));
  });

  root.querySelector("#counted-chip")!.addEventListener("click", () => app.toggleCountedOnly());

  root.querySelectorAll<HTMLElement>("[data-color-key]").forEach((btn) => {
    btn.addEventListener("click", () =>
      app.toggleColorFilter(btn.dataset.colorKey as ColorCategory),
    );
  });

  root.querySelector<HTMLElement>("#color-all-btn")!.addEventListener("click", (event) => {
    app.setAllColorFilters((event.currentTarget as HTMLElement).dataset.on === "true");
  });

  const modalEl = root.querySelector<HTMLDivElement>("#image-modal")!;
  const modalImg = root.querySelector<HTMLImageElement>("#image-modal-img")!;
  const modalCaption = root.querySelector<HTMLElement>("#image-modal-caption")!;
  const modalStepCount = root.querySelector<HTMLElement>("#preview-step-count")!;

  /** Show the focused row's image, or close the preview if that card has none. */
  function previewFocusedRow(): void {
    const row = currentVisible[focusedIndex];
    const entry = row && data?.entries[row.cardIndex];
    if (!row || !entry?.imageUrl) {
      closePreview();
      return;
    }
    const count = app.getCount(activeCode, row.key);
    if (modalImg.getAttribute("src") !== entry.imageUrl) modalImg.src = entry.imageUrl;
    modalImg.alt = row.foil ? `${entry.name} (foil)` : entry.name;
    // Foil and non-foil share an image, so the caption is the only way to tell them apart.
    modalCaption.innerHTML = `
      ${escapeHtml(entry.name)}
      ${row.foil ? `<span class="foil-tag">${foilStarSvg()}Foil</span>` : ""}
      <span class="preview-count ${count > 0 ? "active" : ""}">&times;${count}</span>
    `;
    modalStepCount.textContent = String(count);
    modalStepCount.classList.toggle("active", count > 0);
    modalEl.hidden = false;
    previewOpen = true;
  }

  function closePreview(): void {
    modalEl.hidden = true;
    modalImg.src = "";
    previewOpen = false;
  }

  // A count change re-renders the whole screen; reopen the preview so ←/→ can adjust it in place.
  if (previewOpen) previewFocusedRow();

  modalEl.addEventListener("click", (event) => {
    // The −/+ stepper (touch screens only) adjusts the count; any other tap closes the preview.
    const stepBtn = (event.target as HTMLElement).closest<HTMLElement>("[data-preview-step]");
    if (stepBtn) adjustFocusedCount(Number(stepBtn.dataset.previewStep));
    else if (!(event.target as HTMLElement).closest("#preview-stepper")) closePreview();
  });
  root.querySelector("#image-modal-close")!.addEventListener("click", closePreview);

  rowListEl.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const rowEl = target.closest<HTMLElement>(".row");
    if (rowEl) {
      const clickedIndex = Array.from(rowListEl.children).indexOf(rowEl);
      if (clickedIndex !== -1) {
        focusedIndex = clickedIndex;
        applyFocusVisual();
      }
    }

    const stepBtn = target.closest<HTMLButtonElement>("[data-step]");
    if (stepBtn) {
      const key = stepBtn.dataset.key!;
      const delta = Number(stepBtn.dataset.step);
      app.setCount(activeCode, key, app.getCount(activeCode, key) + delta);
      return;
    }

    // The tapped row was just focused above, so preview the focused row.
    if (target.closest(".row-tap-area[data-image]")) previewFocusedRow();
  });

  function adjustFocusedCount(delta: number): void {
    const row = currentVisible[focusedIndex];
    if (!row) return;
    app.setCount(activeCode, row.key, app.getCount(activeCode, row.key) + delta);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (app.view !== "checklist") return; // stale listener from a screen we've since left
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveFocus(focusedIndex + 1);
        if (previewOpen) previewFocusedRow();
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(focusedIndex - 1);
        if (previewOpen) previewFocusedRow();
        break;
      case "ArrowRight":
        event.preventDefault();
        adjustFocusedCount(1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        adjustFocusedCount(-1);
        break;
      case "Enter": {
        // Enter toggles the preview: a second press closes it.
        if (previewOpen) {
          event.preventDefault();
          closePreview();
          break;
        }
        const row = currentVisible[focusedIndex];
        if (!row) break;
        if (data?.entries[row.cardIndex]?.imageUrl) {
          event.preventDefault();
          previewFocusedRow();
        }
        break;
      }
      case "Escape":
        if (previewOpen) {
          event.preventDefault();
          closePreview();
        } else if (setMenuOpen) {
          event.preventDefault();
          setSwitcherOpen(false);
        }
        break;
      case "[":
        if (app.activeTabIndex > 0) {
          event.preventDefault();
          app.setActiveTab(app.activeTabIndex - 1);
        }
        break;
      case "]":
        if (app.activeTabIndex < codes.length - 1) {
          event.preventDefault();
          app.setActiveTab(app.activeTabIndex + 1);
        }
        break;
      default:
        if (/^[0-9]$/.test(event.key)) {
          const row = currentVisible[focusedIndex];
          if (row) {
            event.preventDefault();
            app.setCount(activeCode, row.key, Number(event.key));
          }
        }
    }
  }

  activeKeydownHandler = handleKeydown;
  window.addEventListener("keydown", activeKeydownHandler);
}

/** Dropdown for switching between the selected sets; trigger and options look like set-picker rows. */
function setSwitcherHtml(app: AppState): string {
  const codes = app.selectedSetCodes;
  const multiple = codes.length > 1;
  const activeCode = codes[app.activeTabIndex];

  const options = codes
    .map(
      (code, i) => `
        <button type="button" class="set-row set-switcher-option ${i === app.activeTabIndex ? "selected" : ""}" data-tab-index="${i}" role="option" aria-selected="${i === app.activeTabIndex}">
          ${setSummaryHtml(app, code)}
          ${app.hasAnyCounts(code) ? '<span class="dot" title="Has counts"></span>' : ""}
        </button>
      `,
    )
    .join("");

  return `
    <div class="set-switcher ${setMenuOpen && multiple ? "open" : ""}" id="set-switcher">
      <button type="button" class="set-row set-switcher-btn" id="set-switcher-btn" ${multiple ? `aria-haspopup="listbox" aria-expanded="${setMenuOpen}"` : "disabled"}>
        ${setSummaryHtml(app, activeCode)}
        ${multiple ? `<span class="set-switcher-count">${app.activeTabIndex + 1}/${codes.length}</span><span class="set-switcher-caret">${caretDownSvg()}</span>` : ""}
      </button>
      ${multiple ? `<div class="set-switcher-menu" role="listbox">${options}</div>` : ""}
    </div>
  `;
}

/** Set icon, name and "CODE · N cards", falling back to just the code if the set list hasn't loaded. */
function setSummaryHtml(app: AppState, code: string): string {
  const set = app.allSets.find((s) => s.code === code);
  const icon = set ? `<img src="${escapeHtml(set.icon_svg_uri)}" alt="" width="24" height="24">` : "";
  return `
    <div class="set-icon">${icon}</div>
    <div class="set-info">
      <div class="set-name">${escapeHtml(set?.name ?? code.toUpperCase())}</div>
      <div class="set-meta">${escapeHtml(code.toUpperCase())}${set ? ` · ${set.card_count} cards` : ""}</div>
    </div>
  `;
}

function foilChipHtml(value: FoilFilter, label: string, current: FoilFilter): string {
  return `<button class="chip ${current === value ? "active" : ""}" data-foil-filter="${value}">${label}</button>`;
}

function colorPipHtml(key: ColorCategory, active: boolean): string {
  const bg = COLOR_STYLE[key];
  const fg = COLOR_FG[key];
  return `<button class="pip" data-color-key="${key}" style="background:${bg};color:${fg};opacity:${active ? 1 : 0.4};border-color:${active ? "#eee" : "transparent"}">${key}</button>`;
}
