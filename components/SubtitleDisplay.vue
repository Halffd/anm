<template>
  <div class="subtitle-line" :class="position || 'middle'">
    <span v-if="!settings.showFurigana">
      <template v-for="(token, index) in tokens" :key="index">
        <span 
          :class="token.statusClass" 
          @click="handleWordClick(token)"
        >{{ token.surface_form }}</span>
      </template>
    </span>
    <span v-else class="furigana-container">
      <template v-for="(token, index) in tokens" :key="index">
        <ruby 
          :class="token.statusClass"
          @click="handleWordClick(token)"
        >
          {{ token.surface_form }}
          <rt v-if="token.reading && token.reading !== token.surface_form">
            {{ token.reading }}
          </rt>
        </ruby>
      </template>
    </span>
  </div>
</template>

<script setup>
import { useSettingsStore } from '~/stores/settings'

const props = defineProps({
  text: String,
  tokens: Array,
  position: String
})

const emit = defineEmits(['word-click'])
const settings = useSettingsStore()

function handleWordClick(token) {
  emit('word-click', token)
}
</script>

<style>
.subtitle-line {
  font-family: v-bind('settings.subtitleFontFamily');
  font-weight: v-bind('settings.subtitleFontWeight');
  font-style: v-bind('settings.subtitleFontStyle');
  text-decoration: v-bind('settings.subtitleTextDecoration');
  /* Other styles... */
}

.secondary-subtitle-line {
  font-family: v-bind('settings.secondarySubtitleFontFamily');
  font-weight: v-bind('settings.secondarySubtitleFontWeight');
  font-style: v-bind('settings.secondarySubtitleFontStyle');
  text-decoration: v-bind('settings.secondarySubtitleTextDecoration');
  /* Other styles... */
}
</style> 