<template>
  <div class="min-h-screen bg-black text-white overflow-hidden">
    <NuxtPage />
    <ClientOnly>
      <NotificationManager :message="videoControls.notification" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { useVideoControls } from '~/composables/useVideoControls'
import NotificationManager from '~/components/NotificationManager.vue'

const videoControls = useVideoControls()
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overscroll-behavior: none;
}

.video-container {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.video-element {
  max-width: 100%;
  max-height: 100vh;
  max-height: 100dvh;
  will-change: transform;
}

/* Video alignment classes */
.video-container.left {
  justify-content: flex-start;
}

.video-container.center {
  justify-content: center;
}

.video-container.right {
  justify-content: flex-end;
}

/* Transition animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
  will-change: opacity;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style> 