import { fileURLToPath, URL } from "node:url";

import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { writeLanguageFiles } from './scripts/static-data.mjs';

const workspace = fileURLToPath(new URL('.', import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/workerman/',
  define: {
    __RESOURCE_BASE_URL__: JSON.stringify(loadEnv(mode, workspace, 'VITE_').VITE_ASSET_BASE_URL || '/workerman/'),
  },
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
}));
