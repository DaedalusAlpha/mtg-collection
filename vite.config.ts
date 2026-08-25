import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the built app works from any subpath — including a
  // GitHub Pages project site (https://<user>.github.io/<repo>/) — without
  // needing to hardcode the repo name here.
  base: "./",
});
