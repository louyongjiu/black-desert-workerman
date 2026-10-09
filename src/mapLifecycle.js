import { markRaw, watch } from 'vue'
import { loadDatasets } from './dataLoading.mjs'

function waitForGame(gameStore, signal) {
  if (signal.aborted) return Promise.reject(new DOMException('Map unmounted', 'AbortError'))
  if (gameStore.ready) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const abort = () => {
      stop()
      reject(new DOMException('Map unmounted', 'AbortError'))
    }
    const stop = watch(() => gameStore.ready, ready => {
      if (!ready) return
      stop()
      signal.removeEventListener('abort', abort)
      resolve()
    })
    signal.addEventListener('abort', abort, { once: true })
  })
}

export const mapLifecycle = {
  created() {
    this._mapController = markRaw(new AbortController())
  },
  beforeUnmount() {
    this._mapController.abort()
    this.deck?.finalize()
    this.deck = null
    this._regionData?.clear()
    for (const key of ['tileLayer', 'lineLayer', 'iconLayer', 'highlightedIconLayer', 'rgLayer', 'rLayer', 'resourceLayer', 'originLayer']) {
      if (key in this.$data) this[key] = null
    }
  },
  methods: {
    async loadMapData() {
      const signal = this._mapController.signal
      await waitForGame(this.gameStore, signal)
      const data = await loadDatasets({
        iconData: 'data/deck_icons.json',
        iconPositions: 'data/deck_icon_positions.json',
        lineData: 'data/deck_links.json',
      }, { signal })
      if (signal.aborted) throw new DOMException('Map unmounted', 'AbortError')
      for (const [key, value] of Object.entries(data)) this[key] = markRaw(value)
    },
  },
}
