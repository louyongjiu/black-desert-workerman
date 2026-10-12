<script>
import {useGameStore} from '../stores/game'
import {useUserStore} from '../stores/user'
import {useRoutingStore} from '../stores/routing'
import {useMarketStore} from '../stores/market'
import MakeAWorker from '../components/MakeAWorker.vue'
import {formatFixed} from '../util.js'
import ItemIcon from '../components/lo/ItemIcon.vue'

export default {
  setup() {
    const gameStore = useGameStore()
    const userStore = useUserStore()
    const routingStore = useRoutingStore()
    const marketStore = useMarketStore()

    /*userStore.$subscribe((mutation, state) => {
      const start = Date.now()
      localStorage.setItem('user', JSON.stringify(state))
      console.log('userStore subscription took', Date.now()-start, 'ms')
    })*/

    return { gameStore, userStore, routingStore, marketStore }
  },

  props: {
    pzk: Number,
  },

  emits: [
    'showResourceDialog',
    'editWorker',
  ],

  components: {
    MakeAWorker,
    ItemIcon,
  },

  data: () => ({
    selectedRedirect: -1,
  }),

  methods: {
    formatFixed,

    plantzoneNearestTownsFreeWorkersProfits(pzk, townsLimit) {
      const townsData = []
      const homeTnkList = this.gameStore.dijkstraNearestTowns(pzk, townsLimit, this.routingStore.routing.autotakenNodes, true)
      homeTnkList.forEach(([homeTnk, mapCp, path]) => {
        const homeTk = this.gameStore._tnk2tk[homeTnk]
        const freeWorkers = this.userStore.getFreeWorkers(homeTk)
        
        freeWorkers.forEach(w => {
          const stats = this.gameStore.workerStatsOnPlantzone(w)
          const storageTk = this.selectedRedirect == -1 ? homeTk : this.gameStore.tnk2tk(this.selectedRedirect)  // sets to undefined if not found
          const workerEntry = this.gameStore.pzSelectionEntry(pzk, homeTk, homeTnk, mapCp, path, w, stats, storageTk)
          
          townsData.push(workerEntry)
        })
      })
      townsData.sort((a,b)=>b.dailyPerCp-a.dailyPerCp)  // desc
      return townsData
    },
  },

  computed: {
    freeWorkers() {
      const arr = this.plantzoneNearestTownsFreeWorkersProfits(this.pzk, 99)
      //console.log('arr', arr)
      const filtered_dist = arr.filter((e) => {
        return e.profit.dist < 1E6
      })
      //console.log('filtered_dist', filtered_dist)
      const filtered_similar = filtered_dist.filter((item, index, self) => {
        return index === self.findIndex(
          needle => needle.tnk === item.tnk && JSON.stringify(needle.statsOnPz) === JSON.stringify(item.statsOnPz)
        )
      })
      //console.log('filtered_similar', filtered_similar)
      return filtered_similar
    },
  },
}

</script>

<template>
  <div>
    <RouterLink tag="a" :to="{ path: './plantzones', hash: '#drops' + pzk }">
      {{ gameStore.plantzoneName(pzk) }}
    </RouterLink>

    {{ this.gameStore.nodes[pzk].CP }}{{ $t('CP') }}
    <span v-if="pzk in this.gameStore.plantzones">
      <RouterLink
        v-for="k in this.gameStore.plantzones[pzk].itemkeys"
        tag="a"
        :to="{ path: './settings', hash: '#item' + k }"
      >
        <abbr
          :title="
            gameStore.itemName(k) +
            ' ' +
            formatFixed(marketStore.prices[k]) +
            '$'
          "
        >
          <ItemIcon :ik="Number(k)" />
        </abbr>
      </RouterLink>

      [🍀{{
        formatFixed(
          this.gameStore.plantzones[pzk].lucky
            ? this.gameStore.plantzones[pzk].luckyValue /
                this.gameStore.plantzones[pzk].unluckyValue
            : 1,
          2
        )
      }}<abbr
        class="tooltip"
        :title="$t('how much more $ a lucky cycle brings vs unlucky')"
        >{{ $t('x') }}</abbr
      >]
    </span>
  </div>

  <div>
    {{ $t('workload:') }}
    <template
      v-if="
        gameStore.ready &&
        gameStore.plantzones[pzk].regiongroup &&
        userStore.allowFloating &&
        userStore.useFloatingResources[gameStore.plantzones[pzk].regiongroup]
      "
    >
      ~{{ formatFixed(userStore.medianWorkloads[pzk], 2) }}
      <button @click="$emit('showResourceDialog', pzk)">
        {{ $t('review') }}</button
      ><!--📝-->
    </template>
    <template v-else>
      {{ formatFixed(gameStore.plantzones[pzk].activeWorkload, 2) }}
      ←
      <input
        type="number"
        v-model.number="
          userStore.regionResources[gameStore.plantzones[pzk].regiongroup]
        "
        min="0"
        max="100"
        step="0.1"
        class="w42em"
      />{{ $t('% resource') }}
    </template>
  </div>

  <div id="plantzoneWorkerInfo">
    <template v-if="userStore.workedPlantzones.has(pzk.toString())">
      {{ $t('worker:') }} {{ this.routingStore.pzJobs[pzk].worker.label }}
      @
      {{ formatFixed(this.routingStore.pzJobs[pzk].profit.priceDaily, 3) }}
      {{ $t('M$/day') }}
      <template v-if="userStore.workedPlantzones.has(pzk.toString())">
        <button
          @click="$emit('editWorker', this.routingStore.pzJobs[pzk].worker)"
        >
          {{ $t('edit') }}
        </button>
        <button @click="this.routingStore.pzJobs[pzk].worker.job = null">
          {{ $t('stop') }}
        </button>
      </template>

      <br />
      {{ $t('connection cost:') }}
      {{
        formatFixed(this.routingStore.pzjobsSharedConnectionCP[pzk].value, 3)
      }}
      {{ $t('CP') }}
      <abbr
        class="tooltip"
        :title="
          $t(
            'full cost of this node + Σ of connection nodes costs shared proportionally between all active jobs using them\n'
          ) + this.routingStore.pzjobsSharedConnectionCP[pzk].tooltip
        "
        >ℹ</abbr
      >
      <br />
      {{ $t('lodgage cost:') }}
      {{
        formatFixed(
          userStore.workerSharedLodgageCP(this.routingStore.pzJobs[pzk].worker)
            .value,
          3
        )
      }}
      {{ $t('CP') }}
      <abbr
        class="tooltip"
        :title="
          userStore.workerSharedLodgageCP(this.routingStore.pzJobs[pzk].worker)
            .tooltip
        "
        >ℹ</abbr
      >
      <br />
      {{ $t('efficiency:') }}
      {{
        formatFixed(
          userStore.workerIncomePerCp(this.routingStore.pzJobs[pzk].worker),
          3
        )
      }}
      {{ $t('M$/day/CP') }}
      <abbr
        class="tooltip"
        :title="$t('income / (connectionCost + lodgageCost)')"
        >ℹ</abbr
      >
    </template>

    <template v-else> {{ $t('worker: none') }} </template>
  </div>

  <div>
    <div class="spaced-columns">
      <div>
        <h4>
          {{ $t('Nearest towns with idle workers:') }}
          <template v-if="freeWorkers.length == 0">{{ $t('None') }}</template>
        </h4>
      </div>
      <div style="margin-right: 6px">
        {{ $t('stash at:') }}
        <select v-model="selectedRedirect">
          <option value="-1">{{ $t('worker hometown') }}</option>
          <option value="0">{{ $t('cheapest storage 🧊') }}</option>
          <option
            v-for="tnk in gameStore.townsWithRedirectableStorage"
            :value="tnk"
          >
            {{ gameStore.uloc.node[tnk] }}
          </option>
        </select>
      </div>
    </div>

    <div class="vscroll30" v-if="freeWorkers.length > 0">
      <table class="stickyhead">
        <thead>
          <tr>
            <th>{{ $t('town') }}</th>
            <th>{{ $t('walk') }}</th>
            <th>
              {{ $t('worker') }}
              <abbr
                class="tooltip"
                :title="
                  $t('same town&amp;stat workers are hidden in this view')
                "
                >ℹ</abbr
              >
            </th>
            <th>{{ $t('+M$/day') }}</th>
            <th>
              {{ $t('+CP') }}
              <abbr
                class="tooltip"
                :title="$t('node connection + town housing = total')"
                >ℹ</abbr
              >
            </th>
            <th>{{ $t('M$/day/CP') }}</th>
            <th>{{ $t('action') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in freeWorkers">
            <td>{{ gameStore.nodeName(e.tnk) }}</td>
            <td>{{ formatFixed(e.profit.dist) }}</td>
            <td>
              {{ e.w.label }}
              {{ gameStore.workerIcon(e.w) }}
              <span class="fsxs">
                {{ formatFixed(e.statsOnPz.wspd, 2) }}🔨
                {{ formatFixed(e.statsOnPz.mspd, 2) }}🦶
                {{ formatFixed(e.statsOnPz.luck, 2) }}🍀
              </span>
            </td>
            <td class="center">
              {{ formatFixed(e.profit.priceDaily, 2) }}
            </td>
            <td>
              <abbr
                class="tooltip"
                :title="
                  Array.from(
                    e.path,
                    (nk) =>
                      `${
                        routingStore.routing.autotakenNodes.has(nk)
                          ? 0
                          : gameStore.nodes[nk].CP
                      } ${gameStore.uloc.node[nk]}`
                  ).join('\n')
                "
              >
                {{ e.mapCp }} </abbr
              >+<abbr class="tooltip" :title="e.infraTooltip">{{
                formatFixed(e.townCp)
              }}</abbr
              >={{ formatFixed(e.cp) }}
            </td>
            <td class="center">
              {{ formatFixed(e.dailyPerCp, 3) }}
            </td>
            <td>
              <button
                v-if="userStore.workedPlantzones.has(pzk.toString())"
                :title="$t('plantzone already occupied')"
                disabled="true"
              >
                {{ $t('assign') }}
              </button>
              <button
                v-else-if="isNaN(e.townCp)"
                :title="$t('Can\'t resolve housing')"
                disabled="true"
              >
                {{ $t('assign') }}
              </button>
              <button
                v-else-if="
                  gameStore.tnk2tk(e.w.tnk) &&
                  gameStore.tnk2tk(e.w.tnk) == 619 &&
                  !userStore.activateAncado
                "
                :title="
                  $t(
                    'Ancado needs to be explicitly activated (see town config) to house workers'
                  )
                "
                disabled="true"
              >
                {{ $t('assign') }}
              </button>
              <button
                v-else
                @click="
                  userStore.assignWorker(e.w, {
                    kind: 'plantzone',
                    pzk: e.pz.key,
                    storage: e.storageTnk,
                  })
                "
              >
                {{ $t('assign') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <MakeAWorker :pzk="pzk" :redirect="Number(selectedRedirect)" />
  </div>
</template>



<style scoped>
.townbox {
  margin-top: 0.8em;
}
.unresolved {
  background-color: rgba(255, 0, 0, 0.2);
}
.tooltip {
  cursor: help;
}
.vscroll30 {
    max-height: 30vh;  /* percents of viewport height */
    overflow-y: auto;   /* Show scrollbar only when needed */
}
</style>
