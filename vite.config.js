import { defineConfig } from "vite";

// Phaser doesn't hot-reload cleanly: partial HMR leaves a stale, duplicated game
// instance (dead loop, uninitialised input) that looks "broken". Force a full
// page reload on every source change instead — clean restart, every time.
const fullReloadOnChange = {
  name: "full-reload-on-change",
  handleHotUpdate({ server }) {
    server.ws.send({ type: "full-reload" });
    return [];
  },
};

export default defineConfig({
  plugins: [fullReloadOnChange],
  server: {
    host: true, // expose on LAN so you can open it on your phone
    port: 5173,
  },
  build: {
    target: "es2019",
    chunkSizeWarningLimit: 1500,
  },
});
