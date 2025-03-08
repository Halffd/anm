<script setup lang="ts">
import type { Caption } from '~/types'

const props = defineProps<{
  captions: Caption[]
  activeIds: string[]
  isOffsetMode?: boolean
  isAutoPauseMode?: boolean
  isExporting: boolean
}>()

const emit = defineEmits<{
  'select-caption': [caption: Caption, offset: number]
  'set-custom-offset': [caption: Caption, offset: number]
  'export-to-anki': [caption: Caption]
}>()

function calcCaptionOffset(caption: Caption): number {
  const store = useCaptionsStore()
  return store.currentTime - caption.endTime
}

function selectCaption(caption: Caption) {
  emit('select-caption', caption, calcCaptionOffset(caption))
}

function setCustomOffset(caption: Caption) {
  emit('set-custom-offset', caption, calcCaptionOffset(caption))
}

function exportToAnki(caption: Caption) {
  emit('export-to-anki', caption)
}
</script>

<template>
  <div class="sidebar-captions">
    <div class="captions-container">
      <div class="captions-list">
        <div 
          v-for="caption in captions" 
          :key="caption.id"
          class="caption-controls"
        >
          <div 
            :class="[
              'caption',
              { 'active': activeIds.includes(caption.id) },
              { 'auto-pause': isAutoPauseMode }
            ]"
            @click="selectCaption(caption)"
          >
            <div class="caption-text" v-html="caption.text" />
            
            <div 
              v-if="isOffsetMode"
              class="caption-time-offset"
            >
              {{ calcCaptionOffset(caption).toFixed(2) }}s
            </div>

            <button
              v-if="caption.isActive"
              class="anki-export-button"
              :class="{ 'exporting': isExporting }"
              @click="exportToAnki(caption)"
            >
              <span v-if="!isExporting">+</span>
              <span v-else class="loading-spinner">↻</span>
            </button>
          </div>

          <button
            v-if="isOffsetMode"
            class="set-custom-offset-button"
            @click="setCustomOffset(caption)"
          >
            Set offset
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.caption {
  position: relative;
  padding: 0.4em;
  cursor: pointer;
  transition: background-color 100ms linear;
}

.caption.active {
  background-color: theme('colors.blue.600');
  color: white;
}

.caption-time-offset {
  position: absolute;
  top: 0;
  right: 2px;
  font-size: 0.75rem;
  color: theme('colors.gray.500');
}

.set-custom-offset-button {
  opacity: 0;
  position: absolute;
  left: -135px;
  width: 135px;
  height: 100%;
  transition: opacity 0.2s;
}

.caption-controls:hover .set-custom-offset-button {
  opacity: 1;
}

.anki-export-button {
  opacity: 0;
  position: absolute;
  right: -30px;
  width: 30px;
  height: 100%;
  background: theme('colors.blue.600');
  color: white;
  transition: opacity 0.2s;
}

.caption-controls:hover .anki-export-button {
  opacity: 1;
}

.loading-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style> 