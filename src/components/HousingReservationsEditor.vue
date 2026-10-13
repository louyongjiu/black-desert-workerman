<script setup>
import { computed, ref } from "vue";
import { useGameStore } from "../stores/game";
const props = defineProps({
  townKey: { type: Number, required: true },
  reservations: { type: Object, required: true },
  automatic: { type: Object, default: () => ({}) },
});
const emit = defineEmits(["update:reservations"]);
const game = useGameStore(),
  search = ref(""),
  selected = ref(""),
  usage = ref("0");
const name = (hk) => game.uloc.char[hk] || String(hk);
const houses = computed(() =>
  Object.values(game.houseInfo).filter(
    (h) => Number(h.affTown) === props.townKey
  )
);
const reserved = computed(() =>
  Object.keys({ ...props.reservations, ...props.automatic })
    .map((hk) => ({
      hk,
      house: game.houseInfo[hk],
      value: props.automatic[hk] || props.reservations[hk],
      locked: Boolean(props.automatic[hk]),
    }))
    .filter((r) => r.house)
    .sort((a, b) => name(a.hk).localeCompare(name(b.hk)))
);
const available = computed(() =>
  houses.value
    .filter(
      (h) =>
        !props.reservations[h.key] &&
        !props.automatic[h.key] &&
        `${name(h.key)} ${h.key}`
          .toLowerCase()
          .includes(search.value.toLowerCase())
    )
    .sort((a, b) => name(a.key).localeCompare(name(b.key)))
    .slice(0, 30)
);
const selectedHouse = computed(() => game.houseInfo[selected.value]);
function edit(hk, value) {
  const next = { ...props.reservations };
  if (value === "") delete next[hk];
  else next[hk] = { usage: Number(value) };
  emit("update:reservations", next);
}
function add() {
  const h = selectedHouse.value;
  if (!h || Number(h.affTown) !== props.townKey || props.automatic[h.key])
    return;
  const u =
    usage.value in h.CraftList ? usage.value : Object.keys(h.CraftList)[0];
  edit(h.key, u);
  selected.value = "";
  search.value = "";
}
</script>
<template>
  <section class="reservations-editor">
    <h3>{{ $t("Reserved house uses") }}</h3>
    <p v-if="Object.keys(automatic).length">
      {{
        $t(
          "Working workshops are reserved automatically and cannot be changed here."
        )
      }}
    </p>
    <p v-if="!reserved.length">
      {{ $t("No reserved house uses in this town") }}
    </p>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ $t("House") }}</th>
            <th>{{ $t("Keep this use") }}</th>
            <th>{{ $t("CP") }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in reserved" :key="row.hk">
            <td>{{ name(row.hk) }}</td>
            <td v-if="row.locked">
              {{ game.uloc.housetype[row.value.usage] || row.value.usage }}
              <small>{{ $t("Working workshop") }}</small>
            </td>
            <td v-else>
              <select
                :value="row.value.usage ?? row.value"
                :aria-label="$t('Keep this use') + ' ' + name(row.hk)"
                @change="edit(row.hk, $event.target.value)"
              >
                <option
                  v-for="(level, use) in row.house.CraftList"
                  :key="use"
                  :value="use"
                >
                  {{ game.uloc.housetype[use] || use }} {{ level }}
                </option>
              </select>
            </td>
            <td>{{ row.house.CP }}</td>
            <td>
              <button v-if="!row.locked" @click="edit(row.hk, '')">
                {{ $t("Remove reserved use") }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <details class="add-house">
      <summary>{{ $t("Add a reserved house use") }}</summary>
      <div class="controls">
        <label
          >{{ $t("Search houses") }}<input v-model="search" type="search"
        /></label>
        <label
          >{{ $t("House")
          }}<select v-model="selected">
            <option value="">{{ $t("Select a house") }}</option>
            <option v-for="h in available" :key="h.key" :value="String(h.key)">
              {{ name(h.key) }} · {{ h.CP }} {{ $t("CP") }}
            </option>
          </select></label
        >
        <label v-if="selectedHouse"
          >{{ $t("Keep this use")
          }}<select v-model="usage">
            <option
              v-for="(level, use) in selectedHouse.CraftList"
              :key="use"
              :value="use"
            >
              {{ game.uloc.housetype[use] || use }} {{ level }}
            </option>
          </select></label
        >
        <button :disabled="!selectedHouse" @click="add">
          {{ $t("Add reserved use") }}
        </button>
      </div>
      <p>
        {{ $t("Search by house name or number; up to 30 matches are shown.") }}
      </p>
    </details>
  </section>
</template>
<style scoped>
.reservations-editor {
  margin: 1rem 0;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: end;
  margin: 0.7rem 0;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}
input,
select {
  max-width: 100%;
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
summary {
  cursor: pointer;
}
</style>
