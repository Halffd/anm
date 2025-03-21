<template>
  <div class="anki-connector">
    <!-- Hidden iframe for Anki communication if needed -->
    <iframe 
      v-if="iframeToken" 
      :src="`http://localhost:8765/ankiconnect?token=${iframeToken}`" 
      style="display: none;"
    ></iframe>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAnkiExtension } from '~/composables/useAnkiExtension'

const ankiExtension = useAnkiExtension()
const iframeToken = ref<string | null>(null)

onMounted(() => {
  // Generate token for iframe communication if extension is available
  if (ankiExtension.isExtensionAvailable.value) {
    iframeToken.value = ankiExtension.generateToken()
  }
  
  // Listen for messages from Anki extension
  window.addEventListener('message', handleAnkiMessage)
})

function handleAnkiMessage(event: MessageEvent) {
  // Verify message is from Anki extension
  if (event.data && event.data.source === 'anki-extension' && event.data.token === iframeToken.value) {
    console.log('Received message from Anki extension:', event.data)
    
    // Handle different message types
    if (event.data.type === 'word-status') {
      // Update word status in the application
      // This would need to be implemented with a global store
    }
  }
}
</script> 