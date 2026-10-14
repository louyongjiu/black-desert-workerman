<script>
import { useGameStore } from "../stores/game";
import ItemIcon from "./lo/ItemIcon.vue";
export default {
  components: { ItemIcon },
  emits: ["select", "close"],
  setup() {
    return { gameStore: useGameStore() };
  },
  data: () => ({ searchQuery: "", focused: false, activeIndex: 0 }),
  computed: {
    searchIndex() {
      if (!this.gameStore.ready) return { items: [], nodes: [] };
      return {
        items: Object.entries(this.gameStore.itemkeyPlantzones).map(([ik, nodes]) => {
          const name = this.gameStore.uloc.item[ik] || String(ik);
          return { name, lower: name.toLocaleLowerCase(), itemKey: Number(ik), nodes };
        }),
        nodes: Object.entries(this.gameStore.uloc.node).map(([key, name]) => ({ key, name, lower: name.toLocaleLowerCase() })),
      };
    },
    results() {
      const query = this.searchQuery.trim().toLocaleLowerCase();
      if (!query || !this.gameStore.ready) return [];
      const results = [];
      for (const item of this.searchIndex.items) {
        if (item.lower.includes(query)) results.push(item);
        if (results.length >= 10) break;
      }
      const grouped = new Map();
      for (const { key, name, lower } of this.searchIndex.nodes) {
        if (lower.includes(query) || key.includes(query)) {
          const label = key.includes(query) ? `${name} (${key})` : name;
          if (!grouped.has(label)) grouped.set(label, new Set());
          grouped.get(label).add(Number(key));
          if (grouped.size >= 10) break;
        }
      }
      return [
        ...results,
        ...[...grouped].map(([name, nodes]) => ({ name, nodes })),
      ];
    },
  },
  watch: {
    searchQuery() {
      this.focused = true;
      this.activeIndex = 0;
    },
  },
  methods: {
    focusInput() {
      this.$refs.searchInput.focus();
    },
    select(result) {
      this.$emit("select", result.nodes);
      this.focused = false;
      this.$refs.searchInput.blur();
    },
    reset() {
      this.searchQuery = "";
      this.$emit("select", new Set());
      this.focused = false;
    },
    onKeydown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        this.focused = false;
        this.$refs.searchInput.blur();
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        this.focused = true;
        this.activeIndex = Math.max(
          0,
          Math.min(
            this.results.length - 1,
            this.activeIndex + (event.key === "ArrowDown" ? 1 : -1)
          )
        );
      }
      if (
        event.key === "Enter" &&
        this.focused &&
        this.results[this.activeIndex]
      ) {
        event.preventDefault();
        this.select(this.results[this.activeIndex]);
      }
    },
  },
};
</script>

<template>
  <div class="search-bar">
    <div class="search-controls">
      <input
        ref="searchInput"
        v-model="searchQuery"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="focused && Boolean(searchQuery.trim())"
        aria-controls="map-search-results"
        :aria-activedescendant="
          focused && results.length ? 'map-result-' + activeIndex : undefined
        "
        :aria-label="$t('Search nodes, items or towns')"
        :placeholder="$t('Search nodes, items or towns')"
        @focus="focused = true"
        @blur="focused = false"
        @keydown="onKeydown"
      />
      <button :disabled="!searchQuery" @click="reset">{{ $t("reset") }}</button>
    </div>
    <ul
      v-if="focused && searchQuery.trim()"
      id="map-search-results"
      class="search-results"
      role="listbox"
    >
      <li
        v-for="(result, index) in results"
        :id="'map-result-' + index"
        :key="result.name"
        role="option"
        :aria-selected="index === activeIndex"
        @mousedown.prevent="select(result)"
      >
        <ItemIcon v-if="result.itemKey" :ik="result.itemKey" />
        {{ result.name }}
        <span class="help-text">· {{ result.nodes.size }}</span>
      </li>
      <li v-if="!results.length" role="presentation">
        {{ $t("No results found.") }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search-bar {
  position: relative;
  width: min(100%, 32rem);
  z-index: 30;
}
.search-controls {
  display: flex;
  gap: 0.5rem;
}
.search-controls input {
  width: 100%;
  min-width: 0;
}
.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.35rem;
  padding: 0.4rem;
  list-style: none;
  max-height: min(50vh, 24rem);
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  box-shadow: 0 4px 20px #0003;
}
.search-results li {
  padding: 0.45rem 0.6rem;
  cursor: pointer;
}
.search-results li:hover,
.search-results li[aria-selected="true"] {
  background: var(--color-background-mute);
}
</style>
