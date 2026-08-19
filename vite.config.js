import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { local1688CollectorPlugin } from "./server/collect1688.js";

const STATE_FILE = ".preview-sync-state.json";

function countOccurrences(text, needle) {
  if (!needle) return 0;
  return text.split(needle).length - 1;
}

function loadState(root) {
  const statePath = path.join(root, STATE_FILE);
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return { revision: 0, applied: [] };
  }
}

function saveState(root, state) {
  fs.writeFileSync(path.join(root, STATE_FILE), JSON.stringify(state, null, 2), "utf8");
}

function livePreviewSync(syncUrl) {
  let busy = false;
  let timer;

  async function sync(root) {
    if (busy) return;
    busy = true;
    try {
      const state = loadState(root);
      const url = new URL(syncUrl);
      url.searchParams.set("_", Date.now());
      const response = await fetch(url, {
        headers: { "cache-control": "no-cache" },
      });
      if (!response.ok) throw new Error(`sync HTTP ${response.status}`);

      const payload = await response.json();
      if (!payload || !Array.isArray(payload.operations)) return;

      let changed = false;
      for (const op of payload.operations) {
        if (!op?.id || state.applied.includes(op.id)) continue;
        if (op.type !== "replace") {
          console.warn(`[DelightFilm Sync] unsupported operation: ${op.type}`);
          continue;
        }

        const target = path.resolve(root, op.path);
        if (!target.startsWith(path.resolve(root))) {
          console.error(`[DelightFilm Sync] blocked path: ${op.path}`);
          continue;
        }
        if (!fs.existsSync(target)) {
          console.error(`[DelightFilm Sync] missing file: ${op.path}`);
          continue;
        }

        const before = fs.readFileSync(target, "utf8");
        const expected = Number.isInteger(op.expectedCount) ? op.expectedCount : 1;
        const actual = countOccurrences(before, op.find);

        if (actual === 0 && before.includes(op.replace)) {
          state.applied.push(op.id);
          changed = true;
          continue;
        }

        if (actual !== expected) {
          console.error(`[DelightFilm Sync] patch ${op.id} skipped: expected ${expected}, found ${actual} in ${op.path}`);
          continue;
        }

        const after = before.replace(op.find, op.replace);
        fs.writeFileSync(target, after, "utf8");
        state.applied.push(op.id);
        changed = true;
        console.log(`[DelightFilm Sync] applied ${op.id} -> ${op.path}`);
      }

      if (payload.revision > (state.revision || 0)) {
        state.revision = payload.revision;
        changed = true;
      }
      if (changed) saveState(root, state);
    } catch (error) {
      console.warn(`[DelightFilm Sync] ${error.message}`);
    } finally {
      busy = false;
    }
  }

  return {
    name: "delightfilm-live-preview-sync",
    configureServer(server) {
      const root = server.config.root;
      sync(root);
      timer = setInterval(() => sync(root), 2000);
      server.httpServer?.once("close", () => clearInterval(timer));
      console.log("[DelightFilm Sync] connected — checking UI updates every 2 seconds");
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const plugins = [react()];

  if (command === "serve") {
    plugins.push(local1688CollectorPlugin());
    if (env.PREVIEW_SYNC_URL) plugins.push(livePreviewSync(env.PREVIEW_SYNC_URL));
  }

  return {
    plugins,
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
    },
  };
});
