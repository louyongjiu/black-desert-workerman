<script>
</script>

<template>
  <div class="q">{{ $t('Q:') }} <slot name="q"></slot></div>
  <div>{{ $t('A:') }} <slot></slot></div>
</template>

<style scoped>
.q {
  padding-top: 0.5em;
}
</style>
