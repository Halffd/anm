<script setup lang="ts">
import { ref, watch, onUnmounted, type Ref } from 'vue'

const props = defineProps<{
  message: string | null | Ref<string | null>
}>()

const isVisible = ref(false)
let timeout: number | null = null

function clearNotificationTimeout() {
  if (timeout) {
    clearTimeout(timeout)
    timeout = null
  }
}

function getMessage(): string | null {
  if (!props.message) return null
  return typeof props.message === 'object' ? props.message.value : props.message
}

watch(() => getMessage(), (newMessage) => {
  clearNotificationTimeout()
  
  if (!newMessage) {
    isVisible.value = false
    return
  }
  
  isVisible.value = true
  timeout = window.setTimeout(() => {
    isVisible.value = false
  }, 2000)
}, { immediate: true })

onUnmounted(() => {
  clearNotificationTimeout()
})
</script>

<template>
  <Transition 
    name="fade"
    appear
    @before-enter="isVisible = true"
    @after-leave="isVisible = false"
  >
    <div 
      v-if="isVisible && getMessage()"
      role="alert"
      aria-live="polite"
      class="fixed top-[3.5%] left-[3.5%] z-50 text-2xl text-white px-4 py-2 rounded-lg bg-black/80"
      style="text-shadow: 0 0 5px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)"
    >
      {{ getMessage() }}
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style> 