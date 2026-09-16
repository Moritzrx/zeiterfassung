// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
function sicherheitsrichtlinie(supabaseUrl) {
  const verbindungen = ["'self'"];
  if (supabaseUrl) verbindungen.push(supabaseUrl, supabaseUrl.replace(/^https:/, "wss:"));
  const richtlinie = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src ${verbindungen.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'"
  ].join("; ");
  return {
    name: "sicherheitsrichtlinie-gebaut",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: richtlinie },
          injectTo: "head-prepend"
        }
      ];
    }
  };
}
var electron_vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const supabaseUrl = env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      resolve: { alias: { "@shared": resolve("src/shared") } }
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      resolve: { alias: { "@shared": resolve("src/shared") } }
    },
    renderer: {
      resolve: {
        alias: {
          "@renderer": resolve("src/renderer/src"),
          "@shared": resolve("src/shared")
        }
      },
      plugins: [react(), tailwindcss(), sicherheitsrichtlinie(supabaseUrl)]
    }
  };
});
export {
  electron_vite_config_default as default
};
