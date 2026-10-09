import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router";
import { useUserStore } from './stores/user'
import { useMapStore } from './stores/map'
import { useMarketStore } from './stores/market'

import "./assets/main.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
// Restore preferences before the first navigation decides which data to load.
useUserStore().migrate(localStorage.getItem('user'))
for (const [key, store] of [['map', useMapStore()], ['market', useMarketStore()]]) {
  const saved = localStorage.getItem(key)
  if (saved) store.$patch(JSON.parse(saved))
}
useMarketStore().apiFetching = false
app.use(router);

app.mount("#app");
