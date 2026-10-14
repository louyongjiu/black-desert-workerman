<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useGameStore } from "../stores/game";
import { useUserStore } from "../stores/user";
import { useHousingStore } from "../stores/housing";
import { useOptimizerStore } from "../stores/optimizer";
import { useHousingWorkbenchStore } from "../stores/housingWorkbench";
import { useUiActionsStore } from "../stores/uiActions";
import {
  housingTownKeys,
  empireHousingTown,
  summarizeHousing,
  housingRows,
} from "../housing/overview.mjs";
import { normalizeReservations, townReservations } from "../housing/core.mjs";
import { storageRequirements } from "../housing/requirements.mjs";
import {
  activeEmpireDrafts,
  draftUser,
  trialDemand,
} from "../housing/workbench.mjs";
import { useUiI18n } from "../i18n/vue";
import HousingReservationsEditor from "../components/HousingReservationsEditor.vue";
import WorkshopStorage from "../components/WorkshopStorage.vue";
import { localizedAsyncComponent } from "../i18n/asyncComponent";
const HousingGraph = localizedAsyncComponent(() => import('../components/HousingGraph.vue'));
const game = useGameStore(),
  user = useUserStore(),
  housing = useHousingStore(),
  optimizer = useOptimizerStore(),
  workbench = useHousingWorkbenchStore();
const { t, locale } = useUiI18n(),
  route = useRoute(),
  router = useRouter();
const actionError = ref(""),
  notice = ref(""),
  graphOpen = ref(false),
  showAllTowns = ref(false);
const townName = (key) => game.uloc.town[key] || String(key);
const towns = computed(() =>
  housingTownKeys(
    game,
    housing.empireSource?.plan,
    user.housingWorkerCounts,
    user.warehouseRequirements
  ).sort((a, b) => townName(a).localeCompare(townName(b)))
);
const mode = computed(() =>
  route.query.mode === "trial" ? "trial" : "empire"
);
const trial = computed(() => mode.value === "trial");
const allTownsView = computed(() => !trial.value && route.query.town === "all");
const tk = computed({
  get: () => workbench.townKey,
  set: (value) => {
    workbench.townKey = Number(value);
    router.replace({
      path: "/housecraft",
      query: { ...route.query, town: value },
    });
  },
});
const townSelection = computed({
  get: () => (allTownsView.value ? "all" : tk.value),
  set: (value) => {
    if (value === "all")
      router.replace({
        path: "/housecraft",
        query: { ...route.query, town: "all" },
      });
    else tk.value = value;
  },
});
watch(
  () => route.query.town,
  (value) => {
    const initial = Number(value);
    if (towns.value.includes(initial)) workbench.townKey = initial;
  },
  { immediate: true }
);
watch(
  [tk, mode, allTownsView],
  () => {
    if (trial.value) workbench.ensureTrial(tk.value);
    else workbench.ensureEmpire(tk.value);
    actionError.value = "";
    notice.value = "";
  },
  { immediate: true, flush: "sync" }
);
const trialEntry = computed(() => workbench.trials[tk.value]);
const empireEntry = computed(() => workbench.empire[tk.value]);
const dirtyTowns = computed(() =>
  Object.keys(workbench.empire).filter((key) => workbench.empireDirty(key))
);
const dirty = computed(() => workbench.empireDirty(tk.value));
const source = computed(() => housing.empireSource);
const empireSourceLabel = computed(() =>
  source.value
    ? source.value.preview
      ? "Housing from the empire preview"
      : "Housing from the applied empire"
    : "Housing required by the current workers and storage"
);
const staleEmpire = computed(
  () => !source.value && Boolean(user.optimizerPlan || optimizer.result)
);
const warehouses = computed(() => storageRequirements(game, user));
const automatic = computed(() => {
  try {
    return Object.fromEntries(
      Object.entries(normalizeReservations(game.houseInfo, user)).filter(
        ([, r]) => r.automatic
      )
    );
  } catch {
    return {};
  }
});
const townOverview = computed(() =>
  towns.value
    .map((key) => ({
      key,
      manual: Object.keys(
        townReservations(
          game.houseInfo,
          settingsUser.value.houseReservations,
          key
        )
      ).length,
      workshops: Object.keys(
        townReservations(game.houseInfo, automatic.value, key)
      ).length,
      stockWorkshops: warehouses.value[key]?.workshops.length || 0,
      ready:
        (settingsUser.value.warehouseRequirements[key] || warehouses.value[key])
          ?.resolved !== false,
      dirty: workbench.empireDirty(key),
    }))
    .filter(
      (town) =>
        showAllTowns.value ||
        allTownsView.value ||
        town.manual ||
        town.workshops ||
        town.stockWorkshops ||
        town.dirty ||
        town.key === tk.value
    )
);
const settingsUser = computed(() => {
  const draft = draftUser(game, user, activeEmpireDrafts(workbench.empire));
  return { ...draft, warehouseRequirements: storageRequirements(game, draft) };
});
const workshopStorageTowns = computed(() =>
  Object.values(settingsUser.value.warehouseRequirements)
    .filter((town) => town.workshops.length)
    .sort((a, b) => townName(a.townKey).localeCompare(townName(b.townKey)))
);
function empireTownView(key) {
  return empireHousingTown(game, user, key, {
    plan: source.value?.plan,
    workers: user.housingWorkerCounts,
    warehouses: warehouses.value,
    infrastructure: (town) => user.townsInfra[town],
  });
}
const selectedEmpireTown = computed(() => empireTownView(tk.value));
const allEmpireTowns = computed(() =>
  allTownsView.value ? towns.value.map(empireTownView) : []
);
const allHousingSummary = computed(() =>
  summarizeHousing(allEmpireTowns.value)
);
const allHousingRows = computed(() =>
  allEmpireTowns.value
    .flatMap((town) =>
      housingRows(game, town.result, automatic.value).map((row) => ({
        ...row,
        townKey: town.key,
      }))
    )
    .sort(
      (a, b) =>
        townName(a.townKey).localeCompare(townName(b.townKey)) ||
        name(a.hk).localeCompare(name(b.hk))
    )
);
const allReservedRows = computed(() =>
  Object.entries({
    ...settingsUser.value.houseReservations,
    ...automatic.value,
  })
    .map(([hk, reservation]) => ({
      hk,
      house: game.houseInfo[hk],
      usage: Number(reservation?.usage ?? reservation),
      automatic: Boolean(automatic.value[hk]),
    }))
    .filter((row) => row.house)
    .sort(
      (a, b) =>
        townName(a.house.affTown).localeCompare(townName(b.house.affTown)) ||
        name(a.hk).localeCompare(name(b.hk))
    )
);
const inputDemand = computed(() => {
  try {
    return trialDemand(trialEntry.value.inputs);
  } catch {
    return null;
  }
});
const result = computed(() => {
  if (trial.value) return workbench.trialResult(tk.value);
  return selectedEmpireTown.value.result;
});
const running = computed(() =>
  Boolean(result.value?.sourceKey && housing.busyKey === result.value.sourceKey)
);
const resultStale = computed(
  () => trial.value && workbench.trialStale(tk.value)
);
const saved = computed(() => user.housingPlans[tk.value]);
const demand = computed(() => ({
  workers: result.value?.workerCount ?? user.housingWorkerCounts[tk.value] ?? 0,
  storage: result.value?.storageCount ?? warehouses.value[tk.value]?.total ?? 0,
  freeBeds:
    result.value?.baseLodging ?? 1 + Number(user.lodgingP2W[tk.value] || 0),
  freeStorage: Math.min(
    192,
    result.value?.baseStorage ??
      user.baseStorage + Number(user.storageP2W[tk.value] || 0)
  ),
}));
const totalBeds = computed(
  () => (result.value?.lodging || 0) + demand.value.freeBeds
);
const totalStorage = computed(() =>
  Math.min(192, (result.value?.storage || 0) + demand.value.freeStorage)
);
const name = (hk) => game.uloc.char[hk] || String(hk);
const useName = (usage) => game.uloc.housetype[usage] || String(usage);
const display = (value) =>
  Number.isFinite(value) ? value.toLocaleString(locale.value) : "—";
const rows = computed(() =>
  housingRows(game, result.value, trial.value ? {} : automatic.value).sort(
    (a, b) => name(a.hk).localeCompare(name(b.hk))
  )
);
const changes = computed(() => {
  if (!saved.value || !result.value?.success) return null;
  const before = new Set(
      (saved.value.indices || []).filter((hk) => game.houseInfo[hk])
    ),
    after = new Set(rows.value.map((r) => r.hk));
  return {
    added: [...after].filter((hk) => !before.has(hk)),
    removed: [...before].filter((hk) => !after.has(hk)),
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
function act(action, message = "") {
  try {
    action();
    actionError.value = "";
    notice.value = message;
  } catch (e) {
    actionError.value = e.message;
    notice.value = "";
  }
}
function updateTrial(key, value) {
  act(() => workbench.updateTrial(tk.value, { [key]: value }));
}
function updateEmpire(patch, townKey = tk.value) {
  act(() => workbench.updateEmpire(townKey, patch));
}
function saveEmpire() {
  act(() => {
    workbench.saveEmpire();
    useUiActionsStore().notify(
      "Housing settings saved. Re-optimize to update the plan."
    );
    router.push("/optimizer");
  });
}
function switchMode(next) {
  router.replace({
    path: "/housecraft",
    query: { mode: next, town: tk.value },
  });
}
function retry() {
  act(() => {
    housing.retry(result.value.sourceKey);
    if (trial.value) workbench.runTrial(tk.value);
  });
}
const chartOption = computed(() => {
  const root = {
      name: "",
      value: {
        label: allTownsView.value ? t("All towns") : townName(tk.value),
      },
      children: [],
    },
    townRoots = new Map(),
    nodes = new Map();
  if (allTownsView.value)
    for (const key of towns.value) {
      const branch = {
        name: "town:" + key,
        value: { label: townName(key) },
        label: {
          show: true,
          fontSize: 11,
          formatter: (item) => item.value.label,
        },
        children: [],
      };
      townRoots.set(key, branch);
      root.children.push(branch);
    }
  const graphRows = new Map(
    (allTownsView.value ? allHousingRows.value : rows.value).map((row) => [
      row.hk,
      row,
    ])
  );
  for (const h of Object.values(game.houseInfo).filter(
    (h) => allTownsView.value || Number(h.affTown) === tk.value
  )) {
    const row = graphRows.get(h.key);
    nodes.set(h.key, {
      name: String(h.key),
      value: {
        label: name(h.key),
        cp: h.CP,
        use: row ? useName(row.usage) : t("Available for planning"),
      },
      itemStyle: row
        ? {
            color: row.state === 1 ? "#a5f" : row.state === 2 ? "#fe6" : "#6bd",
          }
        : {},
      children: [],
    });
  }
  for (const [hk, node] of nodes)
    (
      nodes.get(game.houseInfo[hk].needHouseKey) ||
      townRoots.get(Number(game.houseInfo[hk].affTown)) ||
      root
    ).children.push(node);
  return {
    tooltip: {
      trigger: "item",
      formatter: (p) =>
        p.value.cp == null
          ? p.value.label
          : p.value.label +
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
        data: [root],
        symbolSize: 6,
        initialTreeDepth: allTownsView.value ? 1 : 10,
        label: { show: false },
        emphasis: { focus: "ancestor" },
      },
    ],
  };
});
</script>
<template>
  <main class="housecraft">
    <h1>{{ $t("Housing planner") }}</h1>
    <div class="tabs" role="tablist" :aria-label="$t('Housing planner')">
      <button
        id="empire-tab"
        role="tab"
        :aria-selected="!trial"
        aria-controls="housing-panel"
        :class="{ active: !trial }"
        @click="switchMode('empire')"
      >
        {{ $t("Empire housing") }}
      </button>
      <button
        id="trial-tab"
        role="tab"
        :aria-selected="trial"
        aria-controls="housing-panel"
        :class="{ active: trial }"
        @click="switchMode('trial')"
      >
        {{ $t("Free housing trial") }}
      </button>
    </div>
    <section
      id="housing-panel"
      role="tabpanel"
      :aria-labelledby="trial ? 'trial-tab' : 'empire-tab'"
    >
      <p>
        {{
          trial
            ? $t(
                "Try your own housing requirements. Trial inputs and saved records do not change the empire."
              )
            : $t(
                "Reserve house uses and review workshop storage. Save settings here, then calculate and apply the plan in the empire optimizer."
              )
        }}
      </p>
      <p class="help-text">
        {{
          $t(
            "Drafts are saved on this device across refreshes. Save all changed towns to include them in the empire."
          )
        }}
      </p>
      <p v-if="workbench.storageError" role="alert">
        {{ $t(workbench.storageError) }}
      </p>
      <div class="controls town-controls">
        <label
          >{{ $t("town")
          }}<select v-model="townSelection">
            <option v-if="!trial" value="all">{{ $t("All towns") }}</option>
            <option v-for="town in towns" :key="town" :value="town">
              {{ townName(town) }}
            </option>
          </select></label
        >
        <router-link to="/optimizer">{{
          $t("Back to empire optimizer")
        }}</router-link>
      </div>
      <nav v-if="allTownsView" class="all-town-links">
        <a href="#all-housing-results">{{ $t("All-town housing results") }}</a>
        <a href="#all-housing-settings">{{ $t("Empire housing settings") }}</a>
        <a href="#housing-graph">{{ $t("House prerequisite diagram") }}</a>
      </nav>
      <section
        v-if="allTownsView"
        id="all-housing-results"
        class="result all-town-results"
        :aria-label="$t('All-town housing results')"
      >
        <h2>{{ $t("Housing used by the empire") }} · {{ $t("All towns") }}</h2>
        <p>{{ $t(empireSourceLabel) }}</p>
        <p v-if="dirtyTowns.length" class="notice" role="status">
          {{
            $t(
              "The housing below uses saved settings. Save the draft and re-optimize to include your changes."
            )
          }}
        </p>
        <p v-if="staleEmpire" class="notice">
          {{
            $t(
              "House uses or empire requirements changed. Re-optimize to update the complete plan."
            )
          }}
        </p>
        <p v-if="allHousingSummary.pending" role="status">
          {{
            $t("Calculating housing for {count} towns", {
              count: allHousingSummary.pending,
            })
          }}
        </p>
        <p v-if="allHousingSummary.failed" role="alert">
          {{
            $t(
              "Housing needs review in {count} towns. See the town details below.",
              { count: allHousingSummary.failed }
            )
          }}
        </p>
        <div class="summary-cards">
          <div>
            <span>{{ $t("Housing CP") }}</span
            ><strong>{{ display(allHousingSummary.cost) }}</strong>
          </div>
          <div>
            <span>{{ $t("Beds needed / available") }}</span
            ><strong
              >{{ display(allHousingSummary.workers) }} /
              {{ display(allHousingSummary.totalBeds) }}</strong
            >
          </div>
          <div>
            <span>{{ $t("Storage needed / available") }}</span
            ><strong
              >{{ display(allHousingSummary.storage) }} /
              {{ display(allHousingSummary.totalStorage) }}</strong
            >
          </div>
        </div>
        <p v-if="source">
          {{
            $t("This housing cost is already included in the empire budget.")
          }}
        </p>
        <details class="town-capacity-details">
          <summary>{{ $t("Housing capacity by town") }}</summary>
          <div class="table-wrap">
            <table class="all-town-capacity">
              <thead>
                <tr>
                  <th>{{ $t("town") }}</th>
                  <th>{{ $t("Housing CP") }}</th>
                  <th>{{ $t("Beds needed / available") }}</th>
                  <th>{{ $t("Storage needed / available") }}</th>
                  <th>{{ $t("Housing planning method") }}</th>
                  <th>{{ $t("Housing calculation status") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="town in allEmpireTowns" :key="town.key">
                  <td>
                    <button @click="tk = town.key">
                      {{ townName(town.key) }}
                    </button>
                  </td>
                  <td>{{ display(town.result.cost) }}</td>
                  <td>
                    {{ display(town.demand.workers) }} /
                    {{ display(town.totalBeds) }}
                  </td>
                  <td>
                    {{ display(town.demand.storage) }} /
                    {{ display(town.totalStorage) }}
                  </td>
                  <td>
                    {{
                      $t(
                        town.result.housingMethod === "solve"
                          ? "Housing calculated with reserved uses"
                          : "Precomputed housing plan"
                      )
                    }}
                  </td>
                  <td>
                    {{
                      $t(
                        town.result.pending
                          ? "Calculating housing"
                          : town.ready
                          ? "Ready"
                          : "Review required"
                      )
                    }}
                    <p v-if="town.result.error" role="alert">
                      {{ $t(town.result.error) }}
                    </p>
                    <button
                      v-if="town.result.pending && town.result.sourceKey"
                      @click="housing.stop(town.result.sourceKey)"
                    >
                      {{ $t("Stop housing calculation") }}
                    </button>
                    <button
                      v-if="town.result.error && town.result.sourceKey"
                      @click="act(() => housing.retry(town.result.sourceKey))"
                    >
                      {{ $t("Retry housing calculation") }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
        <h3>{{ $t("House") }} · {{ allHousingRows.length }}</h3>
        <p
          v-if="
            !allHousingRows.length &&
            !allHousingSummary.pending &&
            !allHousingSummary.failed
          "
        >
          {{ $t("No houses are needed for the current plan.") }}
        </p>
        <div v-if="allHousingRows.length" class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ $t("town") }}</th>
                <th>{{ $t("House") }}</th>
                <th>{{ $t("usage") }}</th>
                <th>{{ $t("CP") }}</th>
                <th>{{ $t("Prerequisite house") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in allHousingRows" :key="row.hk">
                <td>
                  <button @click="tk = row.townKey">
                    {{ townName(row.townKey) }}
                  </button>
                </td>
                <td>{{ name(row.hk) }}</td>
                <td>
                  {{
                    row.automatic ? $t("Working workshop") : useName(row.usage)
                  }}<small>{{
                    user.houseReservations[row.hk]
                      ? $t("Custom house use")
                      : $t("Automatically planned")
                  }}</small>
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
        <details class="capacity-details">
          <summary>{{ $t("Capacity details") }}</summary>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{{ $t("town") }}</th>
                  <th>{{ $t("Resource") }}</th>
                  <th>{{ $t("Total demand") }}</th>
                  <th>{{ $t("Free and paid capacity") }}</th>
                  <th>{{ $t("Capacity from houses") }}</th>
                  <th>{{ $t("Total available capacity") }}</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="town in allEmpireTowns" :key="town.key">
                  <tr>
                    <td rowspan="2">{{ townName(town.key) }}</td>
                    <td>{{ $t("lodging") }}</td>
                    <td>{{ display(town.demand.workers) }}</td>
                    <td>{{ display(town.demand.freeBeds) }}</td>
                    <td>{{ display(town.result.lodging) }}</td>
                    <td>{{ display(town.totalBeds) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t("storage") }}</td>
                    <td>{{ display(town.demand.storage) }}</td>
                    <td>{{ display(town.demand.freeStorage) }}</td>
                    <td>{{ display(town.result.storage) }}</td>
                    <td>{{ display(town.totalStorage) }}</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <template v-if="!trial">
        <details
          :key="allTownsView ? 'all' : 'town'"
          class="town-overview"
          :open="!allTownsView"
        >
          <summary>{{ $t("Town housing overview") }}</summary>
          <label v-if="!allTownsView" class="inline"
            ><input v-model="showAllTowns" type="checkbox" />{{
              $t("Show all towns")
            }}</label
          >
          <p class="muted">
            {{
              $t(
                "Workshop houses follow the workshop town; storage follows the worker home town."
              )
            }}
          </p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{{ $t("town") }}</th>
                  <th>{{ $t("Custom house use") }}</th>
                  <th>{{ $t("Working workshop") }}</th>
                  <th>{{ $t("Workshop storage") }}</th>
                  <th>{{ $t("Settings status") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="town in townOverview"
                  :key="town.key"
                  :class="{ selected: !allTownsView && town.key === tk }"
                >
                  <td>
                    <button @click="tk = town.key">
                      {{ townName(town.key) }}
                    </button>
                  </td>
                  <td>{{ town.manual }}</td>
                  <td>{{ town.workshops }}</td>
                  <td>
                    {{
                      town.stockWorkshops
                        ? town.ready
                          ? $t("Ready")
                          : $t("Review required")
                        : "—"
                    }}
                  </td>
                  <td>
                    {{
                      town.dirty ? $t("Unsaved draft") : $t("Saved settings")
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
        <section
          v-if="allTownsView"
          id="all-housing-settings"
          class="panel all-town-uses"
        >
          <h2>{{ $t("Reserved house uses") }} · {{ $t("All towns") }}</h2>
          <p>
            {{
              $t("Choose a town in the overview to edit its housing settings.")
            }}
          </p>
          <p v-if="dirtyTowns.length" class="notice" role="status">
            {{ $t("Unsaved settings in these towns") }}:
            {{ dirtyTowns.map(townName).join(", ") }}
          </p>
          <p v-if="!allReservedRows.length">
            {{ $t("No reserved house uses") }}
          </p>
          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{{ $t("town") }}</th>
                  <th>{{ $t("House") }}</th>
                  <th>{{ $t("Keep this use") }}</th>
                  <th>{{ $t("CP") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in allReservedRows" :key="row.hk">
                  <td>
                    <button @click="tk = row.house.affTown">
                      {{ townName(row.house.affTown) }}
                    </button>
                  </td>
                  <td>{{ name(row.hk) }}</td>
                  <td>
                    {{ useName(row.usage)
                    }}<small>{{
                      row.automatic
                        ? $t("Working workshop")
                        : $t("Custom house use")
                    }}</small>
                  </td>
                  <td>{{ row.house.CP }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="all-workshop-storage">
            <h2>{{ $t("Workshop storage") }} · {{ $t("All towns") }}</h2>
            <p v-if="!workshopStorageTowns.length">
              {{ $t("No active workshop storage requirements.") }}
            </p>
            <WorkshopStorage
              v-for="town in workshopStorageTowns"
              :key="town.townKey"
              :town-key="town.townKey"
              :settings-user="settingsUser"
              @update:storage="
                updateEmpire({ workshopStorage: $event }, town.townKey)
              "
              @update:settings="updateEmpire($event, town.townKey)"
            />
          </div>
          <button
            v-if="workbench.savedUndo"
            @click="act(() => workbench.undoSavedEmpire())"
          >
            {{ $t("Undo saved empire housing settings") }}
          </button>
          <button
            v-if="dirtyTowns.length"
            class="primary"
            :disabled="optimizer.running"
            @click="saveEmpire"
          >
            {{
              $t("Save all {count} towns and return", {
                count: dirtyTowns.length,
              })
            }}
          </button>
        </section>
        <section v-else class="panel">
          <h2>{{ $t("Empire housing settings") }} · {{ townName(tk) }}</h2>
          <p v-if="dirtyTowns.length" class="notice" role="status">
            {{ $t("Unsaved settings in these towns") }}:
            {{ dirtyTowns.map(townName).join(", ") }}
          </p>
          <HousingReservationsEditor
            :key="'empire:' + tk"
            :town-key="tk"
            :reservations="empireEntry.settings.houseReservations"
            :automatic="townReservations(game.houseInfo, automatic, tk)"
            @update:reservations="updateEmpire({ houseReservations: $event })"
          />
          <WorkshopStorage
            :town-key="tk"
            :settings-user="settingsUser"
            @update:storage="updateEmpire({ workshopStorage: $event })"
            @update:settings="updateEmpire($event)"
          />
          <div class="controls">
            <button
              :disabled="
                !Object.keys(empireEntry.settings.houseReservations).length
              "
              @click="
                act(
                  () => workbench.resetEmpire(tk),
                  'Town manual uses cleared in the draft; save to apply.'
                )
              "
            >
              {{ $t("Reset this town manual uses") }}
            </button>
            <button
              v-if="empireEntry.undo"
              @click="act(() => workbench.undoEmpire(tk))"
            >
              {{ $t("Undo draft change") }}
            </button>
            <button
              v-if="dirty"
              @click="act(() => workbench.discardEmpire(tk))"
            >
              {{ $t("Reload saved town settings") }}
            </button>
          </div>
          <p class="muted">
            {{
              $t(
                "Reset only clears this town manual uses in the draft. Working workshops and storage settings are kept."
              )
            }}
          </p>
          <button
            class="primary save-empire"
            :disabled="optimizer.running || !dirtyTowns.length"
            @click="saveEmpire"
          >
            {{
              $t("Save all {count} towns and return", {
                count: dirtyTowns.length,
              })
            }}
          </button>
          <button
            v-if="workbench.savedUndo"
            @click="act(() => workbench.undoSavedEmpire())"
          >
            {{ $t("Undo saved empire housing settings") }}
          </button>
        </section>
      </template>
      <section v-else class="panel trial-inputs">
        <h2>{{ $t("Trial requirements") }} · {{ townName(tk) }}</h2>
        <div class="controls">
          <label
            >{{ $t("Total workers needing beds")
            }}<input
              :value="trialEntry.inputs.workers"
              type="number"
              min="0"
              max="1000"
              @input="updateTrial('workers', $event.target.valueAsNumber)"
          /></label>
          <label
            >{{ $t("Total storage slots needed")
            }}<input
              :value="trialEntry.inputs.storage"
              type="number"
              min="0"
              max="192"
              @input="updateTrial('storage', $event.target.valueAsNumber)"
          /></label>
          <button
            @click="
              act(
                () => workbench.copyEmpire(tk),
                'Empire settings copied once; further trial edits stay independent.'
              )
            "
          >
            {{ $t("Copy from empire") }}
          </button>
        </div>
        <details class="capacity-inputs">
          <summary>{{ $t("Free and paid capacity for this trial") }}</summary>
          <p>{{ $t("These capacities affect only this trial.") }}</p>
          <div class="controls">
            <label
              >{{ $t("Free beds")
              }}<input
                :value="trialEntry.inputs.freeBeds"
                type="number"
                min="0"
                max="1000"
                @input="updateTrial('freeBeds', $event.target.valueAsNumber)"
            /></label>
            <label
              >{{ $t("Paid beds")
              }}<input
                :value="trialEntry.inputs.paidBeds"
                type="number"
                min="0"
                max="1000"
                @input="updateTrial('paidBeds', $event.target.valueAsNumber)"
            /></label>
            <label
              >{{ $t("Free storage slots")
              }}<input
                :value="trialEntry.inputs.freeStorage"
                type="number"
                min="0"
                max="192"
                @input="
                  updateTrial('freeStorage', $event.target.valueAsNumber)
                "
            /></label>
            <label
              >{{ $t("Paid storage slots")
              }}<input
                :value="trialEntry.inputs.paidStorage"
                type="number"
                min="0"
                max="192"
                @input="
                  updateTrial('paidStorage', $event.target.valueAsNumber)
                "
            /></label>
          </div>
        </details>
        <div v-if="inputDemand" class="deductions">
          <p>
            {{ $t("Required beds from houses") }}:
            {{ inputDemand.workerCount }} −
            {{ Math.min(inputDemand.workerCount, inputDemand.baseLodging) }} =
            <strong>{{ inputDemand.wantLodging }}</strong>
          </p>
          <p>
            {{ $t("Required storage from houses") }}:
            {{ inputDemand.storageCount }} −
            {{ Math.min(inputDemand.storageCount, inputDemand.baseStorage) }} =
            <strong>{{ inputDemand.wantStorage }}</strong>
          </p>
        </div>
        <p v-else role="alert">{{ $t("Housing demand is invalid") }}</p>
        <HousingReservationsEditor
          :key="'trial:' + tk"
          :town-key="tk"
          :reservations="trialEntry.inputs.reservations"
          @update:reservations="updateTrial('reservations', $event)"
        />
        <div class="controls">
          <button
            class="primary"
            :disabled="!inputDemand || running"
            @click="act(() => workbench.runTrial(tk))"
          >
            {{ $t("Start housing trial") }}
          </button>
          <button
            @click="
              act(
                () => workbench.resetTrial(tk),
                'Current trial reset; saved trial records are kept.'
              )
            "
          >
            {{ $t("Reset current trial") }}
          </button>
          <button
            v-if="trialEntry.undo"
            @click="act(() => workbench.undoTrial(tk))"
          >
            {{ $t("Undo trial change") }}
          </button>
        </div>
        <details v-if="saved" class="saved-trial">
          <summary>
            {{ $t("Saved trial for this town") }} · {{ display(saved.cost) }}
            {{ $t("CP") }}
          </summary>
          <p>
            {{
              $t(
                "Saved trials are local comparison records and do not allocate empire housing."
              )
            }}
          </p>
          <p v-if="!saved.trialInputs">
            {{
              $t(
                "This is an older saved preview. Load its requirements and calculate again to use the new trial settings."
              )
            }}
          </p>
          <button @click="act(() => workbench.loadTrial(tk))">
            {{ $t("Load saved trial inputs") }}
          </button>
          <button @click="act(() => workbench.deleteTrial(tk))">
            {{ $t("Delete saved trial") }}
          </button>
        </details>
        <button
          v-if="tk in workbench.recordUndo"
          @click="act(() => workbench.undoTrialRecord(tk))"
        >
          {{ $t("Undo saved trial change") }}
        </button>
      </section>
      <p v-if="notice" role="status">{{ $t(notice) }}</p>
      <p v-if="actionError" role="alert">{{ $t(actionError) }}</p>

      <template v-if="!allTownsView">
        <h2>
          {{ trial ? $t("Trial result") : $t("Housing used by the empire") }}
        </h2>
        <template v-if="!trial">
          <p>
            {{
              source
                ? source.preview
                  ? $t("Housing from the empire preview")
                  : $t("Housing from the applied empire")
                : $t("Housing required by the current workers and storage")
            }}
          </p>
          <p v-if="dirtyTowns.length" class="notice">
            {{
              $t(
                "The housing below uses saved settings. Save the draft and re-optimize to include your changes."
              )
            }}
          </p>
          <p v-if="staleEmpire" class="notice">
            {{
              $t(
                "House uses or empire requirements changed. Re-optimize to update the complete plan."
              )
            }}
          </p>
        </template>
        <p v-if="resultStale" class="notice" role="status">
          {{
            $t(
              "Trial inputs changed. The result below is from the previous calculation; start the trial again."
            )
          }}
        </p>
        <p v-if="!result && trial">
          {{
            $t("Set requirements, then start the trial to see a housing plan.")
          }}
        </p>
        <p v-if="result?.pending || running" role="status">
          {{ $t("Calculating housing") }}
          <button @click="housing.stop(result.sourceKey)">
            {{ $t("Stop housing calculation") }}
          </button>
        </p>
        <p v-if="result?.error" role="alert">
          {{ $t(result.error) }}
          <button v-if="result.sourceKey" @click="retry">
            {{ $t("Retry housing calculation") }}
          </button>
        </p>
        <section v-if="result?.success" class="result">
          <div class="summary-cards">
            <div>
              <span>{{ $t("Housing CP") }}</span
              ><strong>{{ display(result.cost) }}</strong>
            </div>
            <div>
              <span>{{ $t("Beds needed / available") }}</span
              ><strong
                >{{ display(demand.workers) }} /
                {{ display(totalBeds) }}</strong
              >
            </div>
            <div>
              <span>{{ $t("Storage needed / available") }}</span
              ><strong
                >{{ display(demand.storage) }} /
                {{ display(totalStorage) }}</strong
              >
            </div>
          </div>
          <p v-if="!trial && source">
            {{
              $t("This housing cost is already included in the empire budget.")
            }}
          </p>
          <p
            v-if="
              trial &&
              (result.status === 'time_limit' || result.status === 'stopped')
            "
          >
            {{ $t("Feasible housing plan; minimum cost has not been proved.") }}
          </p>
          <p v-else-if="trial && !running">
            {{
              $t(
                "Minimum housing cost for these requirements and reservations."
              )
            }}
          </p>
          <div v-if="trial" class="controls">
            <button
              :disabled="running || resultStale"
              @click="act(() => workbench.saveTrial(tk), 'Housing plan saved')"
            >
              {{ $t("Save trial record") }}
            </button>
            <span>{{
              $t("Saving a trial does not change empire settings or workers.")
            }}</span>
          </div>
          <details v-if="trial && changes" class="comparison">
            <summary>
              {{ $t("Compared with saved housing plan") }}:
              {{ display(result.cost - saved.cost) }} {{ $t("CP") }}
            </summary>
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
          </details>
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
                      row.automatic
                        ? $t("Working workshop")
                        : useName(row.usage)
                    }}<small>{{
                      (
                        trial
                          ? result.reservations?.[row.hk]
                          : user.houseReservations[row.hk]
                      )
                        ? $t("Custom house use")
                        : $t("Automatically planned")
                    }}</small>
                  </td>
                  <td>{{ row.house.CP }}</td>
                  <td>
                    {{
                      row.house.needHouseKey
                        ? name(row.house.needHouseKey)
                        : "—"
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <details class="capacity-details">
            <summary>{{ $t("Capacity details") }}</summary>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{{ $t("Resource") }}</th>
                    <th>{{ $t("Total demand") }}</th>
                    <th>{{ $t("Free and paid capacity") }}</th>
                    <th>{{ $t("Capacity from houses") }}</th>
                    <th>{{ $t("Total available capacity") }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{{ $t("lodging") }}</td>
                    <td>{{ display(demand.workers) }}</td>
                    <td>{{ display(demand.freeBeds) }}</td>
                    <td>{{ display(result.lodging) }}</td>
                    <td>{{ display(totalBeds) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t("storage") }}</td>
                    <td>{{ display(demand.storage) }}</td>
                    <td>{{ display(demand.freeStorage) }}</td>
                    <td>{{ display(result.storage) }}</td>
                    <td>{{ display(totalStorage) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <p v-else-if="result && !result.pending && !result.error" role="alert">
          {{ $t("No housing plan satisfies these reservations") }}
        </p>
      </template>
      <details id="housing-graph" @toggle="graphOpen = $event.target.open">
        <summary>{{ $t("House prerequisite diagram") }}</summary>
        <HousingGraph
          v-if="graphOpen"
          class="chart"
          :option="chartOption"
        />
      </details>
      <details class="algorithm-info">
        <summary>{{ $t("Planning rules and data source") }}</summary>
        <p>
          {{
            $t(
              "Ordinary towns use precomputed plans. Towns with reserved uses or working workshops are solved house by house."
            )
          }}
        </p>
        <p v-if="!allTownsView && result">
          {{ $t("Housing planning method") }}:
          {{
            $t(
              result.housingMethod === "solve"
                ? "Housing calculated with reserved uses"
                : "Precomputed housing plan"
            )
          }}
        </p>
        <p>
          {{ $t("data from") }}
          <a href="https://github.com/Thell/bdo-housecraft"
            >Thell/bdo-housecraft</a
          >
        </p>
      </details>
    </section>
  </main>
</template>
<style scoped>
.housecraft {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1rem;
}
.tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid #888;
  padding-bottom: 0.6rem;
}
.tabs button {
  padding: 0.6rem 1rem;
}
.tabs .active {
  font-weight: bold;
  border: 2px solid #78b8ee;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  align-items: end;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}
.inline {
  flex-direction: row;
  align-items: center;
  margin: 0.7rem 0;
}
input[type="number"] {
  width: 7rem;
}
select {
  max-width: 100%;
}
.panel,
.result {
  border: 1px solid #888;
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1rem 0;
}
.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}
.summary-cards > div {
  border: 1px solid #888;
  padding: 0.8rem;
  border-radius: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.summary-cards strong {
  font-size: 1.5rem;
}
.primary {
  font-weight: bold;
  border-color: #197957;
}
.save-empire {
  margin: 0.7rem 0.7rem 0 0;
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
small {
  display: block;
}
.selected td {
  background: #8882;
}
details {
  margin: 1rem 0;
}
summary {
  cursor: pointer;
}
p {
  margin: 0.7rem 0;
}
.notice {
  border-left: 3px solid #e9b85c;
  padding: 0.5rem 0.8rem;
  background: #e9b85c12;
}
.muted {
  opacity: 0.8;
  font-size: 0.9rem;
}
p[role="alert"] {
  color: #c44;
}
.chart {
  height: 480px;
  width: 100%;
}
@media (max-width: 600px) {
  .housecraft {
    padding: 0.5rem;
  }
  .panel,
  .result {
    padding: 0.7rem;
  }
  .summary-cards {
    grid-template-columns: 1fr;
  }
  .controls > label {
    max-width: 100%;
  }
  .chart {
    height: 340px;
  }
  .tabs button {
    flex: 1;
    padding: 0.6rem;
  }
}
</style>

<style scoped>
.all-town-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin: 1rem 0;
}
#all-housing-results,
#all-housing-settings,
#housing-graph {
  scroll-margin-top: 1rem;
}
.all-workshop-storage {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}
.all-town-results .summary-cards {
  margin: 1rem 0;
}
.all-town-results h3 {
  margin: 1rem 0 0.5rem;
}
.all-town-capacity {
  min-width: 740px;
}
</style>
