<script>
import ImportPreview from "../components/ImportPreview.vue";
import { useUiActionsStore } from "../stores/uiActions";
import { useGameStore } from "../stores/game.js";
import { useUserStore } from "../stores/user.js";
import { useMarketStore } from "../stores/market.js";
import { formatFixed } from "../util.js";
import ModalDialog from "../components/ModalDialog.vue";


import { localizedAsyncComponent } from "../i18n/asyncComponent";
const FloatingResourceEdit = localizedAsyncComponent(() => import("../components/FloatingResourceEdit.vue"), ["research"]);

export default {
  setup() {
    const gameStore = useGameStore();
    const userStore = useUserStore();
    const marketStore = useMarketStore();
    const uiActions = useUiActionsStore();

    return { gameStore, userStore, marketStore, uiActions };
  },
  components: {
    ImportPreview,
    ModalDialog,
    FloatingResourceEdit,
  },

  data: () => ({
    floatingDialogWspd: 150,
    floatingDialogRgroup: 1,
    floatingDialogWkld: 400,
    floatingDialogVisible: false,
    importDialogVisible: false,
  }),
  watch: {
    "userStore.useFloatingResources": {
      handler(newValue, oldValue) {
        // catch individual switches
      },
      deep: true,
    },
  },
  methods: {
    formatFixed,

    applyImport(patch) {
      const fields = [
        ...new Set([...Object.keys(patch), "useFloatingResources"]),
      ];
      this.uiActions.perform(fields, (state) => {
        Object.assign(state, patch);
        if (!("useFloatingResources" in patch))
          state.useFloatingResources = Object.fromEntries(
            Object.keys(this.gameStore.regionGroups).map((k) => [k, true])
          );
      });
      this.importDialogVisible = false;
    },

    showDialog(rgk) {
      this.floatingDialogVisible = true;
      this.floatingDialogRgroup = Number(rgk);
      for (let pzk of this.gameStore.regionGroups[rgk]) {
        this.floatingDialogWkld = this.gameStore.plantzones[pzk].peg.time;
        break;
      }
    },

    fileExport() {
      var a = document.createElement("a");
      const out = {
        regionModifiers: this.userStore.regionResources,
        regionModifiers2: this.userStore.regionResources2,
      };
      const str = JSON.stringify(out);
      var file = new Blob([str], { type: "text/plain" });
      a.href = URL.createObjectURL(file);
      a.download = "resources.json";
      a.click();
    },

    clear() {
      const count = new Set([
        ...Object.keys(this.userStore.regionResources),
        ...Object.keys(this.userStore.regionResources2),
      ]).size;
      if (!count) return;
      this.uiActions.request(
        "Clear resource settings for {count} groups?",
        { count },
        ["regionResources", "regionResources2"],
        (state) => {
          state.regionResources = {};
          state.regionResources2 = {};
        }
      );
    },

    setAllFloating(val) {
      const newDict = {};
      for (const rgk of Object.keys(this.gameStore.regionGroups)) {
        newDict[rgk] = val;
      }
      // this is successfully tracked by standard (shallow) reactivity
      this.userStore.useFloatingResources = newDict;
    },
  },
};
</script>

<template>
  <ModalDialog v-model:show="importDialogVisible" :title="$t('Import preview')">
    <ImportPreview
      v-if="importDialogVisible"
      kind="resources"
      :apply-import="applyImport"
      @done="importDialogVisible = false"
    />
  </ModalDialog>

  <ModalDialog v-model:show="floatingDialogVisible">
    <FloatingResourceEdit
      :rgk="floatingDialogRgroup"
      :wspd="floatingDialogWspd"
      :workload="floatingDialogWkld"
      v-model:show="floatingDialogVisible"
    /><br />
    {{ $t("Test on node:") }}
    <select v-model="floatingDialogWkld">
      <option
        v-for="pzk in gameStore.regionGroups[floatingDialogRgroup]"
        :value="gameStore.plantzones[pzk] && gameStore.plantzones[pzk].peg.time"
      >
        {{ gameStore.plantzoneName(pzk) }} ({{
          gameStore.plantzones[pzk] && gameStore.plantzones[pzk].peg.time
        }}
        {{ $t("base)") }}
      </option>
    </select>
    <br />
    {{ $t("With workspeed:") }}
    <input
      type="range"
      class="vmid"
      v-model.number="floatingDialogWspd"
      min="40"
      max="200"
      step="0.01"
    />
    {{ floatingDialogWspd }}
  </ModalDialog>

  <div id="toptext">
    <p>
      {{
        $t(
          "These values are shown ingame as green bars at world map > resource view."
        )
      }}
    </p>
    <p>
      {{
        $t(
          "However, the client has several resource bars hidden/misplaced, for those you can check the current workload in worker assignment panel ingame and infer the resource% from that."
        )
      }}
    </p>
    <p>
      {{
        $t(
          "Low (exhausted) resource means workloads of relevant nodes are increased (up to 2x of base) so each job takes longer to complete."
        )
      }}
    </p>
    <p>
      {{
        $t(
          "If unspecified here, 0% resource will be used (= max workload = longest cycle = min cycles per day = min profit)"
        )
      }}
    </p>

    <details>
      <summary>{{ $t("Advanced") }}</summary>
      <button @click="importDialogVisible = true">{{ $t("import") }}</button>
      <button @click="fileExport()">{{ $t("export") }}</button>
      <button class="danger" @click="clear()">{{ $t("clear") }}</button>
      <label>
        <input type="checkbox" v-model="userStore.allowFloating" />{{
          $t("allow floating resources")
        }}
      </label>
      <span v-if="userStore.allowFloating">
        <button @click="setAllFloating(true)">{{ $t("all floating") }}</button>
        <button @click="setAllFloating(false)">{{ $t("all constant") }}</button>
      </span>
    </details>
  </div>

  <div class="table-scroll" tabindex="0" :aria-label="$t('Resources')">
    <table class="stickyhead">
      <thead>
        <tr>
          <th>{{ $t("RG") }}</th>
          <th>{{ $t("Resource %") }}</th>
          <th>{{ $t("Contains nodes with workload (base → current)") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(plantzones, rgk) in gameStore.regionGroups">
          <td class="tac">
            {{ rgk }}
          </td>

          <td class="tac">
            <template v-if="userStore.allowFloating">
              <label class="switch mauto">
                <input
                  type="checkbox"
                  v-model="userStore.useFloatingResources[rgk]"
                />
                <span class="slider"></span>
              </label>
            </template>
            <template
              v-if="
                userStore.allowFloating && userStore.useFloatingResources[rgk]
              "
            >
              {{ $t("floating") }}<br />
              ~{{ formatFixed(userStore.medianResources[rgk], 2) }}
              <button @click="showDialog(rgk)">{{ $t("edit") }}</button>
            </template>
            <template v-else>
              {{ $t("constant") }}<br />
              <input
                type="number"
                v-model.number="userStore.regionResources[rgk]"
                min="0"
                max="100"
                step="0.01"
                class="w42em"
              />
            </template>
          </td>

          <td>
            <div v-for="pzk in plantzones">
              <RouterLink tag="a" :to="{ path: './', hash: '#node' + pzk }">
                {{ gameStore.plantzoneName(pzk) }}
              </RouterLink>
              {{ gameStore.ready && gameStore.plantzones[pzk].peg.time }}

              <template
                v-if="
                  userStore.allowFloating && userStore.useFloatingResources[rgk]
                "
              >
                ⤳ {{ formatFixed(userStore.medianWorkloads[pzk], 2) }}
              </template>
              <template v-else>
                →
                {{
                  gameStore.ready
                    ? formatFixed(gameStore.plantzones[pzk].activeWorkload, 2)
                    : ""
                }}
              </template>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
[type="checkbox"] {
  vertical-align: middle;
}
.hmid {
  text-align: center;
}
.mauto {
  margin-left: auto;
  margin-right: auto;
}

/* slider */

.switch {
  position: relative;
  display: block;
  width: 30px;
  height: 17px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  -webkit-transition: 0.4s;
  transition: 0.4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 13px;
  width: 13px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  -webkit-transition: 0.4s;
  transition: 0.4s;
}

input:checked + .slider {
  background-color: hsla(160, 100%, 37%, 1);
}

input:focus + .slider {
  box-shadow: 0 0 1px hsla(160, 100%, 37%, 1);
}

input:checked + .slider:before {
  -webkit-transform: translateX(13px);
  -ms-transform: translateX(13px);
  transform: translateX(13px);
}
</style>
