<script setup>
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useGameStore } from "./stores/game";
import { useUserStore } from "./stores/user";
import { useMapStore } from "./stores/map";
import { persistStore } from "./persistence.mjs";
import ActionFeedback from "./components/ActionFeedback.vue";
import { useHousingWorkbenchStore } from "./stores/housingWorkbench";
import { projectHousingDrafts } from "./housing/drafts.mjs";
const gameStore = useGameStore();
const route = useRoute();
function reloadPage() {
  window.location.reload();
}
</script>

<script>
export default {
  beforeCreate() {
    const userStore = useUserStore();
    const mapStore = useMapStore();
    const workbench = useHousingWorkbenchStore();
    const draftStorage = {
      setItem(key, value) {
        try {
          localStorage.setItem(key, value);
          workbench.storageError = "";
        } catch {
          workbench.storageError =
            "Unable to save drafts on this device. Keep this page open or save your settings.";
        }
      },
    };

    this._persistence = [
      persistStore(userStore, "user", localStorage),
      persistStore(mapStore, "map", localStorage),
      persistStore(
        workbench,
        "housingWorkbench",
        draftStorage,
        200,
        state => projectHousingDrafts(state, false)
      ),
    ];
    this._flushPersistence = () => this._persistence.forEach((p) => p.flush());
    window.addEventListener("pagehide", this._flushPersistence);
  },
  watch: {
    "$pinia.state.value.user.selectedLang"(language) {
      useGameStore()
        .loadLanguage(language)
        .catch((error) => console.error("Language load failed", error));
    },
    "$pinia.state.value.user.wasmRouting"(enabled) {
      if (enabled)
        useGameStore()
          .initWasmRouter()
          .catch((error) => {
            console.error("Route planner load failed", error);
            useUserStore().wasmRouting = false;
          });
    },
  },
  beforeUnmount() {
    window.removeEventListener("pagehide", this._flushPersistence);
    this._persistence.forEach((p) => p.stop());
  },
};
</script>

<template>
  <header>
    <div class="wrapper">
      <nav>
        <RouterLink to="/">{{ $t("Home") }}</RouterLink>
        <RouterLink to="/plantzones">{{ $t("Plantzones") }}</RouterLink>
        <RouterLink
          to="/optimizer"
          :class="{ 'router-link-exact-active': route.path === '/housecraft' }"
          >{{ $t("帝国优化") }}</RouterLink
        >
        <RouterLink to="/resources">{{ $t("Resources") }}</RouterLink>
        <RouterLink to="/settings">{{ $t("Settings") }}</RouterLink>
        <RouterLink to="/about">{{ $t("About") }}</RouterLink>
      </nav>
    </div>
  </header>

  <p v-if="gameStore.dataError" role="alert">
    {{ $t(gameStore.dataError) }}
    <button @click="reloadPage">{{ $t("Retry") }}</button>
  </p>
  <RouterView />
  <ActionFeedback />
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
  font-size: 14px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  text-align: center;
  margin-bottom: 1rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
  background: var(--color-background-mute);
  font-weight: 600;
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0.45rem 0.8rem;
  border-radius: 6px;
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
