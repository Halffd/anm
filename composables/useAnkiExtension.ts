import { ref } from 'vue'
import type { Caption } from '~/types'

interface ExtensionMessage {
  action: 'file' | 'record' | 'token'
  file?: File
  lines?: string[]
  start?: number
  end?: number
  currentVideoTime?: number
  audioTrack?: number
  token?: string
}

export function useAnkiExtension() {
  const isExtensionAvailable = ref(false)
  const iframeToken = ref<string | null>(null)

  // Check if extension is available
  onMounted(() => {
    isExtensionAvailable.value = !!window.chrome?.runtime
  })

  // Generate unique token for iframe communication
  function generateToken() {
    const buffer = new Uint8Array(64)
    crypto.getRandomValues(buffer)
    iframeToken.value = Array.from(buffer)
      .map(b => b.toString(36))
      .join('')
    return iframeToken.value
  }

  // Send message to extension
  async function sendToExtension(message: ExtensionMessage): Promise<any> {
    if (!isExtensionAvailable.value) {
      throw new Error('Anki extension not available')
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { ...message, token: iframeToken.value },
        response => {
          if (response.type === 'error') {
            reject(new Error(response.message))
          } else {
            resolve(response)
          }
        }
      )
    })
  }

  // Initialize extension with video file
  async function initializeWithVideo(file: File) {
    if (!iframeToken.value) {
      generateToken()
    }

    // Clone file to prevent permission issues
    const clonedFile = new File([file.slice(0)], file.name, { 
      type: file.type 
    })

    return sendToExtension({
      action: 'file',
      file: clonedFile
    })
  }

  // Record flashcard
  async function recordFlashcard(caption: Caption, videoTime: number, audioTrack = 0) {
    return sendToExtension({
      action: 'record',
      lines: [caption.text],
      start: caption.startTime,
      end: caption.endTime,
      currentVideoTime: videoTime,
      audioTrack
    })
  }

  return {
    isExtensionAvailable,
    initializeWithVideo,
    recordFlashcard
  }
} 