<script setup>
import { ref } from 'vue';

defineProps({ accept: { type: String, default: '.json' } });
const filename = ref('');
</script>

<template>
  <label class="file-picker">
    <input
      type="file"
      :accept="accept"
      :aria-label="$t('Choose file')"
      @change="filename = $event.target.files[0]?.name || ''"
    />
    <span class="choose">{{ $t('Choose file') }}</span>
    <span class="filename">{{ filename || $t('No file selected') }}</span>
  </label>
</template>

<style scoped>
.file-picker {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  max-width: 100%;
  cursor: pointer;
}
.file-picker input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.choose {
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 0.2em 0.5em;
  flex-shrink: 0;
}
.filename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-picker:focus-within .choose {
  outline: 2px solid hsla(160, 100%, 37%, 1);
  outline-offset: 2px;
}
</style>
