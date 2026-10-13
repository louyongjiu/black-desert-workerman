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
  // Vite preview inherits server.proxy. Production uses the Vercel rewrite.
  server: {
    proxy: {
      '^/api/bdolytics/market(?:\\?|$)': {
        target: 'https://bdolytics.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/bdolytics\/market/, '/api/trpc/market.getMarket'),
      },
    },
  },
  build: {
    //minify: false,
    emptyOutDir: false,
  },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['highs'] },
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
