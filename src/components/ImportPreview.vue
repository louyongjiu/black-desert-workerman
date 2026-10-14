<script setup>
import { ref } from "vue";
import LocalizedFileInput from "./LocalizedFileInput.vue";
import { parseImport, importSummary } from "../ui/imports.mjs";
import { useUserStore } from "../stores/user";
const props = defineProps({
  kind: { type: String, required: true },
  prepare: Function,
  applyImport: { type: Function, required: true },
});
const emit = defineEmits(["done"]);
const user = useUserStore();
const preview = ref(null),
  error = ref(""),
  filename = ref(""),
  loading = ref(false);
let readId = 0;
const labels = {
  selectedRegion: "Server:",
  selectedLang: "Language:",
  selectedTax: "Tax:",
  defaultWorker: "Default worker for hire:",
  useDefaultWorker: "Default worker for hire:",
  mapHideInactive: "hide inactive",
  mapSaveData: "Map data saver (lower image detail)",
  mapIconSize: "px icon size",
  farmingEnable: "🌻Farming",
  farmingProfit: "🌻Farming",
  farmingBareProfit: "🌻Farming",
  farmingP2WShare: "🌻Farming",
  storageVP: "VP always on",
  lodgingTaken: "Lodging",
  houseTaken: "Reserved house uses",
  grindTakenList: "Connected nodes",
  userWorkers: "Workers",
  customPrices: "Custom prices",
  keepItems: "Keep",
  regionResources: "Resources",
  regionResources2: "Resources",
  houseReservations: "Reserved house uses",
  userWorkshops: "Workshops",
  lodgingP2W: "Lodging",
  storageP2W: "Storage",
  storagePersonal: "Storage",
  workshopStorage: "Workshop storage",
  housingPlans: "Housing planner",
  optimizerPlan: "Empire",
};
async function choose(event) {
  const id = ++readId;
  preview.value = null;
  error.value = "";
  const file = event.target.files?.[0];
  if (!file) return;
  filename.value = file.name;
  loading.value = true;
  try {
    if (file.size > 10 * 1024 * 1024)
      throw new Error("Configuration files must be smaller than 10 MB.");
    const text = await file.text();
    if (id !== readId) return;
    const parsed = parseImport(text, props.kind, user.$state);
    preview.value = props.prepare ? props.prepare(parsed) : parsed;
  } catch (e) {
    if (id === readId) error.value = e.message;
  } finally {
    if (id === readId) loading.value = false;
  }
}
function apply() {
  try {
    props.applyImport(preview.value);
    emit("done");
  } catch (e) {
    error.value = e.message;
  }
}
</script>

<template>
  <div class="import-preview">
    <LocalizedFileInput accept=".json" @change="choose" />
    <p v-if="loading" role="status">{{ $t("Reading configuration…") }}</p>
    <p v-if="error" role="alert" class="error-text">{{ $t(error) }}</p>
    <template v-if="preview">
      <h3>{{ $t("Import preview") }} · {{ filename }}</h3>
      <p>
        {{
          $t(
            "Only the listed sections will be replaced. Other settings are kept."
          )
        }}
      </p>
      <ul>
        <li v-for="row in importSummary(preview)" :key="row.key">
          {{ $t(labels[row.key] || "Settings") }}
          <span v-if="row.count !== null"> · {{ row.count }}</span>
          <span v-else-if="row.value !== null"> · {{ row.value }}</span>
          <span v-if="row.key === 'userWorkers'">{{
            $t("Current workers: {count}", { count: user.userWorkers.length })
          }}</span>
        </li>
      </ul>
      <button class="primary" :disabled="loading" @click="apply">
        {{ $t("Confirm import") }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.import-preview {
  width: 32rem;
  max-width: 100%;
}
p,
h3,
ul {
  margin: 0.8rem 0;
}
li {
  margin: 0.3rem 0;
}
li span {
  margin-left: 0.5rem;
}
</style>
