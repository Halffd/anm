<script setup lang="ts">
import { useCaptionsStore } from '~/stores/captions'

const store = useCaptionsStore()
</script>

<template>
  <div 
    class="min-h-screen bg-black text-white"
    :class="[
      { 'mr-[400px]': store.isSidebarVisible }
    ]"
  >
    <NuxtPage />
    <div 
      class="fixed top-0 right-0 w-[400px] h-full bg-gray-900 transition-transform duration-300 ease-in-out"
      :class="[
        { 'translate-x-full': !store.isSidebarVisible }
      ]"
    >
      <CaptionsList
        v-if="store.captions.length"
        :captions="store.captions"
        :active-ids="store.activeCaptionIds"
        :is-offset-mode="store.isOffsetMode"
        :is-auto-pause-mode="store.isAutoPauseMode"
        :is-exporting="false"
      />
    </div>
  </div>
</template>

<style>
.video-container {
  position: relative;
  width: 100%;
  background: black;
}

.video-element {
  width: 100%;
  height: auto;
}
</style> 