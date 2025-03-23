import { ref } from 'vue'

export function useCaptionsControl() {
  const captionsVisible = ref(true)
  const captionsPanelVisible = ref(false)
  
  function toggleCaptions() {
    captionsVisible.value = !captionsVisible.value
    return captionsVisible.value
  }
  
  function toggleCaptionsPanel() {
    captionsPanelVisible.value = !captionsPanelVisible.value
    return captionsPanelVisible.value
  }
  
  return {
    captionsVisible,
    captionsPanelVisible,
    toggleCaptions,
    toggleCaptionsPanel
  }
} 