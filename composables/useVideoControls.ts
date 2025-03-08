import { ref, shallowRef, onMounted, onUnmounted } from 'vue'

export function useVideoControls() {
  const notification = ref<string | null>(null)
  const videoElement = shallowRef<HTMLVideoElement | null>(null)
  let notificationTimeout: number | null = null

  function clearNotification() {
    if (notificationTimeout) {
      clearTimeout(notificationTimeout)
      notificationTimeout = null
    }
  }
  
  function showNotification(message: string) {
    clearNotification()
    notification.value = message
    notificationTimeout = window.setTimeout(() => {
      notification.value = null
    }, 2000)
  }

  function updateVideoElement() {
    videoElement.value = document.querySelector('.video-element')
  }

  function skipTime(seconds: number) {
    if (!videoElement.value) {
      updateVideoElement()
    }
    
    if (!videoElement.value) return
    
    videoElement.value.currentTime += seconds
    showNotification(`Skipped ${Math.abs(seconds)} seconds ${seconds > 0 ? 'forward' : 'backward'}`)
  }

  function togglePlay() {
    if (!videoElement.value) {
      updateVideoElement()
    }
    
    if (!videoElement.value) return
    
    if (videoElement.value.paused) {
      videoElement.value.play()
      showNotification('Playing')
    } else {
      videoElement.value.pause()
      showNotification('Paused')
    }
  }

  onMounted(() => {
    updateVideoElement()
  })

  onUnmounted(() => {
    clearNotification()
    videoElement.value = null
  })

  return {
    notification,
    showNotification,
    skipTime,
    togglePlay
  }
} 