# bdo-noderouter

本目录使用 [Thell/bdo-noderouter v0.4.0](https://github.com/Thell/bdo-noderouter/releases/tag/v0.4.0) 的官方 WASM 发布包，更新日期为 2026-10-09。

- 上游提交：`5b140dd1d6f8cd033ad4e20491388a3b1d19f941`。
- 下载文件：[pkg.zip](https://github.com/Thell/bdo-noderouter/releases/download/v0.4.0/pkg.zip)。
- `noderouter.js`、`noderouter_bg.wasm`、类型声明、`package.json` 和 `LICENSE` 均保留官方文件内容。
- 许可证：Unlicense，见 [LICENSE](LICENSE)。

## SHA-256

| 文件 | 校验值 |
|---|---|
| 官方 `pkg.zip` | `5d95ce97fb2e07aafb9361aaf8696efa65b03980b851810de7b270b5d509bc28` |
| `noderouter.js` | `7cdd8d6ece3d2b53d54360237aa547da4f9340d9493ca25cd75b819b88518422` |
| `noderouter_bg.wasm` | `5c328d3e8882d1888ac0b1952c8063a3e5cf3e211007280338c049f1a4748151` |

## 后续更新

从上游 Releases 下载正式版，核对下载包的 SHA-256，同时替换 JS、WASM、类型声明及包元信息，并更新此文件和项目 README 中的版本记录。保持 JS 与 WASM 来自同一个发布包。

执行 `node --test tests/noderouter.test.mjs` 检查实际 WASM 的共享路径、贡献点成本、超级根节点、前沿搜索参数及游戏节点图；再运行 `npm test` 和 `npm run build` 验证项目。
