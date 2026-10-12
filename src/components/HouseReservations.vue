<script setup>
import { computed, ref } from "vue";
import { useGameStore } from "../stores/game";
import { useUserStore } from "../stores/user";
import { useHousingStore } from "../stores/housing";
const props = defineProps({ townKey: { type: Number, required: true } });
const game = useGameStore(),
  user = useUserStore(),
  housing = useHousingStore(),
  error = ref("");
const houses = computed(() =>
  Object.values(game.houseInfo)
    .filter((h) => Number(h.affTown) === props.townKey)
    .sort((a, b) =>
      (game.uloc.char[a.key] || String(a.key)).localeCompare(
        game.uloc.char[b.key] || String(b.key)
      )
    )
);
const automatic = computed(
  () =>
    new Set(
      user.userWorkers
        .filter((w) => w.job?.kind === "workshop")
        .map((w) => Number(w.job.hk))
    )
);
function reserve(key, event) {
  try {
    housing.reserve(key, event.target.value);
    error.value = "";
  } catch (e) {
    error.value = e.message;
    event.target.value = user.houseReservations[key]?.usage ?? "";
  }
}
</script>
<template>
  <details class="reservations">
    <summary>{{ $t("Reserved house uses") }}</summary>
    <p>
      {{
        $t(
          "Working workshops are reserved automatically. Other houses can keep a selected use."
        )
      }}
    </p>
    <p v-if="error" role="alert">{{ $t(error) }}</p>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>{{ $t("House") }}</th>
            <th>{{ $t("CP") }}</th>
            <th>{{ $t("Keep this use") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="house in houses" :key="house.key">
            <td>
              {{ game.uloc.char[house.key] || house.key }}
              <small v-if="automatic.has(house.key)">{{
                $t("Working workshop")
              }}</small>
            </td>
            <td>{{ house.CP }}</td>
            <td>
              <select
                :aria-label="
                  $t('Keep this use') +
                  ' ' +
                  (game.uloc.char[house.key] || house.key)
                "
                :value="user.houseReservations[house.key]?.usage ?? ''"
                @change="reserve(house.key, $event)"
              >
                <option value="">
                  {{
                    automatic.has(house.key)
                      ? $t("Automatic workshop reservation")
                      : $t("Available for planning")
                  }}
                </option>
                <option
                  v-for="(level, usage) in house.CraftList"
                  :key="usage"
                  :value="usage"
                  :disabled="automatic.has(house.key) && Number(usage) <= 10"
                >
                  {{ game.uloc.housetype[Number(usage)] || usage }} {{ level }}
                </option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <button v-if="user.housingUndo" @click="housing.undo()">
      {{ $t("Undo housing change") }}
    </button>
    <button
      v-if="Object.keys(user.houseReservations).length"
      @click="housing.clearReservations()"
    >
      {{ $t("Clear all manual house reservations") }}
    </button>
  </details>
</template>
<style scoped>
.reservations {
  margin: 1rem 0;
}
summary {
  cursor: pointer;
}
.scroll {
  max-height: 24rem;
  overflow: auto;
}
table {
  width: 100%;
}
td {
  padding: 0.3rem;
}
small {
  display: block;
}
select {
  max-width: 100%;
}
p[role="alert"] {
  color: #f99;
}
</style>
