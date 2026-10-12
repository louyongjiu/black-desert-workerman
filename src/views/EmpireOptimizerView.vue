<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { useGameStore } from "../stores/game";
import { useUserStore } from "../stores/user";
import { useMarketStore } from "../stores/market";
import { useOptimizerStore } from "../stores/optimizer";
import { useUiI18n } from "../i18n/vue";

const { locale } = useUiI18n();
import {
  canReplaceGatheringWorkers,
  configurationSignature,
  valuationSignature,
} from "../optimizer/snapshot.mjs";

const game = useGameStore(),
  user = useUserStore(),
  market = useMarketStore(),
  optimizer = useOptimizerStore();
const budget = ref(300),
  timeLimit = ref(30),
  maxPlantzones = ref(370),
  storageTown = ref(601);
const townIds = ref([...game.townsWithLodging]),
  includeGrind = ref(true),
  consent = ref(false),
  actionError = ref("");
const now = ref(Date.now());
const timer = setInterval(() => {
  now.value = Date.now();
}, 500);
onBeforeUnmount(() => {
  clearInterval(timer);
  optimizer.stop();
});
const result = computed(() => optimizer.result || user.optimizerPlan);
const elapsed = computed(() =>
  optimizer.running
    ? (now.value - optimizer.startedAt) / 1000
    : result.value?.elapsed || 0
);
const stages = {
  loading: "加载优化器",
  values: "计算采集收益",
  model: "准备连接与住房约束",
  solve: "寻找更好的方案",
  complete: "计算完成",
  stopped: "已停止",
  error: "计算未完成",
};
const applied = computed(
  () =>
    user.optimizerPlan &&
    result.value?.createdAt === user.optimizerPlan.createdAt &&
    user.optimizerPlan.appliedSignature === configurationSignature(user)
);
const stale = computed(
  () =>
    result.value &&
    !applied.value &&
    result.value.sourceSignature !== configurationSignature(user)
);
const valueStale = computed(
  () =>
    result.value &&
    result.value.valueSignature !== valuationSignature(user, market)
);
const canApply = computed(
  () =>
    result.value &&
    result.value.workers.length > 0 &&
    !optimizer.running &&
    !stale.value &&
    !valueStale.value &&
    !applied.value &&
    canReplaceGatheringWorkers(user)
);
const display = (value, digits = 2) =>
  Number.isFinite(value)
    ? value.toLocaleString(locale.value, { maximumFractionDigits: digits })
    : "—";
const gap = computed(() =>
  optimizer.running
    ? optimizer.progress.gap ?? optimizer.result?.gap
    : result.value?.gap
);
const nodeName = (key) => game.nodeName(key) || String(key);
const statusLabel = computed(
  () =>
    ({
      optimal: "达到候选模型的求解精度",
      time_limit: "达到时间上限，保留当前方案",
      stopped: "已停止，保留当前方案",
      feasible: "已找到可行方案",
    }[result.value?.status] || "")
);
const mapPreview = computed(() => {
  if (!result.value?.selectedNodeIds.length) return null;
  const points = Object.fromEntries(
    result.value.selectedNodeIds.map((id) => {
      const pos = game.nodes[id]?.pos || {};
      return [id, [pos.x || 0, -(pos.z ?? pos.y ?? 0)]];
    })
  );
  const values = Object.values(points),
    xs = values.map((p) => p[0]),
    ys = values.map((p) => p[1]);
  const xmin = Math.min(...xs),
    ymin = Math.min(...ys),
    width = Math.max(1000, Math.max(...xs) - xmin),
    height = Math.max(1000, Math.max(...ys) - ymin);
  const normalized = Object.fromEntries(
    Object.entries(points).map(([id, p]) => [
      id,
      [((p[0] - xmin) / width) * 940 + 30, ((p[1] - ymin) / height) * 390 + 30],
    ])
  );
  const edges = new Map();
  for (const path of [
    ...result.value.assignments.map((a) => a.path),
    ...result.value.grindRoutes.map((a) => a.path),
  ]) {
    for (let i = 1; i < path.length; i++)
      edges.set([path[i - 1], path[i]].sort((a, b) => a - b).join(":"), [
        path[i - 1],
        path[i],
      ]);
  }
  return {
    points: normalized,
    edges: [...edges.values()],
    towns: new Set(result.value.assignments.map((a) => a.town)),
  };
});
function start() {
  consent.value = false;
  actionError.value = "";
  optimizer.start({
    budget: budget.value,
    timeLimit: timeLimit.value,
    maxPlantzones: maxPlantzones.value,
    townIds: townIds.value,
    storageTown: storageTown.value,
    includeGrind: includeGrind.value,
  });
}
function apply() {
  try {
    optimizer.apply();
    consent.value = false;
    actionError.value = "";
  } catch (error) {
    actionError.value = error.message;
  }
}
async function reloadPrices() {
  try {
    actionError.value = "";
    await market.fetchData();
  } catch (error) {
    actionError.value = `价格更新失败：${error.message}`;
  }
}
function download(value, filename) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportPlan() {
  const out = JSON.parse(JSON.stringify(user.$state));
  delete out.optimizerUndo;
  delete out.housingUndo;
  out.userWorkers = result.value.workers;
  out.farmingEnable = false;
  out.tradeDestinations = {};
  out.tradeRouteAlwaysOn = {};
  out.tradeInfraCp = {};
  out.tradeRouteCp = {};
  out.grindTakenList = result.value.lockedNodeIds;
  out.activateAncado =
    result.value.assignments.some((a) => a.town === 1343) ||
    result.value.storageTown === 1343 ||
    out.activateAncado;
  out.optimizerPlan = JSON.parse(JSON.stringify(result.value));
  // Fixed workshop uses must survive the gathering-only export.
  out.houseReservations = Object.fromEntries(
    Object.entries(result.value.houseReservations || {}).map(([key, lock]) => [
      key,
      { usage: lock.usage },
    ])
  );
  out.optimizerPlan.appliedSignature = configurationSignature(out);
  download(out, "optimized_empire.json");
}
</script>

<template>
  <main class="optimizer">
    <div class="intro">
      <div>
        <h1>{{ $t("帝国优化") }}</h1>
        <p>
          {{
            $t(
              "给定贡献点预算，规划采集点、工人城镇、连接和住房。计算在当前浏览器完成。"
            )
          }}
        </p>
      </div>
      <button
        v-if="user.optimizerUndo"
        @click="
          optimizer.undo();
          consent = false;
        "
      >
        {{ $t("撤销上次应用") }}
      </button>
    </div>
    <p class="notice">
      {{
        $t(
          "建设方案使用 40 级平均属性工人和建议技能。收益采用当前价格与资源设置，尚不分配你已有的实际工人。"
        )
      }}
    </p>
    <section class="panel">
      <div class="controls">
        <label
          >{{ $t("贡献点预算")
          }}<input
            v-model.number="budget"
            :aria-label="$t('贡献点预算')"
            type="number"
            min="0"
            max="2000"
            :disabled="optimizer.running"
        /></label>
        <label
          >{{ $t("计算上限")
          }}<select
            v-model.number="timeLimit"
            :aria-label="$t('计算上限')"
            :disabled="optimizer.running"
          >
            <option :value="10">{{ $t("10 秒") }}</option>
            <option :value="30">{{ $t("30 秒") }}</option>
            <option :value="120">{{ $t("2 分钟") }}</option>
            <option :value="300">{{ $t("5 分钟") }}</option>
          </select></label
        >
        <label
          >{{ $t("采集点候选")
          }}<select
            v-model.number="maxPlantzones"
            :aria-label="$t('采集点候选')"
            :disabled="optimizer.running"
          >
            <option :value="20">{{ $t("20 个 · 小规模验证") }}</option>
            <option :value="50">{{ $t("50 个") }}</option>
            <option :value="100">{{ $t("100 个") }}</option>
            <option :value="370">{{ $t("全部有有效价格的采集点") }}</option>
          </select></label
        >
        <label
          >{{ $t("产物仓库")
          }}<select
            v-model.number="storageTown"
            :aria-label="$t('产物仓库')"
            :disabled="optimizer.running"
          >
            <option
              v-for="id in game.townsWithRedirectableStorage"
              :key="id"
              :value="id"
            >
              {{ nodeName(id) }}
            </option>
          </select></label
        >
      </div>
      <p class="muted">
        {{
          $t(
            "The budget includes nodes, lodging, storage and reserved houses. Fences, workshop production, custom jobs and trade tasks are not optimized."
          )
        }}
      </p>
      <p v-if="user.workersWorkshopCount">
        {{
          $t(
            "Workshop routes and material storage are not included automatically. This preview plans gathering workers."
          )
        }}
      </p>
      <fieldset :disabled="optimizer.running">
        <legend>{{ $t("允许招募工人的城镇") }}</legend>
        <div class="town-tools">
          <button @click="townIds = [...game.townsWithLodging]">
            {{ $t("全部") }}</button
          ><button @click="townIds = []">{{ $t("清除") }}</button
          ><span>{{ $t("已选") }} {{ townIds.length }} {{ $t("个") }}</span>
        </div>
        <div class="towns">
          <label v-for="id in game.townsWithLodging" :key="id"
            ><input v-model="townIds" type="checkbox" :value="id" />{{
              nodeName(id)
            }}</label
          >
        </div>
      </fieldset>
      <label class="check"
        ><input
          v-model="includeGrind"
          type="checkbox"
          :disabled="optimizer.running"
        />
        {{ $t("保留并连接当前") }} {{ user.grindTakenList.length }}
        {{ $t("个刷怪节点") }}</label
      >
      <div class="actions">
        <button
          class="primary"
          :disabled="optimizer.running || !townIds.length || market.apiFetching"
          @click="start"
        >
          {{ $t("开始优化") }}</button
        ><button v-if="optimizer.running" @click="optimizer.stop">
          {{ $t("停止并保留当前方案") }}</button
        ><button
          :disabled="market.apiFetching || optimizer.running"
          @click="reloadPrices"
        >
          {{ market.apiFetching ? $t("更新价格中…") : $t("更新价格") }}
        </button>
      </div>
      <p class="muted">
        {{
          market.apiDatetime
            ? $t("价格更新于 {date}", {
                date: new Date(market.apiDatetime).toLocaleString(locale),
              })
            : $t("使用当前缓存与自定义价格；缺价的采集点会跳过。")
        }}
      </p>
    </section>
    <p v-if="optimizer.error || actionError" class="error" role="alert">
      {{ $t(actionError || optimizer.error) }}
    </p>
    <section
      v-if="optimizer.running || optimizer.stage"
      class="progress"
      role="status"
      aria-live="polite"
    >
      {{ $t(stages[optimizer.stage] || optimizer.stage) }} ·
      {{ display(elapsed, 1) }} {{ $t("秒") }}
      <span v-if="Number.isFinite(gap)">
        {{ $t("· 求解差距") }} {{ display(gap * 100) }}%</span
      >
      <span v-if="optimizer.progress.completed">
        {{ $t("· 已处理") }} {{ optimizer.progress.completed }} /
        {{ optimizer.progress.total }}</span
      >
    </section>
    <section v-if="result" class="panel result">
      <div class="intro">
        <h2>{{ applied ? $t("当前已应用的方案") : $t("方案预览") }}</h2>
        <span>{{ $t(statusLabel) }}</span>
      </div>
      <div class="metrics">
        <div>
          <span>{{ $t("日收益 · 百万银币") }}</span
          ><strong>{{ display(result.profitSilverPerDay / 1e6) }}</strong>
        </div>
        <div>
          <span>{{ $t("贡献点 · 预算") }} {{ result.budget }}</span
          ><strong>{{ display(result.totalCP) }}</strong>
        </div>
        <div>
          <span>{{ $t("节点 / 住房与仓库") }}</span
          ><strong>{{ result.nodeCP }} / {{ result.infrastructureCP }}</strong>
        </div>
        <div>
          <span>{{ $t("建议工人") }}</span
          ><strong>{{ result.workers.length }}</strong>
        </div>
      </div>
      <p class="muted">
        {{ $t("在") }} {{ result.consideredPlantzones }}
        {{ $t("个采集点候选内优化。") }}{{ result.missingPrices.length }}
        {{ $t("个采集点因缺价跳过；候选、平均属性与技能假设会影响结果。") }}
      </p>
      <p v-if="stale" class="error">
        {{ $t("当前工人或基础设施设置已变化，请重新优化后应用。") }}
      </p>
      <p v-if="valueStale" class="notice">
        {{
          $t(
            "价格或资源设置已变化，预览收益和求解差距来自原快照；重新优化可更新方案。"
          )
        }}
      </p>
      <p v-if="!canReplaceGatheringWorkers(user)" class="notice">
        {{
          $t(
            "现有帝国包含其他任务。首版可导出建设方案，直接应用暂仅支持采集与空闲工人。"
          )
        }}
      </p>
      <p
        v-if="user.optimizerPlan && !applied && !optimizer.result"
        class="notice"
      >
        {{ $t("保存方案的设置已变化，首页已恢复常规路由。") }}
      </p>
      <div class="actions">
        <button :disabled="optimizer.running || stale" @click="exportPlan">
          {{ $t("导出方案 · 可导入首页") }}</button
        ><button
          v-if="!applied"
          class="primary"
          :disabled="!canApply || !consent"
          @click="apply"
        >
          {{ $t("应用建议工人和连接") }}</button
        ><span v-else class="success">{{ $t("已保留求解路径") }}</span>
      </div>
      <label v-if="!applied && canApply" class="check"
        ><input v-model="consent" type="checkbox" />
        {{
          $t(
            "我确认替换当前采集与空闲工人，并使用方案中的刷怪保留节点；应用后可撤销。"
          )
        }}</label
      >
      <svg
        v-if="mapPreview"
        class="map"
        viewBox="0 0 1000 450"
        role="img"
        :aria-label="$t('方案连接节点预览')"
      >
        <line
          v-for="edge in mapPreview.edges"
          :key="edge.join(':')"
          :x1="mapPreview.points[edge[0]][0]"
          :y1="mapPreview.points[edge[0]][1]"
          :x2="mapPreview.points[edge[1]][0]"
          :y2="mapPreview.points[edge[1]][1]"
        />
        <circle
          v-for="(point, id) in mapPreview.points"
          :key="id"
          :cx="point[0]"
          :cy="point[1]"
          :r="mapPreview.towns.has(Number(id)) ? 5 : 2.5"
          :class="{ town: mapPreview.towns.has(Number(id)) }"
        >
          <title>{{ nodeName(id) }}</title>
        </circle>
      </svg>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ $t("采集点") }}</th>
              <th>{{ $t("工人城镇") }}</th>
              <th>{{ $t("建议工人") }}</th>
              <th>{{ $t("日收益 · 百万银币") }}</th>
              <th>{{ $t("连接节点数") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in result.assignments" :key="a.pzk">
              <td>{{ game.plantzoneName(a.pzk) }}</td>
              <td>{{ nodeName(a.town) }}</td>
              <td>
                {{ game.uloc.char[a.worker.charkey] || a.worker.charkey }}
              </td>
              <td>{{ display(a.value / 1e6) }}</td>
              <td>{{ a.path.length }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <details>
        <summary>{{ $t("住房与求解详情") }}</summary>
        <p>
          {{ $t("节点、住房与仓库已复核。HiGHS") }}
          {{ result.solverVersion || "1.15.1" }} ·
          {{ result.modelSize.variables }} {{ $t("个变量 /") }}
          {{ result.modelSize.constraints }} {{ $t("个约束。") }}
        </p>
        <ul>
          <li
            v-for="town in result.housing.filter(
              (t) => t.workerCount || t.cost
            )"
            :key="town.town"
          >
            {{ nodeName(town.town) }}：{{ town.workerCount }} {{ $t("名工人，")
            }}{{ town.cost }} {{ $t("CP")
            }}<span v-if="town.storageCount"
              >，{{ town.storageCount }} {{ $t("个产物仓储槽位") }}</span
            >
          </li>
        </ul>
        <p>
          {{ $t("Reserved house uses are included in the housing budget.") }}
          <router-link to="/housecraft">{{
            $t("Housing planner")
          }}</router-link>
        </p>
        <details
          v-for="town in result.housing.filter((t) => t.dynamicHousing)"
          :key="town.townKey"
        >
          <summary>
            {{ nodeName(town.town) }} · {{ $t("Reserved house uses") }}
          </summary>
          <ul>
            <li
              v-for="hk in town.indices.filter((k) => game.houseInfo[k])"
              :key="hk"
            >
              {{ game.uloc.char[hk] || hk }} ·
              {{
                town.reservations?.[hk]?.automatic
                  ? $t("Working workshop")
                  : game.uloc.housetype[town.usages[town.indices.indexOf(hk)]]
              }}
              · {{ game.houseCost(hk) }} {{ $t("CP") }}
            </li>
          </ul>
        </details>
      </details>
    </section>
  </main>
</template>

<style scoped>
.optimizer {
  max-width: 1200px;
  margin: 0 auto;
}
.intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
h1 {
  font-size: 1.8rem;
}
h2 {
  font-size: 1.2rem;
}
.panel {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.2rem;
  margin: 1rem 0;
}
.notice {
  background: var(--color-background-soft);
  padding: 0.8rem;
  border-left: 3px solid #bd913c;
}
.muted {
  font-size: 0.85rem;
  opacity: 0.75;
  margin: 0.7rem 0;
}
.controls {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}
.controls label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
input[type="number"],
select {
  width: 100%;
  padding: 0.45rem;
  background: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}
fieldset {
  border: 1px solid var(--color-border);
  padding: 0.8rem;
}
.towns {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.45rem;
  margin-top: 0.7rem;
}
.towns label,
.check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.check {
  margin: 0.9rem 0;
  font-size: 0.9rem;
}
.town-tools,
.actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
}
button {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  background: var(--color-background-soft);
  color: var(--color-text);
}
button.primary {
  background: #197957;
  color: white;
  border-color: #197957;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
.error {
  color: #d85b55;
}
.success {
  color: #289a73;
}
.progress {
  padding: 0.8rem;
  background: var(--color-background-soft);
  border-radius: 4px;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin: 1rem 0;
}
.metrics div {
  display: flex;
  flex-direction: column;
}
.metrics span {
  font-size: 0.85rem;
  opacity: 0.75;
}
.metrics strong {
  font-size: 1.65rem;
}
.map {
  width: 100%;
  max-height: 390px;
  background: var(--color-background-soft);
  border-radius: 4px;
  margin: 1rem 0;
}
.map line {
  stroke: #85968d;
  stroke-width: 1.4;
}
.map circle {
  fill: #4fa584;
}
.map .town {
  fill: #e1ac4d;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
}
td,
th {
  padding: 0.45rem;
  text-align: left;
}
details {
  margin-top: 1rem;
}
@media (max-width: 760px) {
  .controls,
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .towns {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .intro {
    align-items: flex-start;
    flex-direction: column;
  }
  .panel {
    padding: 0.8rem;
  }
}
</style>
