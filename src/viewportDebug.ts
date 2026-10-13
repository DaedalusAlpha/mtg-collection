// TEMPORARY: diagnostics for the iOS home-screen layout issue (header blur / footer off-screen).
// Shows what iOS reports for the viewport and safe areas. Only appears in the installed
// home-screen app; tap the panel to hide it. Remove this file and its import in main.ts
// once the layout is sorted out.

function readSafeAreas(): string {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.appendChild(probe);
  const s = getComputedStyle(probe);
  const result = `T${s.paddingTop} B${s.paddingBottom} L${s.paddingLeft} R${s.paddingRight}`;
  probe.remove();
  return result;
}

function measureDvh(): number {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;height:100dvh";
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return Math.round(h);
}

export function installViewportDebug(): void {
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    matchMedia("(display-mode: standalone)").matches;
  if (!standalone) return;

  const panel = document.createElement("pre");
  panel.style.cssText =
    "position:fixed;left:8px;right:8px;top:40%;z-index:9999;margin:0;padding:10px;" +
    "background:rgba(0,0,0,.85);color:#7f7;font:11px/1.4 ui-monospace,monospace;" +
    "border:1px solid #7f7;border-radius:8px;white-space:pre-wrap";
  panel.addEventListener("click", () => panel.remove());

  function update(): void {
    const screenEl = document.querySelector(".screen")?.getBoundingClientRect();
    const footer = document.querySelector(".sticky-footer")?.getBoundingClientRect();
    const h1 = document.querySelector("h1")?.getBoundingClientRect();
    const vv = window.visualViewport;
    panel.textContent = [
      "VIEWPORT DEBUG (tap to hide) — please screenshot",
      `screen        ${screen.width}x${screen.height}`,
      `inner         ${innerWidth}x${innerHeight}`,
      `docEl client  ${document.documentElement.clientHeight}`,
      `visualVP      h${vv ? Math.round(vv.height) : "?"} top${vv ? Math.round(vv.offsetTop) : "?"}`,
      `100dvh        ${measureDvh()}`,
      `safe areas    ${readSafeAreas()}`,
      `scrollY       ${scrollY}`,
      `.screen       top${screenEl ? Math.round(screenEl.top) : "?"} bottom${screenEl ? Math.round(screenEl.bottom) : "?"}`,
      `h1            top${h1 ? Math.round(h1.top) : "?"}`,
      `footer        top${footer ? Math.round(footer.top) : "?"} bottom${footer ? Math.round(footer.bottom) : "?"}`,
    ].join("\n");
  }

  document.body.appendChild(panel);
  update();
  // Values can settle a moment after launch, and change on rotation.
  setTimeout(update, 1000);
  addEventListener("resize", update);
}
