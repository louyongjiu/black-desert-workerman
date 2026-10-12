<script setup>
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useGameStore } from "../stores/game";
import { useUserStore } from "../stores/user";
import { useHousingStore } from "../stores/housing";
import { useUiI18n } from "../i18n/vue";
import HouseReservations from "../components/HouseReservations.vue";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { TreeChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import VChart from "vue-echarts";
use([CanvasRenderer, TreeChart, TooltipComponent]);
const game = useGameStore(),
  user = useUserStore(),
  housing = useHousingStore();
const { t, locale } = useUiI18n(),
  route = useRoute();
const towns = computed(() =>
  [
    ...new Set(Object.values(game.houseInfo).map((h) => Number(h.affTown))),
  ].sort((a, b) =>
    (game.uloc.town[a] || String(a)).localeCompare(
      game.uloc.town[b] || String(b)
    )
  )
);
const initial = Number(route.query.town);
const tk = ref(towns.value.includes(initial) ? initial : 5),
  wantLodging = ref(0),
  wantStorage = ref(0),
  actionError = ref("");
const bestLookup = computed(() =>
  housing.lookup(tk.value, wantLodging.value, wantStorage.value, 2)
);
const running = computed(() => housing.busyKey === bestLookup.value.sourceKey);
const saved = computed(() => user.housingPlans[tk.value]);
const rows = computed(() => {
  const plan = bestLookup.value;
  return (plan.indices || [])
    .map((hk, i) => ({
      hk,
      state: plan.states[i],
      usage:
        plan.usages?.[i] ??
        (plan.states[i] === 1 ? 2 : plan.states[i] === 2 ? 1 : 0),
      house: game.houseInfo[hk],
      automatic: Boolean(plan.reservations?.[hk]?.automatic),
    }))
    .filter((row) => row.house)
    .sort((a, b) =>
      (game.uloc.char[a.hk] || String(a.hk)).localeCompare(
        game.uloc.char[b.hk] || String(b.hk)
      )
    );
});
const changes = computed(() => {
  if (!saved.value || !bestLookup.value.success) return null;
  const before = new Set(
      saved.value.indices.filter((hk) => game.houseInfo[hk])
    ),
    after = new Set(rows.value.map((r) => r.hk));
  return {
    added: [...after].filter((k) => !before.has(k)),
    removed: [...before].filter((k) => !after.has(k)),
    changed: rows.value
      .filter((r) => {
        const i = saved.value.indices.indexOf(r.hk);
        return (
          i >= 0 &&
          (saved.value.usages?.[i] ??
            (saved.value.states[i] === 1
              ? 2
              : saved.value.states[i] === 2
              ? 1
              : 0)) !== r.usage
        );
      })
      .map((r) => r.hk),
  };
});
const display = (value) =>
  Number.isFinite(value) ? value.toLocaleString(locale.value) : "—";
const name = (key) => game.uloc.char[key] || key;
const useName = (usage) => game.uloc.housetype[usage] || usage;
const tree = computed(() => {
  const root = {
      name: "",
      value: { label: game.uloc.town[tk.value] },
      children: [],
    },
    nodes = new Map();
  for (const h of Object.values(game.houseInfo).filter(
    (h) => Number(h.affTown) === tk.value
  )) {
    const row = rows.value.find((r) => r.hk === h.key);
    nodes.set(h.key, {
      name: String(h.key),
      value: {
        label: name(h.key),
        cp: h.CP,
        use: row
          ? row.automatic
            ? t("Working workshop")
            : useName(row.usage)
          : t("Available for planning"),
      },
      itemStyle: row
        ? {
            color: row.state === 1 ? "#a5f" : row.state === 2 ? "#fe6" : "#6bd",
          }
        : {},
      children: [],
    });
  }
  for (const [hk, node] of nodes) {
    const parent = game.houseInfo[hk].needHouseKey;
    (nodes.get(parent) || root).children.push(node);
  }
  return root;
});
const chartOption = computed(() => ({
  tooltip: {
    trigger: "item",
    formatter: (p) =>
      p.value.label +
      " · " +
      (p.value.cp ?? "") +
      " " +
      t("CP") +
      " · " +
      (p.value.use || ""),
  },
  series: [
    {
      type: "tree",
      layout: "radial",
      roam: true,
      data: [tree.value],
      symbolSize: 6,
      initialTreeDepth: 10,
      label: { show: false },
      emphasis: { focus: "ancestor" },
    },
  ],
}));
function empireNeeds() {
  const infra = user.townsInfra[tk.value];
  if (infra) {
    wantLodging.value = Math.max(0, infra.wantLodging);
    wantStorage.value = Math.max(0, infra.wantStorage);
  }
}
function save() {
  try {
    housing.save(bestLookup.value);
    actionError.value = "";
  } catch (e) {
    actionError.value = e.message;
  }
}
</script>
<template>
  <main class="housecraft">
    <h1>{{ $t("Housing planner") }}</h1>
    <p>
      {{
        $t(
          "Plan lodging and storage while keeping reserved house uses. Each rented house is counted once."
        )
      }}
    </p>
    <p>
      {{ $t("data from") }}
      <a href="https://github.com/Thell/bdo-housecraft">Thell/bdo-housecraft</a>
    </p>
    <div class="controls">
      <label
        >{{ $t("town")
        }}<select v-model.number="tk">
          <option v-for="town in towns" :key="town" :value="town">
            {{ game.uloc.town[town] || town }}
          </option>
        </select></label
      >
      <label
        >{{ $t("Required beds from houses")
        }}<input v-model.number="wantLodging" type="number" min="0" max="1000"
      /></label>
      <label
        >{{ $t("Required storage from houses")
        }}<input v-model.number="wantStorage" type="number" min="0" max="2000"
      /></label>
      <button @click="empireNeeds">{{ $t("Use current empire needs") }}</button>
    </div>
    <p>
      {{
        $t(
          "These requirements are supplied by rented houses. Current empire needs already deduct free and paid capacity."
        )
      }}
    </p>
    <HouseReservations :town-key="tk" />
    <p v-if="bestLookup.pending || running" role="status">
      {{ $t("Calculating housing") }}
      <button @click="housing.stop(bestLookup.sourceKey)">
        {{ $t("Stop housing calculation") }}
      </button>
    </p>
    <p v-if="bestLookup.error" role="alert">
      {{ $t(bestLookup.error) }}
      <button @click="housing.retry(bestLookup.sourceKey)">
        {{ $t("Retry housing calculation") }}
      </button>
    </p>
    <p v-if="actionError" role="alert">{{ $t(actionError) }}</p>
    <section v-if="bestLookup.success" class="result">
      <p>
        <strong>{{ display(bestLookup.cost) }} {{ $t("CP total") }}</strong> ·
        {{ display(bestLookup.lodging) }} {{ $t("lodging") }} ·
        {{ display(bestLookup.storage) }} {{ $t("storage") }}
      </p>
      <p
        v-if="
          bestLookup.status === 'time_limit' || bestLookup.status === 'stopped'
        "
      >
        {{ $t("Feasible housing plan; minimum cost has not been proved.") }}
      </p>
      <p v-else-if="!running">
        {{
          $t("Minimum housing cost for these requirements and reservations.")
        }}
      </p>
      <button :disabled="running" @click="save">
        {{ $t("Save housing plan") }}
      </button>
      <button v-if="user.housingUndo" @click="housing.undo()">
        {{ $t("Undo housing change") }}
      </button>
      <p>
        {{
          $t(
            "Saving records this plan in Workerman. It does not rent houses in the game."
          )
        }}
      </p>
      <p v-if="saved && saved.sourceKey === bestLookup.sourceKey">
        {{ $t("Housing plan saved") }}
      </p>
      <div v-if="changes">
        <p>
          {{ $t("Compared with saved housing plan") }}:
          {{ display(bestLookup.cost - saved.cost) }} {{ $t("CP") }}
        </p>
        <p>
          {{ $t("Rent these houses") }}:
          {{ changes.added.map(name).join(", ") || "—" }}
        </p>
        <p>
          {{ $t("Release these houses") }}:
          {{ changes.removed.map(name).join(", ") || "—" }}
        </p>
        <p>
          {{ $t("Change these house uses") }}:
          {{ changes.changed.map(name).join(", ") || "—" }}
        </p>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ $t("House") }}</th>
              <th>{{ $t("usage") }}</th>
              <th>{{ $t("CP") }}</th>
              <th>{{ $t("Prerequisite house") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.hk">
              <td>{{ name(row.hk) }}</td>
              <td>
                {{
                  row.automatic ? $t("Working workshop") : useName(row.usage)
                }}
              </td>
              <td>{{ row.house.CP }}</td>
              <td>
                {{
                  row.house.needHouseKey ? name(row.house.needHouseKey) : "—"
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <p v-else-if="!bestLookup.pending && !bestLookup.error" role="alert">
      {{ $t("No housing plan satisfies these reservations") }}
    </p>
    <v-chart
      v-if="towns.includes(tk)"
      class="chart"
      :option="chartOption"
      autoresize
    />
  </main>
</template>
<style scoped>
.housecraft {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1rem;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: end;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
input {
  width: 7rem;
}
select {
  max-width: 100%;
}
.result {
  border: 1px solid #666;
  border-radius: 0.5rem;
  padding: 1rem;
}
.table-wrap {
  overflow: auto;
}
table {
  width: 100%;
}
td,
th {
  text-align: left;
  padding: 0.4rem;
}
p {
  margin: 0.7rem 0;
}
p[role="alert"] {
  color: #f99;
}
.chart {
  height: 480px;
  width: 100%;
}
@media (max-width: 600px) {
  .housecraft {
    padding: 0.5rem;
  }
  .controls > label {
    max-width: 100%;
  }
  .chart {
    height: 340px;
  }
}
</style>
