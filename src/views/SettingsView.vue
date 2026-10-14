<script>
import ImportPreview from "../components/ImportPreview.vue";
import { useUiActionsStore } from "../stores/uiActions";
import { useGameStore } from "../stores/game";
import { useUserStore } from "../stores/user";
import { useMarketStore } from "../stores/market";
import { formatFixed } from "../util.js";
import ItemIcon from "../components/lo/ItemIcon.vue";
import ModalDialog from "../components/ModalDialog.vue";



import PriceInput from "../components/lo/PriceInputAbbrHeld.vue";
import { languages } from "../i18n/index.mjs";

import { localizedAsyncComponent } from "../i18n/asyncComponent";
const WorkerEdit = localizedAsyncComponent(() => import("../components/WorkerEdit.vue"), ["research"]);
const WorkshopsConfig = localizedAsyncComponent(() => import("../components/WorkshopsConfig.vue"));
const TradingConfig = localizedAsyncComponent(() => import("../components/TradingConfig.vue"));

export default {
  setup() {
    const gameStore = useGameStore();
    const userStore = useUserStore();
    const marketStore = useMarketStore();
    const uiActions = useUiActionsStore();

    return { gameStore, userStore, marketStore, languages, uiActions };
  },
  components: {
    ImportPreview,
    ItemIcon,
    ModalDialog,
    WorkerEdit,
    WorkshopsConfig,
    TradingConfig,
    PriceInput,
  },
  data: () => ({
    workerDialogVisible: false,
    workshopsConfigVisible: false,
    tradingConfigVisible: false,
    highlightPending: false,
    importDialogVisible: false,
    itemSearch: "",
    priceFilter: "all",
  }),
  computed: {
    customCount() {
      return new Set([
        ...Object.entries(this.userStore.customPrices)
          .filter(([, v]) => v != null && v !== "")
          .map(([k]) => k),
        ...Object.entries(this.userStore.keepItems)
          .filter(([k, v]) => v && !(k in this.gameStore.vendorPrices))
          .map(([k]) => k),
      ]).size;
    },
    filteredItems() {
      const query = this.itemSearch.trim().toLocaleLowerCase();
      return this.gameStore.itemKeys.filter((ik) => {
        const name = this.gameStore.uloc.item[ik] || String(ik);
        if (
          query &&
          !name.toLocaleLowerCase().includes(query) &&
          !String(ik).includes(query)
        )
          return false;
        if (this.priceFilter === "custom")
          return (
            this.userStore.customPrices[ik] != null &&
            this.userStore.customPrices[ik] !== ""
          );
        if (this.priceFilter === "keep")
          return Boolean(this.userStore.keepItems[ik]);
        if (this.priceFilter === "missing")
          return !(Number(this.marketStore.prices[ik]) > 0);
        return true;
      });
    },
  },
  watch: {
    "$route.hash": {
      immediate: true,
      handler(hash) {
        this.highlightPending = /^#item\d+$/.test(hash);
        if (this.highlightPending) {
          this.itemSearch = "";
          this.priceFilter = "all";
          this.$nextTick(this.highlightHash);
        }
      },
    },
    "userStore.selectedRegion": {
      handler(newValue, oldValue) {
        this.marketStore.fetchData();
      },
    },
  },
  methods: {
    formatFixed,

    reload() {
      this.marketStore.ready = false;
      this.marketStore.fetchData();
    },

    highlightHash() {
      if (!this.highlightPending) return;

      console.log("highlighting", this.$route.hash, this.highlightPending);

      if (this.$route.hash) {
        const el = document.getElementById(this.$route.hash.slice(1));
        if (el) {
          this.highlightPending = false;
          el.scrollIntoView();
          el.classList.add("anim");
        }
      }
    },

    applyImport(patch) {
      this.uiActions.perform(Object.keys(patch), (state) =>
        Object.assign(state, patch)
      );
      this.importDialogVisible = false;
    },

    fileExport() {
      var a = document.createElement("a");
      let out = {
        customPrices: this.userStore.customPrices,
        keepItems: this.userStore.keepItems,
        effectivePrices: this.marketStore.prices,
        farmingProfit: this.userStore.farmingProfit,
        farmingBareProfit: this.userStore.farmingBareProfit,
      };
      const str = JSON.stringify(out);
      var file = new Blob([str], { type: "text/plain" });
      a.href = URL.createObjectURL(file);
      a.download = "custom_prices.json";
      a.click();
    },

    clearCustomPrices() {
      if (!this.customCount) return;
      this.uiActions.request(
        "Clear {count} custom price and keep settings?",
        { count: this.customCount },
        ["customPrices", "keepItems"],
        (state) => {
          state.customPrices = {};
          state.keepItems = Object.fromEntries(
            Object.entries(state.keepItems).filter(
              ([key]) => key in this.gameStore.vendorPrices
            )
          );
        }
      );
    },
  },

  mounted() {
    this.highlightHash();
  },

  updated() {
    this.$nextTick(() => {
      this.highlightHash();
    });
  },
};
</script>

<template>
  <ModalDialog v-model:show="importDialogVisible" :title="$t('Import preview')">
    <ImportPreview
      v-if="importDialogVisible"
      kind="prices"
      :apply-import="applyImport"
      @done="importDialogVisible = false"
    />
  </ModalDialog>
  <ModalDialog v-model:show="workerDialogVisible">
    <WorkerEdit
      :workerEditing="userStore.defaultWorker"
      :initialProfit="0"
      v-model:show="workerDialogVisible"
    />
  </ModalDialog>
  <ModalDialog v-model:show="workshopsConfigVisible">
    <WorkshopsConfig />
  </ModalDialog>
  <ModalDialog v-model:show="tradingConfigVisible">
    <TradingConfig />
  </ModalDialog>
  <main class="settings-page">
    <div id="toptext">
      <h1>{{ $t("Basic settings") }}</h1>
      <p class="help-text">{{ $t("Changes here are saved immediately.") }}</p>
      <div class="settings-tiles">
        <div class="settings-tile">
          <div>
            {{ $t("Server:") }}
            <select
              v-model="userStore.selectedRegion"
              :aria-label="$t('Server:')"
            >
              <option>NA</option>
              <option>EU</option>
              <option>RU</option>
              <option>KR</option>
              <option>JP</option>
              <option>TW</option>
              <option>SA</option>
              <option>ASIA</option>
              <option>MENA</option>
              <option>CEU</option>
              <option>CNA</option>
            </select>

            <br />
            {{ $t("⤷ base storage:") }} {{ userStore.baseStorage }} (<input
              type="checkbox"
              id="vp_t"
              v-model="userStore.storageVP"
            />
            <label for="vp_t">{{ $t("VP always on") }}</label
            >)
          </div>

          <div>
            {{ $t("Tax:") }}
            <select
              v-model.number="userStore.selectedTax"
              :aria-label="$t('Tax:')"
            >
              <option value="0.65">0.65 (0)</option>
              <option value="0.65325">0.65325 (1000)</option>
              <option value="0.6565">0.6565 (4000)</option>
              <option value="0.65975">0.65975 (7000)</option>
              <option value="0.69225">{{ $t("0.69225 (7000 + ring)") }}</option>
              <option value="0.845">{{ $t("0.845 (0 + VP)") }}</option>
              <option value="0.84825">{{ $t("0.84825 (1000 + VP)") }}</option>
              <option value="0.8515">{{ $t("0.8515 (4000 + VP)") }}</option>
              <option value="0.85475">{{ $t("0.85475 (7000 + VP)") }}</option>
              <option value="0.88725">
                {{ $t("0.88725 (7000 + ring + VP)") }}
              </option>
              <option value="1">{{ $t("1 (just hoarding)") }}</option>
            </select>
          </div>

          <div>
            {{ $t("Language:") }}
            <select
              v-model="userStore.selectedLang"
              :aria-label="$t('Language:')"
            >
              <option v-for="(language, id) in languages" :key="id" :value="id">
                {{ language.name }}
              </option>
            </select>
          </div>
          <div>
            <label
              ><input type="checkbox" v-model="userStore.mapSaveData" />
              {{ $t("Map data saver (lower image detail)") }}</label
            >
          </div>
        </div>

        <div class="settings-tile">
          <div>{{ $t("Default worker for hire:") }}</div>
          <div>
            <input
              type="radio"
              name="dw"
              id="dw_f"
              :value="false"
              v-model="userStore.useDefaultWorker"
            />
            <label for="dw_f">{{ $t("Random Artisan Goblin") }}</label>
          </div>
          <div>
            <input
              type="radio"
              name="dw"
              id="dw_t"
              :value="true"
              v-model="userStore.useDefaultWorker"
            />
            <label for="dw_t"
              >{{ $t("Custom (")
              }}{{
                formatFixed(
                  gameStore.workerStatsOnPlantzone(userStore.defaultWorker)
                    .wspd,
                  2
                )
              }}🔨
              {{
                formatFixed(
                  gameStore.workerStatsOnPlantzone(userStore.defaultWorker)
                    .mspd,
                  2
                )
              }}🦶
              {{
                formatFixed(
                  gameStore.workerStatsOnPlantzone(userStore.defaultWorker)
                    .luck,
                  2
                )
              }}🍀)
              <button @click="workerDialogVisible = true">
                {{ $t("edit") }}
              </button>
            </label>
          </div>
        </div>

        <div class="settings-tile">
          {{ $t("🌻Farming") }}
          <input type="checkbox" id="fe_t" v-model="userStore.farmingEnable" />
          <label for="fe_t" style="margin-right: 0.4em">{{
            $t("enable")
          }}</label>
          <span v-if="userStore.farmingEnable">
            <div class="slider-container">
              <span>{{ $t("F2P") }}</span>
              <input
                type="range"
                style="width: 4em"
                v-model.number="userStore.farmingP2WShare"
                min="0"
                max="80"
                step="10"
              />
              <span>{{ $t("P2W") }}</span>
            </div>
            {{ $t("(using") }} {{ 80 - userStore.farmingP2WShare
            }}{{ $t("CP)") }}
            <div style="display: flex">
              <div>
                {{ $t("Total profit from 10 large fences (use") }}
                <a href="https://bit.ly/MagicalFarmingProfit">MFP</a>
                {{ $t("to estimate):") }}<br />
                <input
                  type="number"
                  class="float4"
                  v-model.number="userStore.farmingProfit"
                />
                {{ $t("M$/day with 10 workers") }} <br />
                <input
                  type="number"
                  class="float4"
                  v-model.number="userStore.farmingBareProfit"
                />
                {{ $t("M$/day with 0 workers (half growth speed)") }}
              </div>
            </div>
          </span>
        </div>

        <div class="settings-tile">
          {{ $t("🏭Workshops") }}
          <div>
            <button @click="workshopsConfigVisible = true">
              {{ $t("config") }}
            </button>
            <button @click="tradingConfigVisible = true">
              {{ $t("tradecalc") }}
            </button>
          </div>
        </div>

        <div v-if="0" class="settings-tile">
          {{ $t("🏛️Palace") }}
          <input type="checkbox" id="pe_t" v-model="userStore.palaceEnable" />
          <label for="pe_t">{{ $t("enable (use 5 CP)") }}</label>
          <div v-if="userStore.palaceEnable">
            {{ $t("One worker profit:") }}
            <input
              type="number"
              class="float4"
              v-model.number="userStore.palaceProfit"
            />
            {{ $t("M$/day") }}
          </div>
        </div>

        <div class="settings-tile">
          {{ $t("🗺️ Map") }}
          <div>
            <input
              type="checkbox"
              id="vi_hie"
              v-model="userStore.mapHideInactive"
            />
            {{ $t("hide inactive") }}
          </div>
          <div>
            <input
              type="number"
              class="w3em"
              min="20"
              max="50"
              v-model="userStore.mapIconSize"
            />
            {{ $t("px icon size") }}
          </div>
        </div>
      </div>

      <h2 class="price-heading">{{ $t("Price management") }}</h2>
      {{ $t("Market API status:") }}
      <abbr
        v-if="marketStore.apiFetching"
        class="tooltip nound"
        :title="$t('fetching')"
        >⏳</abbr
      >
      <abbr
        v-else-if="marketStore.apiAlive"
        class="tooltip nound"
        :title="$t('all prices fetched')"
        >✓</abbr
      >
      <abbr
        v-else-if="marketStore.apiPartial"
        class="tooltip nound"
        :title="
          $t('not fetched from either provider: {count}', {
            count: marketStore.apiMissingCount,
          })
        "
        >⚠️</abbr
      >
      <abbr v-else class="tooltip nound" :title="$t('no prices fetched')"
        >❌</abbr
      >
      &nbsp;<button :disabled="marketStore.apiFetching" @click="reload()">
        {{ $t("reload") }}
      </button>
      <p v-if="marketStore.apiDatetime" class="help-text">
        {{
          $t("价格更新于 {date}", {
            date: new Date(marketStore.apiDatetime).toLocaleString(
              languages[userStore.selectedLang]?.locale
            ),
          })
        }}
      </p>
      <p>
        {{
          $t(
            "By default everything marketable is supposed to be sold on Central Market (with tax)."
          )
        }}
      </p>
      <p>
        {{
          $t(
            "If the item is for self use, select Keep (=untax) and/or enter Custom price:"
          )
        }}
        <button @click="importDialogVisible = true">{{ $t("import") }}</button>
        <button @click="fileExport()">{{ $t("export") }}</button>
        <button
          class="danger"
          :disabled="!customCount"
          @click="clearCustomPrices()"
        >
          {{ $t("clear") }}
        </button>
      </p>
    </div>
    <div class="price-tools">
      <label
        >{{ $t("Search items")
        }}<input
          v-model="itemSearch"
          type="search"
          :placeholder="$t('Search items')"
      /></label>
      <label
        >{{ $t("Filter prices")
        }}<select v-model="priceFilter">
          <option value="all">{{ $t("All items") }}</option>
          <option value="custom">{{ $t("Custom prices only") }}</option>
          <option value="keep">{{ $t("Kept items only") }}</option>
          <option value="missing">{{ $t("Missing prices only") }}</option>
        </select></label
      >
      <span role="status">{{
        $t("Showing {count} of {total} items", {
          count: filteredItems.length,
          total: gameStore.itemKeys.length,
        })
      }}</span>
    </div>
    <p v-if="!filteredItems.length" role="status">
      {{ $t("No results found.") }}
    </p>
    <div
      class="table-scroll price-table"
      tabindex="0"
      :aria-label="$t('Price management')"
    >
      <table class="stickyhead">
        <thead>
          <tr>
            <th>{{ $t("Item") }}</th>
            <th>{{ $t("Market") }}</th>
            <th>{{ $t("Custom") }}</th>
            <th>{{ $t("Keep") }}</th>
            <th>{{ $t("Effective") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ik in filteredItems" :key="ik" :id="'item' + ik">
            <td>
              <a :href="this.userStore.externalItemUrl + ik">
                <ItemIcon :ik="ik" :with_name="true" />
              </a>
              {{ " " }}
              <span v-if="ik in marketStore.calculatedPrices">
                <abbr
                  class="tooltip"
                  :title="
                    $t('contains:\n') +
                    Object.entries(marketStore.calculatedPrices[ik])
                      .map(
                        ([cik, cqty]) =>
                          formatFixed(cqty, 3) + ' ' + gameStore.uloc.item[cik]
                      )
                      .join('\n')
                  "
                  >ℹ</abbr
                >
              </span>
            </td>
            <td class="tar">
              <a
                v-if="ik in marketStore.apiPrices"
                :href="this.marketStore.itemPriceUrl(ik)"
              >
                {{ formatFixed(marketStore.apiPrices[ik]) }}
              </a>
              <template v-else>
                {{ formatFixed(gameStore.vendorPrices[ik]) }}
              </template>
            </td>
            <td>
              <PriceInput
                v-model="userStore.customPrices[ik]"
                :reset-key="userStore.customPrices"
                :label="$t('Custom') + ' · ' + gameStore.uloc.item[ik]"
                :defaultValue="
                  marketStore.apiPrices[ik] || marketStore.prices[ik]
                "
              />
            </td>
            <td class="tac">
              <input
                type="checkbox"
                :disabled="ik in gameStore.vendorPrices"
                v-model="userStore.keepItems[ik]"
                :aria-label="$t('Keep') + ' · ' + gameStore.uloc.item[ik]"
              />
            </td>
            <td class="tar">
              {{ formatFixed(marketStore.prices[ik]) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>

<style scoped>
.spacer {
  height: 0.5em;
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
.nound {
  text-decoration: none;
}
input[type="radio"] + label {
  margin-left: 0.3em;
  margin-right: 0.5em;
}

input[type="checkbox"] + label {
  margin-left: 0.3em;
}

.settings-tiles {
  display: flex;
  flex-wrap: wrap;
}

.settings-tile {
  width: auto;
  padding: 4px;
  margin: 2px;
  border: 1px solid gray;
  border-radius: 2px;
}

.stickyhead tr {
  scroll-margin-top: 30px; /* for navigating to the row */
}
</style>

<style scoped>
.settings-page {
  max-width: 1200px;
  margin: 0 auto;
}
h1 {
  font-size: 1.6rem;
}
.settings-tiles {
  gap: 0.7rem;
  margin: 1rem 0;
}
.settings-tile {
  padding: 0.8rem;
  border-color: var(--color-border);
  border-radius: 8px;
  flex: 1 1 240px;
  margin: 0;
}
.settings-tile > div {
  margin: 0.3rem 0;
}
.price-heading {
  font-size: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
  margin: 1.2rem 0 0.7rem;
}
.price-tools {
  display: flex;
  gap: 1rem;
  align-items: end;
  flex-wrap: wrap;
  margin: 1rem 0;
}
.price-tools label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.price-tools input {
  width: 18rem;
  max-width: 100%;
}
.price-table {
  max-height: 65vh;
}
.price-table table {
  width: 100%;
  min-width: 540px;
}
.price-table td,
.price-table th {
  padding: 0.4rem 0.55rem;
}
.price-table :deep(.spin-input input) {
  width: 6rem;
}
@media (max-width: 600px) {
  .price-tools label {
    flex: 1 1 100%;
  }
  .price-tools input,
  .price-tools select {
    width: 100%;
  }
  .price-table th:first-child,
  .price-table td:first-child {
    max-width: 160px;
  }
}
</style>
