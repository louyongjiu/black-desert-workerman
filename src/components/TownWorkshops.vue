<script>
import {useGameStore} from '../stores/game.js'
import {useUserStore} from '../stores/user.js'
import Worker from '../components/Worker.vue'
import {formatFixed} from '../util.js'

export default {
  setup() {
    const gameStore = useGameStore()
    const userStore = useUserStore()

    /*userStore.$subscribe((mutation, state) => {
      const start = Date.now()
      localStorage.setItem('user', JSON.stringify(state))
      console.log('userStore subscription took', Date.now()-start, 'ms')
    })*/

    return { gameStore, userStore }
  },

  props: {
    tk: Number,
  },

  emits: [
    'selectWorker',
    'editWorker',
  ],

  components: {
    
  },

  data: () => ({
  }),

  computed: {
    filteredHouses() {
      const ret = {}
      for (const [hk, v] of Object.entries(this.userStore.userWorkshops)) {
        const hi = this.gameStore.houseInfo[hk]
        if (!hi) throw Error(`unknown house ${hk}`)
        if (hi.affTown == this.tk) {
          if (v.industry in ret)
            ret[v.industry][hk] = v
          else
            ret[v.industry] = {[hk]: v}
        }
      }
      return ret
    },

    filteredWorkers() {
      return this.userStore.userWorkers.filter(w => w.job && 
        this.gameStore.jobIsWorkshop(w.job) && 
        w.job.hk in this.gameStore.houseInfo && 
        this.gameStore.houseInfo[w.job.hk].affTown == this.tk
      )
    },
  },

  methods: {
    formatFixed,

    
  },
}

</script>

<template>
  <details v-if="Object.keys(filteredHouses).length">
    <summary>{{ $t('Workshops') }}</summary>

    <div class="vscroll30">
      <table class="stickyhead">
        <thead>
          <tr>
            <th>{{ $t('house') }}</th>
            <th>{{ $t('type') }}</th>
            <th>{{ $t('workload') }}</th>
            <th>{{ $t('$/cycle') }}</th>
            <th>{{ $t('CP') }}</th>
            <th colspan="3">{{ $t('worker') }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(houses, industry) in filteredHouses">
            <tr v-for="(v, hk) in houses">
              <td>{{ gameStore.uloc.char[hk] }} {{ v.label }}</td>
              <td>
                <select v-model="v.industry">
                  <option v-for="(n, k) in gameStore.industries" :value="k">
                    {{ $t(n) }}
                  </option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  class="w5em"
                  v-model.number="v.manualWorkload"
                />
              </td>
              <td>
                <input
                  type="number"
                  class="w5em"
                  v-model.number="v.manualCycleIncome"
                />
              </td>
              <td>
                <input
                  type="number"
                  class="float4"
                  v-model.number="v.manualCp"
                />
              </td>
              <td>
                <div v-for="w in filteredWorkers.filter((w) => w.job.hk == hk)">
                  <button @click="this.$emit('editWorker', w)">
                    {{ $t('edit') }}
                  </button>
                  {{ userStore.workerLabel(w) }}
                  @
                  <template v-if="userStore.displayProfitPerCp">
                    {{ formatFixed(userStore.workerIncomePerCp(w), 2) }}
                    {{ $t('M$/day/CP') }}
                  </template>
                  <template v-else>
                    {{ formatFixed(userStore.workerIncome(w), 2) }}
                    {{ $t('M$/day') }}
                  </template>
                  <button @click="w.job = null">{{ $t('stop') }}</button>
                </div>

                <div v-if="v.industry == 'mass'">
                  <button @click="this.$emit('selectWorker', Number(hk))">
                    {{ $t('add') }}
                  </button>
                </div>

                <div
                  v-else-if="
                    filteredWorkers.filter((w) => w.job.hk == hk).length == 0
                  "
                >
                  <button @click="this.$emit('selectWorker', Number(hk))">
                    {{ $t('send') }}
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </details>
</template>



<style scoped>
summary {
  cursor: pointer;
}
.vscroll30 {
    max-height: 30vh;  /* percents of viewport height */
    overflow-y: auto;   /* Show scrollbar only when needed */
}
</style>
