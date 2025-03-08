import { $fetch } from 'ofetch'
import type { Token } from '~/types'

const SUDACHI_API_URL = process.env.SUDACHI_API_URL || 'http://localhost:5000'

export async function analyzeSudachi(text: string, mode = 'A'): Promise<Token[]> {
  try {
    const response = await $fetch(`${SUDACHI_API_URL}/analyze`, {
      method: 'POST',
      body: {
        text,
        mode
      }
    })

    return response.tokens.map((token: any) => ({
      surface_form: token.surface,
      basic_form: token.dictionary_form,
      reading: token.reading,
      pos: token.part_of_speech
    }))
  } catch (error) {
    console.error('Sudachi analysis failed:', error)
    return []
  }
} 