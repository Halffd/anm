import { ref } from 'vue'

export function useFurigana() {
  const isProcessing = ref(false)
  const error = ref<string | null>(null)

  async function processFurigana(text: string) {
    isProcessing.value = true
    error.value = null

    try {
      const response = await fetch('/api/furigana', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error('Failed to process furigana')
      }

      const data = await response.json()
      return data.furigana
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error processing furigana'
      return null
    } finally {
      isProcessing.value = false
    }
  }

  return {
    processFurigana,
    isProcessing,
    error
  }
} 