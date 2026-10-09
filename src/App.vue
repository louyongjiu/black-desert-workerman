<script setup>
import { RouterLink, RouterView } from "vue-router";
import {useGameStore} from './stores/game'
import {useUserStore} from './stores/user'
import {useMapStore} from './stores/map'
import {persistStore} from './persistence.mjs'
const gameStore = useGameStore()
function reloadPage() { window.location.reload() }
</script>

<script>
export default {
  beforeCreate() {
    const userStore = useUserStore()
    const mapStore = useMapStore()

    this._persistence = [
      persistStore(userStore, 'user', localStorage),
      persistStore(mapStore, 'map', localStorage),
    ]
    this._flushPersistence = () => this._persistence.forEach(p => p.flush())
    window.addEventListener('pagehide', this._flushPersistence)

  },
  watch: {
    '$pinia.state.value.user.selectedLang'(language) {
      useGameStore().loadLanguage(language).catch(error => console.error('Language load failed', error))
    },
    '$pinia.state.value.user.wasmRouting'(enabled) {
      if (enabled) useGameStore().initWasmRouter().catch(error => {
        console.error('Route planner load failed', error)
        useUserStore().wasmRouting = false
      })
    },
  },
  beforeUnmount() {
    window.removeEventListener('pagehide', this._flushPersistence)
    this._persistence.forEach(p => p.stop())
  },
}
</script>

<template>
  <header>
    <div class="wrapper">
      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/plantzones">Plantzones</RouterLink>
        <RouterLink to="/resources">Resources</RouterLink>
        <RouterLink to="/settings">Settings</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </nav>
    </div>
  </header>

  <p v-if="gameStore.dataError" role="alert">
    {{ gameStore.dataError }}
    <button @click="reloadPage">Retry</button>
  </p>
  <RouterView />
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-bottom: 1rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

@media (min-width: 91024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }

  .logo {
    margin: 0 2rem 0 0;
  }

  header .wrapper {
    display: flex;
    place-items: flex-start;
    flex-wrap: wrap;
  }

  nav {
    text-align: left;
    margin-left: -1rem;
    font-size: 1rem;

    padding: 1rem 0;
    margin-top: 1rem;
  }
}
</style>
