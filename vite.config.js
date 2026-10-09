import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { writeLanguageFiles } from './scripts/static-data.mjs';

const workspace = fileURLToPath(new URL('.', import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  base: '/workerman/',
  build: {
    //minify: false,
    emptyOutDir: false,
  },
  plugins: [
    vue(),
    {
      name: 'workerman-language-files',
      async configureServer() {
        await writeLanguageFiles(workspace);
      },
    },
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
