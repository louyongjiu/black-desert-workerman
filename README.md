# Black Desert Workerman

黑色沙漠工人与节点规划工具，用于管理工人任务、估算采集点和工作坊收益，并查看节点连接与贡献点成本。

项目使用 Vue 3、Pinia、Vite、deck.gl、ECharts 和 WebAssembly。地图底图、图标、游戏静态数据及 WASM 均随仓库提供，市场价格通过外部接口获取。

## 功能

- 管理工人属性、技能及任务分配。
- 根据工人属性、产出、距离、资源设置和价格估算收益，比较采集点与工人方案。
- 查看地图节点、连接路径、地区和资源分组，计算贡献点成本。
- 配置工作坊、住宿和仓库，并查看相关成本与收益。
- 查看掉落率和鱼类尺寸统计。
- 在浏览器中保存设置，支持通过页面导入、导出配置。

## 本地运行

推荐使用 Node.js 22 和 npm，这是当前验证所用的环境。

```sh
git clone https://github.com/louyongjiu/black-desert-workerman.git
cd black-desert-workerman
npm ci
npm run dev
```

打开终端显示的 `/workerman/` 地址，通常为 `http://localhost:5173/workerman/`。开发模式支持源码修改后的自动更新；端口被占用时，以终端输出为准。

首次使用时，先在 **Settings** 中选择服务器、语言和税率，再查看工人及采集点收益。

## 构建与预览

```sh
npm run build
npm run preview
```

构建输出到 `dist/`。预览地址通常为 `http://localhost:4173/workerman/`，具体地址以终端输出为准。

如需指定端口：

```sh
npm run preview -- --host 127.0.0.1 --port 5191
```

构建脚本会生成语言片段、编译前端、清理过期资源，并将运行所需的资源发布到 `dist/data/<内容哈希>/`。JSON 在发布时去除空白，游戏数据合并为基础包和规划包；地图瓦片、图标及说明图片使用稳定的目录内容哈希。历史观测文件和完整语言源文件保留在源码仓库。

发布时使用完整的 `dist/` 目录。当前访问前缀在 `vite.config.js` 中设为 `/workerman/`；页面路由使用 History 模式，托管服务需将应用路径下未匹配的页面请求回退到入口 `index.html`，同时保留静态资源的正常访问。

仓库包含 `vercel.json`，指定构建命令、输出目录、`/workerman/` 的静态资源映射和页面回退。带内容哈希的资源使用一年浏览器缓存；资源内容变化后 URL 自动更新。Vercel 按浏览器支持自动提供 Gzip 或 Brotli 压缩。

Settings 中的 **Map data saver (lower image detail)** 可降低地图图片精度，减少放大地图时的下载量。默认保留完整精度。

如果已有独立静态资源 CDN，可设置构建环境变量 `VITE_ASSET_BASE_URL`，例如 `https://assets.example.com/workerman/`，并将完整的 `dist/data/` 同步到该地址下的 `data/` 目录。CDN 需要允许网页域名的 CORS 请求，并保留 JSON、GeoJSON 和图片的正确 Content-Type。JavaScript、CSS 和 WASM 继续通过 Vercel 加载。

分包范围、缓存更新方式和本地测量见 [静态资源优化说明](docs/static-resources.md)。

## 目录说明

| 目录或文件 | 内容 |
|---|---|
| `src/` | Vue 页面、组件、状态管理及计算逻辑 |
| `src/pkg/` | WASM 路由模块与 JavaScript 接口 |
| `data/` | 游戏静态数据、观测数据与图片资源 |
| `data/maptiles/` | 本地地图瓦片，文件格式为 `{z}/{x}_{y}.webp` |
| `data/icons/` | 物品、节点、技能及其他图标 |
| `data/images/` | 页面说明图片与示意图 |
| `data/loc.json` | 完整语言数据，修改语言文本时编辑此文件 |
| `data/loc/` | 开发和构建时生成的单语言 JSON 文件 |
| `public/` | favicon 等公共资源 |
| `scripts/` | 构建及语言文件生成脚本 |
| `tests/` | 计算逻辑和性能相关回归测试 |
| `docs/performance.md` | 性能改动、测量条件与验证记录 |
| `dist/` | 构建结果，不纳入版本控制 |

地图瓦片、图标、语言文件及 WASM 已纳入版本控制。正常克隆仓库后，无需从其他本机目录复制图片。

## 数据与联网

图片、地图瓦片、前端脚本、样式、游戏静态数据和 WASM 从本地服务加载。

市场价格仍使用两个外部接口：

- BDOlytics：获取所选服务器的市场价格。
- Arsha：在主接口缺少部分物品价格时补价。

启动时先读取浏览器中的价格缓存；如果启动时缓存超过一小时，会请求更新。切换服务器或点击 **reload** 也会重新请求价格。

获取最新市场价格需要网络连接。页面中的资料、物品详情和视频链接会在点击后打开外部网站。

## 测试与性能

```sh
npm test
```

测试覆盖收益相关计算、距离索引、候选路径缓存失效、并行加载及状态保存等逻辑。

性能改动包括静态数据与 WASM 并行加载、路由和弹窗按需加载、路径与收益计算分离缓存，以及地图退出时取消请求并释放资源。测量环境和结果见 [性能报告](docs/performance.md)。

`npm run lint` 可运行 ESLint，并自动修复可处理的问题。

## 上游项目

- 前端基于 [shrddr/workermanjs](https://github.com/shrddr/workermanjs)。
- WASM 节点路由使用 [Thell/bdo-noderouter v0.4.0](https://github.com/Thell/bdo-noderouter/releases/tag/v0.4.0) 官方发布包，版本来源及校验值见 [src/pkg/README.md](src/pkg/README.md)。
