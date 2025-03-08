import { ref } from 'vue'
import type { Caption } from '~/types'

interface AnkiNote {
  deckName: string
  modelName: string
  fields: Record<string, string>
  tags: string[]
  audio?: {
    url: string
    filename: string
    skipHash: string
    fields: string[]
  }[]
  video?: {
    url: string
    filename: string
    skipHash: string
    fields: string[]
  }[]
  picture?: {
    url: string
    filename: string
    fields: string[]
  }[]
}

export function useAnkiExport() {
  const isExporting = ref(false)
  const error = ref<string | null>(null)

  async function addNote(caption: Caption, videoUrl: string, currentTime: number) {
    isExporting.value = true
    error.value = null

    try {
      // Take screenshot of current video frame
      const video = document.querySelector('video')
      if (!video) throw new Error('No video found')

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const screenshot = canvas.toDataURL('image/jpeg')

      // Create note
      const note: AnkiNote = {
        deckName: "Japanese::Anime",
        modelName: "Japanese Sentence",
        fields: {
          Sentence: caption.text,
          SentenceReading: caption.furigana?.map(([_, reading]) => reading).join('') || '',
          Notes: `Source: ${videoUrl}\nTimestamp: ${currentTime.toFixed(2)}s`,
        },
        tags: ["animebook"],
        picture: [{
          url: screenshot,
          filename: `screenshot_${Date.now()}.jpg`,
          fields: ["Screenshot"]
        }]
      }

      // Send to Anki Connect
      const response = await fetch('http://localhost:8765', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: "addNote",
          version: 6,
          params: {
            note
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add note to Anki')
      }

      return await response.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to export to Anki'
      throw e
    } finally {
      isExporting.value = false
    }
  }

  return {
    isExporting,
    error,
    addNote
  }
} 