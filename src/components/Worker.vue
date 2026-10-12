<script>
import {useGameStore} from '../stores/game'
import {useUserStore} from '../stores/user'
import {formatFixed, percentageToColor} from '../util.js'
import WorkerJobDescription from '../components/WorkerJobDescription.vue'

export default {
  setup() {
    const gameStore = useGameStore()
    const userStore = useUserStore()
    return { gameStore, userStore }
  },

  props: {
    w: Object,
    homeless: Boolean,
    unsendable: Boolean,
  },

  emits: [
    'panToPaPos',
    'send',
    'edit',
  ],

  components: {
    WorkerJobDescription,
  },

  data: () => ({
    
  }),

  methods: {
    formatFixed,
    percentageToColor,
  },
}

</script>

<template>
  <tr>
    <td>
      <button @click="$emit('fire')">{{ $t('fire') }}</button>
    </td>
    <td>
      {{ userStore.workerLabel(w) }}
    </td>

    <td
      :style="
        this.userStore.prerelease_colorGoblins &&
        w.charkey == 7572 && {
          backgroundColor: percentageToColor(
            this.userStore.workerStatsForDisplay(w).wspd,
            this.userStore.workersMinMaxStats.wspd.lo,
            this.userStore.workersMinMaxStats.wspd.hi,
            0.2
          ),
        }
      "
    >
      <span v-if="this.userStore.displayWorkerStatsRank" class="fss">
        {{ formatFixed(this.userStore.workerStatsForDisplay(w).wspd, 1) }}%
      </span>
      <span v-else>
        {{ formatFixed(this.userStore.workerStatsForDisplay(w).wspd, 2) }}
      </span>
    </td>
    <td
      :style="
        this.userStore.prerelease_colorGoblins &&
        w.charkey == 7572 && {
          backgroundColor: percentageToColor(
            this.userStore.workerStatsForDisplay(w).mspd,
            this.userStore.workersMinMaxStats.mspd.lo,
            this.userStore.workersMinMaxStats.mspd.hi,
            0.2
          ),
        }
      "
    >
      <span v-if="this.userStore.displayWorkerStatsRank" class="fss">
        {{ formatFixed(this.userStore.workerStatsForDisplay(w).mspd, 1) }}%
      </span>
      <span v-else>
        {{ formatFixed(this.userStore.workerStatsForDisplay(w).mspd, 2) }}
      </span>
    </td>
    <td
      :style="
        this.userStore.prerelease_colorGoblins &&
        w.charkey == 7572 && {
          backgroundColor: percentageToColor(
            this.userStore.workerStatsForDisplay(w).luck,
            this.userStore.workersMinMaxStats.luck.lo,
            this.userStore.workersMinMaxStats.luck.hi,
            0.2
          ),
        }
      "
    >
      <span v-if="this.userStore.displayWorkerStatsRank" class="fss">
        {{ formatFixed(this.userStore.workerStatsForDisplay(w).luck, 1) }}%
      </span>
      <span v-else>
        {{ formatFixed(this.userStore.workerStatsForDisplay(w).luck, 2) }}
      </span>
    </td>

    <td class="center">
      <button @click="$emit('edit')">{{ $t('edit') }}</button>
    </td>

    <td>
      <template v-if="w.job">
        <template v-if="gameStore.jobIsPz(w.job)">
          <span
            @click="$emit('panToPaPos', this.gameStore.nodes[w.job.pzk].pos)"
            class="clickable"
          >
            <WorkerJobDescription :w="w" />
          </span>
        </template>
        <template v-else>
          <WorkerJobDescription :w="w" />
        </template>
        @
        <template v-if="userStore.displayProfitPerCp">
          {{ formatFixed(userStore.workerIncomePerCp(w), 2) }}
          {{ $t('M$/day/CP') }}
        </template>
        <template v-else>
          {{ formatFixed(userStore.workerIncome(w), 2) }} {{ $t('M$/day') }}
        </template>
      </template>
      <template v-else> {{ $t('idle') }} </template>
    </td>

    <td class="center">
      <button v-if="w.job" @click="w.job = null">{{ $t('stop') }}</button>
      <template v-else>
        <div v-if="unsendable">
          <button
            :title="
              $t(
                'Ancado needs to be explicitly activated (see town config) to house workers'
              )
            "
            disabled="true"
          >
            {{ $t('send') }}
          </button>
        </div>
        <button v-else @click="$emit('send')">{{ $t('send') }}</button>
      </template>
    </td>
  </tr>
</template>



<style scoped>
.homeless {
  background-color: rgba(255, 0, 0, 0.2);
}
</style>
