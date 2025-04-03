<template>
  <div 
    class="subtitle-line" 
    :class="[
      position || 'middle', 
      { 'secondary': isSecondary }
    ]"
  >
    <span v-if="!settings.showFurigana">
      <template v-for="(token, index) in tokens" :key="index">
        <span 
          :class="[token.statusClass, { 'secondary-text': isSecondary }]" 
          @click="handleWordClick(token)"
        >{{ token.surface_form }}</span>
      </template>
    </span>
    <span v-else class="furigana-container">
      <template v-for="(token, index) in tokens" :key="index">
        <ruby 
          :class="[token.statusClass, { 'secondary-text': isSecondary }]"
          @click="handleWordClick(token)"
        >
          {{ token.surface_form }}
          <rt v-if="token.reading && token.reading !== token.surface_form">
            {{ token.reading }}
          </rt>
        </ruby>
      </template>
    </span>
    <!-- Fallback to plain text if no tokens -->
    <span v-if="(!tokens || tokens.length === 0) && text">{{ text }}</span>
  </div>
</template>

<script setup>
import { useSettingsStore } from '~/stores/settings'

const props = defineProps({
  text: String,
  tokens: Array,
  position: String,
  isSecondary: Boolean
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
  background-color: rgba(0, 0, 0, 0.7);
  padding: 8px 16px;
  border-radius: 8px;
  max-width: 90%;
  margin: 0 auto;
  text-align: center;
  font-size: 24px; /* Default larger size */
  line-height: 1.4;
  text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.8);
}

.subtitle-line.secondary {
  font-family: v-bind('settings.secondarySubtitleFontFamily');
  font-weight: v-bind('settings.secondarySubtitleFontWeight');
  font-style: v-bind('settings.secondarySubtitleFontStyle');
  text-decoration: v-bind('settings.secondarySubtitleTextDecoration');
  color: #ccc;
  font-size: 20px; /* Slightly smaller for secondary */
}

.secondary-text {
  color: #ccc;
}

.furigana-container {
  display: inline-block;
}

ruby {
  ruby-align: center;
  display: inline;
  position: relative;
  line-height: 1.6;
  margin: 0;
  padding: 0;
}

rt {
  font-size: 0.5em;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
  text-align: center;
  white-space: nowrap;
}

/* Position styles */
.subtitle-line.top {
  position: absolute;
  top: 40px;
}

.subtitle-line.middle {
  position: absolute;
  bottom: 100px;
}

.subtitle-line.bottom {
  position: absolute;
  bottom: 40px;
}
</style> 