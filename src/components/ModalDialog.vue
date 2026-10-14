<script>
const openDialogs = [];
let previousOverflow = "";
let previousInert = false;
const focusable =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';

export default {
  name: "ModalDialog",
  props: { show: Boolean, title: { type: String, default: "" } },
  emits: ["update:show"],
  data: () => ({ hasOpened: false, previousFocus: null }),
  watch: {
    show: {
      immediate: true,
      handler(value) {
        if (value) {
          this.hasOpened = true;
          this.$nextTick(this.open);
        } else this.release();
      },
    },
  },
  beforeUnmount() {
    this.release();
  },
  methods: {
    open() {
      if (!this.show || openDialogs.includes(this)) return;
      this.previousFocus = document.activeElement;
      if (!openDialogs.length) {
        previousOverflow = document.body.style.overflow;
        previousInert = document.getElementById("app")?.inert || false;
        document.body.style.overflow = "hidden";
        if (document.getElementById("app"))
          document.getElementById("app").inert = true;
      }
      openDialogs.push(this);
      document.addEventListener("keydown", this.onKeydown, true);
      const firstInput = this.$refs.content?.querySelector(
        'input:not(:disabled):not([type="file"]), select:not(:disabled), textarea:not(:disabled)'
      );
      (firstInput || this.$refs.closeButton)?.focus();
    },
    release() {
      const index = openDialogs.indexOf(this);
      if (index < 0) return;
      const wasTop = index === openDialogs.length - 1;
      openDialogs.splice(index, 1);
      document.removeEventListener("keydown", this.onKeydown, true);
      if (!openDialogs.length) {
        document.body.style.overflow = previousOverflow;
        if (document.getElementById("app"))
          document.getElementById("app").inert = previousInert;
      }
      if (wasTop && this.previousFocus?.isConnected) this.previousFocus.focus();
    },
    close() {
      this.$emit("update:show", false);
    },
    onKeydown(event) {
      if (openDialogs.at(-1) !== this) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.close();
      }
      if (event.key === "Tab") {
        const elements = [
          ...this.$refs.content.querySelectorAll(focusable),
        ].filter((el) => el.getClientRects().length);
        const first = elements[0],
          last = elements.at(-1);
        if (!first) {
          event.preventDefault();
          this.$refs.content.focus();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !this.$refs.content.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !this.$refs.content.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    },
  },
};
</script>

<template>
  <Teleport to="body">
    <div v-show="show" class="dialog" @click.self="close">
      <div
        ref="content"
        class="dialog_content"
        role="dialog"
        aria-modal="true"
        :aria-label="title || $t('Dialog')"
        tabindex="-1"
      >
        <div class="dialog-header">
          <h2 v-if="title">{{ title }}</h2>
          <button
            ref="closeButton"
            class="dialog-close"
            :aria-label="$t('Close')"
            @click="close"
          >
            {{ $t("Close") }}
          </button>
        </div>
        <slot v-if="hasOpened"></slot>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  padding: 1rem;
  background: #0007;
}
.dialog_content {
  margin: auto;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  min-width: min(300px, 100%);
  max-width: 100%;
  max-height: 100%;
  padding: 1rem;
  overflow: auto;
  box-shadow: 0 8px 40px #0004;
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.8rem;
}
.dialog-header h2 {
  font-size: 1.2rem;
}
.dialog-close {
  margin-left: auto;
  flex-shrink: 0;
}
@media (max-width: 600px) {
  .dialog {
    padding: 0.5rem;
  }
  .dialog_content {
    padding: 0.75rem;
  }
}
</style>
