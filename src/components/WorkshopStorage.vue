<script setup>
import { computed } from "vue";
import { useGameStore } from "../stores/game";
import { useUserStore } from "../stores/user";
import { workshopReviewSignature } from "../housing/requirements.mjs";
const props = defineProps({
  townKey: { type: Number, default: null },
  settingsUser: { type: Object, default: null },
});
const emit = defineEmits(["update:storage", "update:settings"]);
const game = useGameStore(),
  liveUser = useUserStore(),
  user = computed(() => props.settingsUser || liveUser);
const towns = computed(() =>
  Object.values(user.value.warehouseRequirements).filter(
    (t) =>
      t.workshops.length &&
      (props.townKey === null || t.townKey === props.townKey)
  )
);
const config = (tk) => {
  const raw = user.value.workshopStorage[tk] || {};
  return {
    coverage: "automatic",
    extraSlots: 0,
    personalIncludes: 0,
    confirmed: false,
    ...raw,
    manualItems: Array.isArray(raw.manualItems) ? raw.manualItems : [],
    itemSlots: raw.itemSlots || {},
  };
};
function edit(tk, key, value) {
  const next = { ...config(tk), [key]: value };
  if (key !== "confirmed") next.confirmed = false;
  if (key === "confirmed" && value === true)
    next.confirmedFor = workshopReviewSignature(
      game,
      user.value,
      tk,
      towns.value.find((t) => t.townKey === tk).workshops
    );
  if (props.settingsUser) emit("update:storage", next);
  else liveUser.workshopStorage[tk] = next;
}
function personal(tk, value) {
  if (props.settingsUser) {
    emit("update:settings", {
      storagePersonal: Number(value),
      workshopStorage: { ...config(tk), confirmed: false },
    });
    return;
  }
  liveUser.storagePersonal[tk] = Number(value);
  edit(tk, "confirmed", false);
}
function items(tk, value) {
  const ids = value
    .trim()
    .split(/[\s,，]+/)
    .filter(Boolean);
  if (ids.some((id) => !/^\d+$/.test(id))) return;
  edit(tk, "manualItems", [...new Set(ids.map(Number))]);
}
function itemSlots(tk, id, value) {
  edit(tk, "itemSlots", { ...config(tk).itemSlots, [id]: Number(value) });
}
</script>
<template>
  <section v-for="town in towns" :key="town.townKey" class="workshop-storage">
    <h3>
      {{ $t("Workshop storage") }} ·
      {{ game.uloc.town[town.townKey] || town.townKey }}
    </h3>
    <p>
      {{
        $t(
          "Materials and products use the worker home-town storage. Known stackable items are counted once per warehouse."
        )
      }}
    </p>
    <p>
      {{ $t("Identified workshop items") }}:
      {{ town.identified.map((id) => game.itemName(id)).join(", ") || "—" }}
    </p>
    <ul v-if="town.issues.length" role="alert">
      <li v-for="issue in town.issues" :key="issue">{{ $t(issue) }}</li>
    </ul>
    <label
      >{{ $t("Workshop storage accounting") }}
      <select
        :value="config(town.townKey).coverage"
        @change="edit(town.townKey, 'coverage', $event.target.value)"
      >
        <option value="automatic">
          {{ $t("Identify items and supplement missing storage") }}
        </option>
        <option value="personal">
          {{ $t("Already covered by personal storage reservation") }}
        </option>
      </select>
    </label>
    <label
      >{{ $t("Existing personal storage reservation") }}
      <input
        type="number"
        min="0"
        max="192"
        :value="user.storagePersonal[town.townKey] || 0"
        @input="personal(town.townKey, $event.target.value)"
      />
    </label>
    <template v-if="config(town.townKey).coverage === 'automatic'">
      <label
        >{{ $t("Additional item IDs, separated by commas") }}
        <input
          type="text"
          :value="config(town.townKey).manualItems.join(', ')"
          @change="items(town.townKey, $event.target.value)"
        />
      </label>
      <label v-for="id in town.nonStack" :key="id"
        >{{ $t("Reserved pieces or slots") }} · {{ game.itemName(id) }}
        <input
          type="number"
          min="1"
          max="192"
          :value="config(town.townKey).itemSlots[id] || 0"
          @input="itemSlots(town.townKey, id, $event.target.value)"
        />
      </label>
      <label
        >{{ $t("Additional reserved slots beyond identified items") }}
        <input
          type="number"
          min="0"
          max="192"
          :value="config(town.townKey).extraSlots"
          @input="edit(town.townKey, 'extraSlots', Number($event.target.value))"
        />
      </label>
      <label
        >{{
          $t("Workshop slots transferred from the old personal reservation")
        }}
        <input
          type="number"
          min="0"
          :max="user.storagePersonal[town.townKey] || 0"
          :value="config(town.townKey).personalIncludes"
          @input="
            edit(town.townKey, 'personalIncludes', Number($event.target.value))
          "
        />
      </label>
    </template>
    <label class="confirmation"
      ><input
        type="checkbox"
        :checked="config(town.townKey).confirmed"
        @change="edit(town.townKey, 'confirmed', $event.target.checked)"
      />{{
        $t(
          "I have reviewed missing recipe information and the storage reservation; the same slots are not counted twice."
        )
      }}</label
    >
    <p>
      {{ $t("Total storage demand") }}: {{ town.total }} /
      {{ $t("Warehouse capacity limit") }}: 192
    </p>
    <p v-if="town.resolved">
      {{ $t("Workshop storage is ready for empire optimization") }}
    </p>
  </section>
</template>
<style scoped>
.workshop-storage {
  border: 1px solid #888;
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin: 1rem 0;
}
label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
}
input[type="number"] {
  width: 5rem;
}
input[type="text"],
select {
  max-width: 100%;
}
.confirmation {
  display: block;
}
ul[role="alert"] {
  color: #c44;
}
p {
  margin: 0.5rem 0;
}
</style>
