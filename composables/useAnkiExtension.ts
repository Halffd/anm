import { ref } from 'vue'
import type { Caption } from '~/types'

interface ExtensionMessage {
  action: 'file' | 'record' | 'token' | 'status'
  file?: File
  lines?: string[]
  start?: number
  end?: number
  currentVideoTime?: number
  audioTrack?: number
  token?: string
  status?: 'new' | 'known' | 'mature'
}

export function useAnkiExtension() {
  const isExtensionAvailable = ref(false)
  const iframeToken = ref<string | null>(null)
  const wordStatuses = ref<Record<string, string>>({})

  // Check if extension is available
  onMounted(() => {
    isExtensionAvailable.value = !!window.chrome?.runtime
    
    // Listen for messages from extension
    if (isExtensionAvailable.value) {
      window.addEventListener('message', handleExtensionMessage)
    }
  })

  // Handle messages from extension
  function handleExtensionMessage(event: MessageEvent) {
    if (event.data && event.data.source === 'anki-extension' && event.data.token === iframeToken.value) {
      console.log('Received message from Anki extension:', event.data)
      
      // Handle word status updates
      if (event.data.type === 'word-status' && event.data.words) {
        for (const word of event.data.words) {
          wordStatuses.value[word.surface] = word.status
        }
      }
    }
  }

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

  // Get word status
  function getWordStatus(surface: string): string {
    return wordStatuses.value[surface] || 'new'
  }

  // Update word status
  function updateWordStatus(surface: string, status: 'new' | 'known' | 'mature') {
    wordStatuses.value[surface] = status
    
    // Also send to extension
    sendToExtension({
      action: 'status',
      token: surface,
      status
    }).catch(error => {
      console.error('Failed to update word status in extension:', error)
    })
  }

  return {
    isExtensionAvailable,
    initializeWithVideo,
    recordFlashcard,
    generateToken,
    sendToExtension,
    getWordStatus,
    updateWordStatus,
    wordStatuses
  }
} 