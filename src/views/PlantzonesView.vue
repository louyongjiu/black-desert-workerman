<script>
import { useUserStore } from "../stores/user";
import { useGameStore } from "../stores/game";
import { useMarketStore } from "../stores/market";
import { useMapStore } from "../stores/map";
import { formatFixed } from "../util.js";
import PlantzonesRow from "../components/PlantzonesRow.vue";

export default {
  setup() {
    const userStore = useUserStore();
    const gameStore = useGameStore();
    const marketStore = useMarketStore();
    const mapStore = useMapStore();

    return { marketStore, userStore, gameStore, mapStore };
  },

  components: {
    PlantzonesRow,
  },

  data: () => ({
    wspd: 150,
    mspd: 10,
    luck: 10,
    showGiantValues: false,
    mediahNodes: new Set([
      1210, 1212, 1215, 1216, 1219, 1217, 1213, 1220, 1205, 1218,
    ]), // these have routing overridden
    towns: [-1],
    filterTown: -1,
    hideTaken: false,
    detailedColumns: false,
    nodeSearch: "",
    highlightPending: false,
  }),
  watch: {
    "$route.hash": {
      immediate: true,
      handler(hash) {
        this.highlightPending = /^#drops\d+$/.test(hash);
        if (this.highlightPending) {
          this.nodeSearch = "";
          this.filterTown = -1;
          this.hideTaken = false;
          this.$nextTick(this.highlightHash);
        }
      },
    },
  },
  methods: {
    formatFixed,

    highlightHash() {
      if (this.highlightPending && this.$route.hash) {
        const el = document.getElementById(this.$route.hash.slice(1));
        if (el) {
          this.highlightPending = false;
          el.scrollIntoView();
          el.classList.add("anim");
        }
      }
    },

    setMedianChar(charkey) {
      if (!charkey) return;
      const stat = this.gameStore.workerStatic[charkey];
      let pa_wspd = stat.wspd;
      let pa_mspdBonus = 0;
      let pa_luck = stat.luck;
      for (let i = 2; i <= 40; i++) {
        pa_wspd += (stat.wspd_lo + stat.wspd_hi) / 2;
        pa_mspdBonus += (stat.mspd_lo + stat.mspd_hi) / 2;
        pa_luck += (stat.luck_lo + stat.luck_hi) / 2;
      }

      let pa_mspd = stat.mspd * (1 + pa_mspdBonus / 1e6);

      this.wspd = Math.round((pa_wspd / 1e6) * 100) / 100;
      this.mspd = Math.round(pa_mspd) / 100;
      this.luck = Math.round((pa_luck / 1e4) * 100) / 100;
      this.isGiant = this.gameStore.isGiant(charkey);
    },
  },

  computed: {
    nearestTownCandidates() {
      if (!this.gameStore.ready) return {};
      return Object.fromEntries(
        Object.keys(this.gameStore.plantzoneDrops).map((key) => {
          const pzk = Number(key);
          const townLimit = this.mediahNodes.has(pzk) ? 3 : 2;
          const towns = this.gameStore.dijkstraNearestTowns(
            pzk,
            townLimit,
            undefined,
            true,
            false,
            true
          );
          towns.sort((a, b) => a[1] - b[1]);
          return [pzk, towns];
        })
      );
    },

    allPlantzonesNearestCpTownProfit() {
      const start = Date.now();
      const ret = [];
      for (const pzd of Object.values(this.gameStore.plantzones)) {
        const pzk = pzd.key;

        // some mediah nodes need deeper search to prevent suggesting Iliya
        const towns = this.nearestTownCandidates[pzk];
        //if (pzk == 1046) console.log(`allPlantzonesNearestCpTownProfit pzk=${pzk} towns:`, towns)

        let workData = {};
        let alt_towns_profits = {};
        for (const townPath of Object.values(towns)) {
          const [tnk, cp] = townPath;
          const tempData = this.gameStore.profitPzTownArtisans(pzk, tnk, cp);
          //if (pzk == 1046) console.log(`allPlantzonesNearestCpTownProfit pzk=${pzk}`, tnk, tempData)
          if (tnk == 1343) continue; // skip Ancado
          if (tempData.connected) {
            alt_towns_profits[tempData.tnk] = tempData.dailyPerCp;
            if (!("priceDaily" in workData)) {
              workData = tempData;
              continue;
            }
            if (tempData.dailyPerCp > workData.dailyPerCp) {
              workData = tempData;
            }
          }
        }
        if (!("alt_workers" in workData)) {
          console.log(workData);
          throw new Error(`Failed to calc alt_workers for pzk=${pzk}`);
        }
        const alt_towns = Object.entries(alt_towns_profits).map(
          ([tnk, dailyPerCp]) => ({ tnk, dailyPerCp })
        );
        alt_towns.sort((a, b) => b.dailyPerCp - a.dailyPerCp); // without lodgage
        workData.alt_towns_profits = alt_towns_profits;
        workData.alt_towns = alt_towns;
        ret.push(workData);
      }
      console.log(
        "cpt: plantzonesNearestCpTownProfit took",
        Date.now() - start,
        "ms"
      );
      return ret;
    },

    rankedPlantzones() {
      return [...this.allPlantzonesNearestCpTownProfit].sort((a, b) => {
        if (isFinite(b.dailyPerCp - a.dailyPerCp)) return b.dailyPerCp - a.dailyPerCp;
        return isFinite(a.dailyPerCp) ? -1 : 1;
      });
    },

    plantzoneSearchText() {
      return Object.fromEntries(this.rankedPlantzones.map(e => [e.key, [
        this.gameStore.plantzoneName(e.key), String(e.key), this.gameStore.nodeName(e.tnk),
        ...Object.keys({ ...e.unlucky, ...e.lucky }).map(ik => this.gameStore.uloc.item[ik] || ''),
      ].map(name => name.toLocaleLowerCase())]));
    },

    allPlantzonesNearestCpTownProfit_sorted() {
      const query = this.nodeSearch.trim().toLocaleLowerCase();
      return this.rankedPlantzones.filter(e => {
        if (query && !this.plantzoneSearchText[e.key].some(name => name.includes(query))) return false;
        if (this.filterTown != -1 && e.tnk != this.filterTown) return false;
        return !(this.hideTaken && this.userStore.workedPlantzones.has(e.key.toString()));
      });
    },

    townsFilter() {
      return this.gameStore.townsWithLodging.map((tnk) =>
        tnk == 1343 ? -1 : tnk
      );
    },
  },

  mounted() {
    this.highlightHash();
  },
  updated() {
    this.$nextTick(() => this.highlightHash());
  },
};
</script>

<template>
  <main>
    <div id="toptext">
      <h1>{{ $t("Plantzones") }}</h1>
      <details class="calculation-help">
        <summary>{{ $t("Advanced") }}</summary>
        <p>
          {{
            $t(
              "Profits here are calculated using average level 40 stats for artisan workers at corresponding town (papu/dokkebi/etc), with only one skill (+5🔨). Home page has more tiers, levels, and skills."
            )
          }}
        </p>
        <p>
          {{
            $t(
              "Note that CP costs shown here are independent for each node. In practice however, multiple resource nodes can reuse the same town connection, resulting in higher combined $/CP."
            )
          }}
        </p>
        <p>
          {{
            $t(
              "For example, taking both Shakatu Fig nodes should not be 3+3 but 3+1 CP. Use Home page instead of Plantzones to take into account connection reuse (and also lodging/storage costs)."
            )
          }}
        </p>
        <p>
          {{
            $t(
              "Don't forget to set up your server and prices on Settings page and maybe take a look at Resources as well. 👺=goblin, 👨=human, 🐢=giant, hover for more info"
            )
          }}
        </p>
      </details>
      <div class="plantzone-tools">
        <label
          >{{ $t("Search nodes, items or towns")
          }}<input
            v-model="nodeSearch"
            type="search"
            :placeholder="$t('Search...')"
        /></label>
        <label
          >{{ $t("Only show entries with best town =") }}
          <select v-model="filterTown">
            <option v-for="tnk in townsFilter" :value="tnk">
              {{ tnk >= 0 ? gameStore.nodeName(tnk) : $t("any") }}
            </option>
          </select></label
        >
        <label class="inline-check"
          ><input type="checkbox" v-model="hideTaken" />{{
            $t("hide taken")
          }}</label
        >
        <label class="inline-check"
          ><input type="checkbox" v-model="detailedColumns" />{{
            $t("Detailed columns")
          }}</label
        >
      </div>
    </div>

    <div
      class="table-scroll plantzone-table"
      tabindex="0"
      :aria-label="$t('Plantzones')"
    >
      <table class="stickyhead">
        <thead>
          <tr>
            <th rowspan="2">{{ $t("Node") }}</th>
            <th :colspan="detailedColumns ? 3 : 2">{{ $t("daily") }}</th>
            <th v-if="detailedColumns" colspan="3">
              {{ $t("cycle drops") }}
              <span class="fss"
                >[<input type="checkbox" v-model="showGiantValues" />
                {{ $t("as giant]") }}</span
              >
            </th>
            <th :colspan="detailedColumns ? 3 : 2">{{ $t("best town") }}</th>
            <th :colspan="detailedColumns ? 2 : 1">{{ $t("best worker") }}</th>
            <th v-if="detailedColumns" rowspan="2">{{ $t("workload") }}</th>
            <th rowspan="2" v-if="userStore.workedPlantzones.size">
              <abbr
                class="tooltip nound"
                :title="
                  $t(
                    'assigned on Home page?\n  (hover for details)\n  \'X% better\' does not consider:\n  - worker stats\n  - worker skills\n  - connection reuse\n  - lodging and storage'
                  )
                "
                >🏠</abbr
              >
            </th>
          </tr>
          <tr>
            <th v-if="detailedColumns" class="colspanned">
              {{ $t("cycles") }}
            </th>
            <th class="colspanned">{{ $t("Daily silver · millions") }}</th>
            <th class="colspanned">{{ $t("Silver per CP · millions/day") }}</th>
            <!--Node-->
            <th v-if="detailedColumns" class="rowspanned colspanned">
              {{ $t("unlucky") }}
            </th>
            <th v-if="detailedColumns" class="colspanned">
              {{ $t("lucky") }}
              <abbr
                :title="
                  $t(
                    'you always get unlucky items;\n  these are ADDITIONAL, with\n    chance equal to luck stat'
                  )
                "
                class="tooltip"
                >ℹ</abbr
              >
            </th>
            <th v-if="detailedColumns" class="colspanned">
              {{ $t("$ value") }}
            </th>
            <th class="colspanned">{{ $t("name") }}</th>
            <th v-if="detailedColumns" class="colspanned">{{ $t("walk") }}</th>
            <th class="colspanned">{{ $t("CP") }}</th>
            <th class="colspanned">{{ $t("type") }}</th>
            <th v-if="detailedColumns" class="colspanned">{{ $t("wspd") }}</th>
            <!--taken-->
          </tr>
        </thead>
        <tbody>
          <PlantzonesRow
            v-for="e in allPlantzonesNearestCpTownProfit_sorted"
            :id="'drops' + e.key"
            :e="e"
            :showGiantValues="showGiantValues"
            :detailed-columns="detailedColumns"
          />
        </tbody>
      </table>
    </div>
  </main>
</template>

<style scoped>
.inside {
  font-size: 5px;
  position: absolute;
  bottom: 6px;
  left: 6px;
  z-index: -2;
}

.anim {
  background-color: var(--color-background);
  animation-name: highlight;
  animation-duration: 2s;
}

@keyframes highlight {
  0% {
    background-color: var(--color-background);
  }
  50% {
    background-color: hsla(160, 100%, 37%, 0.3);
  }
  100% {
    background-color: var(--color-background);
  }
}
.tooltip {
  cursor: help;
}
</style>

<style scoped>
h1 {
  font-size: 1.6rem;
  margin-bottom: 0.7rem;
}
.calculation-help {
  margin: 0.7rem 0;
}
.calculation-help p {
  margin: 0.5rem 0;
}
.plantzone-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.8rem;
  margin: 1rem 0;
}
.plantzone-tools label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.plantzone-tools .inline-check {
  flex-direction: row;
  align-items: center;
}
.plantzone-table {
  max-height: 75vh;
}
.plantzone-table table {
  min-width: 650px;
  width: 100%;
}
.plantzone-table th {
  padding: 0.5rem;
}
.plantzone-table thead tr:first-child th:first-child,
.plantzone-table :deep(td:first-child) {
  min-width: 140px;
  max-width: 180px;
}
.plantzone-table :deep(td) {
  padding: 0.45rem;
}
@media (max-width: 600px) {
  .plantzone-tools label:first-child {
    width: 100%;
  }
  .plantzone-table th:first-child,
  .plantzone-table :deep(td:first-child) {
    min-width: 120px;
    max-width: 140px;
  }
}
</style>
