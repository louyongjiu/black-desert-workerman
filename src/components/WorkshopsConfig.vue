<script>
import WorkshopStorage from "./WorkshopStorage.vue";
import { useUserStore } from "../stores/user";
import { useGameStore } from "../stores/game";
import { formatFixed } from "../util.js";
import { useUiActionsStore } from "../stores/uiActions";

export default {
  setup() {
    const userStore = useUserStore();
    const gameStore = useGameStore();

    /*userStore.$subscribe((mutation, state) => {
      const start = Date.now()
      localStorage.setItem('user', JSON.stringify(state))
      console.log('userStore subscription took', Date.now()-start, 'ms')
    })*/

    return { gameStore, userStore };
  },

  components: { WorkshopStorage },
  props: {
    show: {
      type: Boolean,
      default: false,
    },
  },

  created() {
    this.fetchData();
  },

  data: () => ({
    houses: {},
    towns: [-1],
    usages: [-1],
    levels: [-1],
    filterTown: -1,
    filterUsage: -1,
    filterLevel: -1,
    selectedHouse: -1,
  }),

  computed: {
    filteredTowns() {
      const s = new Set([-1]);
      for (const [k, v] of Object.entries(this.houses))
        if (this.filterUsage == -1 || this.filterUsage in v.CraftList)
          if (
            this.filterLevel == -1 ||
            this.filterLevel <= v.CraftList[this.filterUsage]
          )
            if (v.affTown != 694) s.add(v.affTown);
      return [...s].sort((a, b) => a - b);
    },

    filteredUsages() {
      const s = new Set([-1]);
      for (const [k, v] of Object.entries(this.houses))
        if (this.filterTown == -1 || v.affTown == this.filterTown)
          for (const [u, l] of Object.entries(v.CraftList))
            if (u > 10) s.add(u);
      return [...s].sort((a, b) => a - b);
    },

    filteredLevels() {
      const s = new Set([-1]);
      if (this.filterUsage != -1) {
        for (const [k, v] of Object.entries(this.houses))
          if (this.filterTown == -1 || v.affTown == this.filterTown)
            if (this.filterUsage in v.CraftList)
              s.add(v.CraftList[this.filterUsage]);
      }
      return [...s].sort((a, b) => a - b);
    },

    filteredHouses() {
      const ret = [];
      for (const [k, v] of Object.entries(this.houses)) {
        if (this.filterTown == -1 || v.affTown == this.filterTown)
          if (this.filterUsage == -1 || this.filterUsage in v.CraftList)
            if (
              this.filterLevel == -1 ||
              this.filterLevel <= v.CraftList[this.filterUsage]
            )
              ret.push(Number(k));
      }
      //console.log('filteredHouses', ret)
      return ret;
    },
  },

  methods: {
    formatFixed,

    async fetchData() {
      this.houses = structuredClone(this.gameStore.houseInfo);
      const _towns = new Set([-1]);
      const _usages = new Set([-1]);
      for (const [hk, info] of Object.entries(this.houses)) {
        _towns.add(info.affTown);

        for (const [u, lvl] of Object.entries(info.CraftList)) {
          if (u > 10) _usages.add(u);
        }

        this.houses[hk].CPfull = this.houses[hk].CP;
        let dep = info.needHouseKey;
        while (dep) {
          this.houses[hk].CPfull += this.houses[dep].CP;
          dep = this.houses[dep].needHouseKey;
        }
      }
      this.towns = _towns;
      this.usages = [..._usages].sort((a, b) => a - b);
    },

    addWorkshop(hk) {
      this.userStore.userWorkshops[hk] = {
        ...this.userStore.defaultUserWorkshop,
      };
    },

    deleteWorkshop(hk) {
      useUiActionsStore().perform(["userWorkshops"], (state) => {
        delete state.userWorkshops[hk];
      });
    },

    deleteAll() {
      const occupied = new Set(
        this.userStore.userWorkers
          .filter((w) => w.job?.kind === "workshop")
          .map((w) => String(w.job.hk))
      );
      const unused = Object.keys(this.userStore.userWorkshops).filter(
        (hk) => !occupied.has(hk)
      );
      if (!unused.length) return;
      useUiActionsStore().request(
        "Remove {count} unused workshops?",
        { count: unused.length },
        ["userWorkshops"],
        (state) => {
          unused.forEach((hk) => delete state.userWorkshops[hk]);
        }
      );
    },
  },
};
</script>

<template>
  <h3>{{ $t("🏭Workshops config") }}</h3>

  <table class="sa">
    <tr>
      <th>{{ $t("House") }}</th>
      <th>
        {{ $t("label") }}
        <abbr class="tooltip" :title="$t('for display only')">ℹ</abbr>
      </th>
      <th>
        {{ $t("worktype") }}
        <abbr
          class="tooltip"
          :title="
            $t(
              'used to factor in some worker skills.\nalso, only Mass Production can employ multiple workers at once.'
            )
          "
          >ℹ</abbr
        >
      </th>
      <th>{{ $t("workload") }}</th>
      <th>
        {{ $t("$/cycle") }}
        <abbr
          :title="
            $t(
              'use Sho\'s Workshop Profitability Calculator &amp; gpw Trading/Crates Calculator to find out.\nFor crates, enter profit per 1 crate - if a worker with +1/+3 packing skill occupies this workshop it will be taken into account.'
            )
          "
          class="tooltip"
          >ℹ</abbr
        >
      </th>
      <th>
        {{ $t("CP") }}
        <abbr
          :title="
            $t('Shared prerequisite houses are counted once in housing costs.')
          "
          class="tooltip"
          >ℹ</abbr
        >
      </th>
      <th>{{ $t("action") }}</th>
    </tr>

    <tr v-for="(v, hk) in userStore.userWorkshops">
      <td>
        {{ gameStore.uloc.char[hk] }}
      </td>
      <td><input class="w5em" v-model.number="v.label" /></td>
      <td>
        <select v-model="v.industry">
          <option value="unk">{{ $t("unknown") }}</option>
          <option value="jewelry">{{ $t("jewelry") }}</option>
          <option value="mass">{{ $t("mass") }}</option>
          <option value="weap">{{ $t("weapon") }}</option>
          <option value="tool">{{ $t("tool") }}</option>
          <option value="furn">{{ $t("furniture") }}</option>
          <option value="costume">{{ $t("costume") }}</option>
          <option value="refine">{{ $t("refine") }}</option>
          <option value="siege">{{ $t("siege") }}</option>
          <option value="mount">{{ $t("mount") }}</option>
          <option value="exclus">{{ $t("exclusive") }}</option>
          <option value="pack_produce">{{ $t("pack_produce") }}</option>
          <option value="pack_herb">{{ $t("pack_herb") }}</option>
          <option value="pack_mushr">{{ $t("pack_mushr") }}</option>
          <option value="pack_fish">{{ $t("pack_fish") }}</option>
          <option value="pack_timber">{{ $t("pack_timber") }}</option>
          <option value="pack_ore">{{ $t("pack_ore") }}</option>
        </select>
      </td>
      <td>
        <input type="number" class="w5em" v-model.number="v.manualWorkload" />
      </td>
      <td>
        <input
          type="number"
          class="w7em"
          v-model.number="v.manualCycleIncome"
        />
      </td>
      <td
        :title="
          $t('Shared prerequisite houses are counted once in housing costs.')
        "
      >
        {{ houses[hk]?.CP }}
      </td>
      <td>
        <button @click="deleteWorkshop(hk)">{{ $t("delete") }}</button>
      </td>
    </tr>
  </table>

  <div style="float: right">
    <button @click="deleteAll()" :title="$t('except occupied')">
      {{ $t("Remove unused workshops") }}
    </button>
  </div>
  {{ $t("new entry:") }}<br />

  <table class="borderless">
    <tr>
      <td>{{ $t("town") }}</td>
      <td>
        <select v-model="filterTown">
          <option v-for="tk in filteredTowns" :value="tk">
            {{ tk >= 0 ? gameStore.uloc.town[tk] : $t("any") }}
          </option>
        </select>
      </td>
    </tr>
    <tr>
      <td>{{ $t("usage") }}</td>
      <td>
        <select v-model="filterUsage">
          <option v-for="u in filteredUsages" :value="u">
            {{ u >= 0 ? gameStore.uloc.housetype[u] + " " + u : $t("any") }}
          </option>
        </select>
      </td>
    </tr>
    <tr>
      <td>{{ $t("level") }}</td>
      <td>
        <select v-model="filterLevel">
          <option v-for="l in filteredLevels" :value="l">
            {{ l >= 0 ? l + "+" : $t("any") }}
          </option>
        </select>
      </td>
    </tr>
    <tr>
      <td>{{ $t("house") }}</td>
      <td>
        <select v-model="selectedHouse">
          <option v-for="hk in filteredHouses" :value="hk">
            {{ hk }} {{ gameStore.uloc.char[hk] }}
            {{ hk in userStore.userWorkshops ? "✔️" : "" }}
          </option>
        </select>
        <span v-if="selectedHouse in userStore.userWorkshops" class="fsxs">
          {{ $t("already in list!") }}
        </span>
      </td>
    </tr>
  </table>

  <button
    :disabled="selectedHouse == -1 || selectedHouse in userStore.userWorkshops"
    @click="addWorkshop(selectedHouse)"
  >
    {{ $t("add to my workshops") }}
  </button>

  {{}}
  <abbr
    class="tooltip"
    :title="
      $t(
        'Working workshops are reserved automatically. Other houses can keep a selected use.'
      )
    "
    >ℹ</abbr
  >
  <WorkshopStorage />
</template>

<style scoped>
.tooltip {
  cursor: help;
}
</style>
