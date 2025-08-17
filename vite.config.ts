import path from "node:path";
import fs from "node:fs";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import zip from "vite-plugin-zip-pack";
import manifest from "./manifest.config.js";
import { name, version } from "./package.json";
import tailwindcss from "@tailwindcss/vite";

const copyTesseractFiles = (): Plugin => ({
  name: "copy-tesseract-files",
  generateBundle() {
    const tesseractDir = path.resolve(__dirname, "src/offscreen/tesseract");
    const files = [
      "tesseract.min.js",
      "worker.min.js",
      "tesseract-core.wasm.js",
      "eng.traineddata.gz",
    ];

    files.forEach((file) => {
      const filePath = path.join(tesseractDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath);
        this.emitFile({
          type: "asset",
          fileName: `offscreen/tesseract/${file}`,
          source: content,
        });
      }
    });
  },
});

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
    dedupe: ["react", "react-dom"],
  },
  plugins: [
    react(),
    tailwindcss(),
    copyTesseractFiles(),
    crx({ manifest }),
    zip({ outDir: "release", outFileName: `crx-${name}-${version}.zip` }),
  ],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.includes("tesseract")) {
            return "offscreen/tesseract/[name][extname]";
          }
          return "assets/[name].[hash][extname]";
        },
      },
    },
  },
  assetsInclude: ["**/*.wasm", "**/*.gz", "**/*.traineddata"],
  publicDir: false,
  server: {
    cors: { origin: [/chrome-extension:\/\//] },
  },
});
