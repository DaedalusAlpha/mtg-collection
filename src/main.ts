import "./style.css";
import { AppState } from "./state";
import { renderChecklist } from "./views/checklist";
import { renderExport } from "./views/exportView";
import { renderSetPicker } from "./views/setPicker";

const rootEl = document.getElementById("app");
if (!rootEl) throw new Error("Missing #app root element");
const root: HTMLElement = rootEl;

const app = new AppState();

function render(): void {
  switch (app.view) {
    case "picker":
      renderSetPicker(root, app);
      break;
    case "checklist":
      renderChecklist(root, app);
      break;
    case "export":
      renderExport(root, app);
      break;
  }
}

app.onRender(render);
render();
void app.init();
