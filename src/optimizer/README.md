# 浏览器帝国优化器

联合选择采集点、工人城镇、连接节点和住房，使用 `highs@1.15.3` 的 HiGHS 1.15.1 WASM，在独立 Web Worker 中求解。

住房规划同时融合 [bdo-housecraft 0.3.18](https://github.com/Thell/bdo-housecraft/tree/3af0b47113c4709afab148ae2d3fa83748e08ac6) 的房屋依赖和用途互斥模型。存在手动保留或工作工坊占用的城镇按房屋建模，其他城镇继续使用原有预计算表；共享前置房屋只计一次成本。详细规则见 `src/housing/README.md`。

模型和九技能候选搜索改写自 [Thell/bdo-empire v0.8.2](https://github.com/Thell/bdo-empire/tree/v0.8.2)，上游提交为 `955eddc50ecb89d06fe409a9c3136522ee4c637c`；其项目许可证声明为 [Unlicense](https://github.com/Thell/bdo-empire/blob/v0.8.2/pyproject.toml)。HiGHS JavaScript 包采用 MIT 许可证，随 npm 包保留其许可证。

发布目录包含完整的 HiGHS 与 highs-js 许可证，源文件位于 `public/licenses/highs.txt`，访问路径为 `/workerman/licenses/highs.txt`。

本实现使用当前 Workerman 游戏数据和有效价格，共享前端的静态/浮动资源周期计算；增加指定仓库的物品种类、额外槽位和住房联合成本约束。保留已有 Ancado 激活连接。上游经验性最低采集点数量约束未迁移，候选范围也由页面明确选择。

`model.mjs` 输出 CSR 稀疏矩阵；`result.mjs` 独立复核变量、所有线性约束、连接、住宿与仓储容量以及预算。清理结果时仅在求解器已选择的节点内取有效路径，避免引入预算外的连接。

初版生成 40 级平均属性工人的建设方案。尚不优化实际已有工人的属性、工作坊、围栏或贸易任务；直接应用只允许采集/空闲工人的帝国。应用保留精确路径和可撤销备份，任务或基础设施改变后回到常规路由；价格变化保留路径，重新计算首页收益并提示优化预览来自旧快照。

WASM 和 Worker 仅在开始优化时加载。停止操作销毁 Worker，保留已经验证并传回页面的最佳可行解。新任务忽略旧 Worker 的迟到消息。

求解前先构造包含连接流、住房和仓储容量的初始可行解，逐项校验后传给 HiGHS 继续改进。大范围模型可以较早显示该方案，无需等到完整搜索结束。

验证命令：

```sh
node --test tests/optimizer.test.mjs
npm test
npm run build
```

测试包含小图的独立穷举对照、固定节点、共同线路成本、住房与仓库联合容量、非法求解结果、浮动资源周期、缺价、实际游戏收益和贡献点复算、Ancado 连接、保存路径失效和 Worker 停止。
