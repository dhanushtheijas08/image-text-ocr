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
  permissions: [
    "tabs",
    "activeTab",
    "scripting",
    "tabCapture",
    "downloads",
    "offscreen",
  ],

  background: {
    service_worker: "src/background.ts",
  },
  host_permissions: ["<all_urls>", "http://*/*", "https://*/*"],
  web_accessible_resources: [
    {
      resources: [
        "src/offscreen/tesseract/worker.min.js",
        "src/offscreen/tesseract/tesseract-core.wasm.js",
        "src/offscreen/tesseract/tesseract.min.js",
        "src/offscreen/tesseract/eng.traineddata.gz",
        "src/offscreen/tesseract/*",
      ],
      matches: ["<all_urls>"],
    },
  ],
});
