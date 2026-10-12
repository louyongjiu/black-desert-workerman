<script>
import {useUserStore} from '../stores/user'
import {useRoutingStore} from '../stores/routing'
import {useGameStore} from '../stores/game'
import {formatFixed} from '../util.js'
import { ref } from 'vue';

export default {
  setup() {
    const userStore = useUserStore()
    const routingStore = useRoutingStore()
    const gameStore = useGameStore()

    /*userStore.$subscribe((mutation, state) => {
      const start = Date.now()
      localStorage.setItem('user', JSON.stringify(state))
      console.log('userStore subscription took', Date.now()-start, 'ms')
    })*/

    return { gameStore, userStore, routingStore }
  },

  props: {
    tk: Number,
    hk: Number,
    show: {
      type: Boolean,
      default: false
    }
  },

  data: () => ({

  }),

  watch: { 
    
  },

  methods: {
    formatFixed,
    
    workshopNearestTownsFreeWorkersProfits(townsLimit) {
      const houseTk = this.gameStore.houseInfo[this.hk].affTown
      const houseTnk = this.gameStore.tk2tnk(houseTk)
      const houseCp = this.userStore.userWorkshops[this.hk].manualCp
      const townsData = []
      const tkCpList = this.gameStore.dijkstraNearestTowns(houseTnk, townsLimit, this.routingStore.routing.autotakenNodes, true)
      tkCpList.forEach(([tnk, mapCp, path]) => {
        const tk = this.gameStore._tnk2tk[tnk]
        const freeWorkers = this.userStore.getFreeWorkers(tk)
        
        freeWorkers.forEach(w => {
          townsData.push(this.gameStore.workshopSelectionEntry(this.hk, tk, tnk, path, w, mapCp, houseCp))
        })
      })
      townsData.sort((a,b)=>b.dailyPerCp-a.dailyPerCp)  // desc
      return townsData
    },

    assign(w, hk) {
      this.userStore.assignWorker(w, {kind: 'workshop', hk: Number(hk), recipe: undefined})
      this.$emit('update:show', false)
    },
  },

  computed: {
    freeWorkers() {
      const arr = this.workshopNearestTownsFreeWorkersProfits(99)
      return arr
    },

    workshop() {
      return this.userStore.userWorkshops[this.hk]
    },
  },
}
</script>

<template>
  <template v-if="hk">
    <div>
      {{ $t('Nearest idle workers for') }} {{ gameStore.uloc.char[hk] }}
      {{ workshop.label ? '"' + workshop.label + '"' : '' }} ({{
        workshop.manualWorkload
      }}
      {{ $t('workload,') }} {{ workshop.manualCycleIncome }}
      {{ $t('$/cycle, type:') }}
      {{ $t(gameStore.industries[workshop.industry] || workshop.industry) }}
      <abbr class="tooltip" :title="$t('see Settings > 🏭Workshops')">ℹ</abbr>):
      <template v-if="freeWorkers.length == 0"> {{ $t('None') }} </template>
    </div>

    <template v-if="freeWorkers.length">
      <table>
        <tr>
          <th>{{ $t('town') }}</th>
          <th>{{ $t('worker') }}</th>
          <th>{{ $t('walk') }}</th>
          <th>{{ $t('cycles/day') }}</th>
          <th>{{ $t('+M$/day') }}</th>
          <th>{{ $t('+CP') }}</th>
          <th>{{ $t('M$/day/CP') }}</th>
          <th>{{ $t('action') }}</th>
        </tr>
        <template v-for="e in freeWorkers">
          <tr v-if="e.profit.distance < 1e6">
            <td>{{ gameStore.nodeName(e.tnk) }}</td>
            <td>
              {{ e.w.label }}
              <span class="fsxs">
                {{ formatFixed(e.profit.statsOnWs.wspd, 2) }}🔨
                {{ formatFixed(e.profit.statsOnWs.mspd, 2) }}🦶
                {{ formatFixed(e.profit.statsOnWs.luck, 2) }}🍀
              </span>
            </td>
            <td>{{ formatFixed(e.profit.distance) }}</td>
            <td>{{ formatFixed(e.profit.cyclesDaily, 1) }}</td>
            <td class="center">
              {{ formatFixed(e.profit.priceDaily, 2) }}
            </td>
            <td>
              <abbr
                class="tooltip"
                :title="
                  $t('connection cost:\n') +
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
              >+<abbr class="tooltip" :title="$t('see Settings > 🏭Workshops')">
                {{ e.houseCp }} </abbr
              >+<abbr class="tooltip" :title="e.infraTooltip">
                {{ e.townCp }} </abbr
              >={{ e.cp }}
            </td>
            <td class="center">
              {{ formatFixed(e.dailyPerCp, 3) }}
            </td>
            <td>
              <button @click="assign(e.w, hk)">{{ $t('assign') }}</button>
            </td>
          </tr>
        </template>
      </table>
    </template>
  </template>
</template>

<style scoped>
.tac {
  text-align: center;
}
.tooltip {
  cursor: help;
}

</style>