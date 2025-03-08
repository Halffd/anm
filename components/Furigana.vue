<script setup lang="ts">
defineProps<{
  text: string
  reading: string
}>()
</script>

<template>
  <ruby>
    {{ text }}<rt>{{ reading }}</rt>
  </ruby>
</template>

<style>
ruby {
  ruby-align: center;
}
rt {
  font-size: 0.6em;
  color: theme('colors.gray.400');
}
</style> 