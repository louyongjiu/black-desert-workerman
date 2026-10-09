# workermanjs

当前目录 `D:\Work\repository\black-desert-workerman` 已包含性能优化代码。

主要改动：静态数据与 WASM 并行加载、语言与页面按需加载、候选路径缓存、距离索引、地图退出时释放资源，以及合并用户状态保存。详细验证见 [性能报告](docs/performance.md)。

源码位于 `src/`，原始数据位于 `data/`，构建输出位于 `dist/`。开发和构建时自动生成语言片段；构建同时复制运行所需的数据与图标，预览地址路径为 `/workerman/`。

地图背景使用本地 `data/maptiles/{z}/{x}_{y}.webp` 瓦片，构建时复制到 `dist/data/maptiles/`。当前瓦片来自本机 `D:\Work\repository\black-desert-worker\maptiles`，已复制到本项目。地图瓦片、图标、语言文件、WASM 和项目脚本均不再被 `.gitignore` 排除，可随源码一同提交。

使用 Node.js 22。

"wasm router" = https://github.com/Thell/bdo-noderouter

## Project Setup

```sh
npm ci
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### 验证与预览

```sh
npm test
npm run preview -- --host 127.0.0.1 --port 5191
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
