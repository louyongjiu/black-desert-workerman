import { defineStore } from "pinia";
import { useUserStore } from "./user";
import { canRestore, snapshotFields, restorePatch } from "../ui/undo.mjs";

const pending = new WeakMap();
export const useUiActionsStore = defineStore("uiActions", {
  state: () => ({ record: null, notice: "", confirmation: null }),
  getters: {
    canUndo: (state) => canRestore(state.record, useUserStore().$state),
  },
  actions: {
    perform(
      fields,
      mutate,
      notice = "Changes saved. You can undo this action."
    ) {
      const user = useUserStore();
      const before = snapshotFields(user.$state, fields);
      try {
        user.$patch(mutate);
      } catch (error) {
        user.$patch((state) => Object.assign(state, before));
        throw error;
      }
      this.record = { before, after: snapshotFields(user.$state, fields) };
      this.notice = notice;
    },
    request(message, params, fields, mutate, notice) {
      this.confirmation = { message, params };
      pending.set(this.$state, () => this.perform(fields, mutate, notice));
    },
    confirm() {
      const action = pending.get(this.$state);
      this.cancel();
      action?.();
    },
    cancel() {
      this.confirmation = null;
      pending.delete(this.$state);
    },
    undo() {
      const user = useUserStore();
      const patch = restorePatch(this.record, user.$state);
      user.$patch((state) => Object.assign(state, patch));
      this.record = null;
      this.notice = "Action undone.";
    },
    dismiss() {
      this.notice = "";
      this.record = null;
    },
    notify(message) {
      this.record = null;
      this.notice = message;
    },
  },
});
