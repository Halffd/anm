import type { Tokenizer, Token } from '~/types'
import { analyzeSudachi } from './sudachi'

let kuromojiTokenizer: Tokenizer | null = null
let tokenizationMethod: 'kuromoji' | 'sudachi' = 'kuromoji'

export async function initializeTokenizer(): Promise<Tokenizer> {
  if (kuromojiTokenizer) return kuromojiTokenizer

  return new Promise((resolve, reject) => {
    // @ts-ignore - kuromoji will be loaded via CDN
    kuromoji.builder({ dicPath: 'dict' }).build((err: Error, t: Tokenizer) => {
      if (err) {
        reject(err)
        return
      }
      kuromojiTokenizer = t
      resolve(t)
    })
  })
}

export function setTokenizationMethod(method: 'kuromoji' | 'sudachi') {
  tokenizationMethod = method
}

export async function tokenize(text: string): Promise<Token[]> {
  if (tokenizationMethod === 'sudachi') {
    return await analyzeSudachi(text)
  } else {
    const tokenizer = await initializeTokenizer()
    return tokenizer.tokenize(text)
  }
}

export async function makeFurigana(text: string, mode = 'A'): Promise<Array<[string, string]>> {
  const tokens = await tokenize(text)

  return tokens.map(token => {
    const surface = token.surface_form
    const reading = token.reading || surface
    
    // Only return furigana if different from surface form
    return [surface, reading !== surface ? reading : '']
  })
} 