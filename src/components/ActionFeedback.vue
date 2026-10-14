<script setup>
import ModalDialog from "./ModalDialog.vue";
import { useUiActionsStore } from "../stores/uiActions";
const actions = useUiActionsStore();
</script>

<template>
  <ModalDialog
    :show="Boolean(actions.confirmation)"
    :title="$t('Confirm change')"
    @update:show="actions.cancel()"
  >
    <template v-if="actions.confirmation">
      <p>{{ $t(actions.confirmation.message, actions.confirmation.params) }}</p>
      <p class="help-text">
        {{ $t("You can undo this action until these settings change again.") }}
      </p>
      <div class="ui-actions">
        <button @click="actions.cancel()">{{ $t("Cancel") }}</button>
        <button class="danger" @click="actions.confirm()">
          {{ $t("Confirm change") }}
        </button>
      </div>
    </template>
  </ModalDialog>
  <div
    v-if="actions.notice"
    class="action-feedback"
    role="status"
    aria-live="polite"
  >
    <div>
      {{ $t(actions.notice) }}
      <p v-if="actions.record && !actions.canUndo" class="help-text">
        {{ $t("Undo is unavailable because these settings changed.") }}
      </p>
    </div>
    <button
      v-if="actions.record"
      :disabled="!actions.canUndo"
      @click="actions.undo()"
    >
      {{ $t("Undo") }}
    </button>
    <button :aria-label="$t('Close')" @click="actions.dismiss()">
      {{ $t("Close") }}
    </button>
  </div>
</template>

<style scoped>
.action-feedback {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: max-content;
  max-width: calc(100vw - 2rem);
  padding: 0.8rem 1rem;
  background: var(--color-background);
  border: 1px solid var(--color-border-hover);
  border-radius: 8px;
  box-shadow: 0 4px 24px #0003;
}
.action-feedback button {
  flex-shrink: 0;
}
@media (max-width: 600px) {
  .action-feedback {
    flex-wrap: wrap;
    width: calc(100vw - 2rem);
  }
}
</style>
