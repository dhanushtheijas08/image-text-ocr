import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: "public/logo.png",
  },
  action: {
    default_icon: {
      48: "public/logo.png",
    },
    default_popup: "src/popup/index.html",
  },
  content_scripts: [
    {
      js: ["src/content/main.tsx"],
      matches: ["https://*/*"],
      run_at: "document_idle",
    },
  ],
  permissions: ["tabs", "activeTab", "scripting", "tabCapture", "downloads"],
  background: {
    service_worker: "src/background.ts",
  },
  host_permissions: ["<all_urls>", "http://*/*", "https://*/*"],
  web_accessible_resources: [
    {
      resources: [
        "worker.min.js",
        "tesseract-core.wasm.js",
        "eng.traineddata.gz",
      ],
      matches: ["<all_urls>"],
    },
  ],
});
