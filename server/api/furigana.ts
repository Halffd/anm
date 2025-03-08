import { initializeTokenizer } from '~/server/services/tokenizer'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { text } = body

    if (!text) {
      throw createError({
        statusCode: 400,
        message: 'Text is required'
      })
    }

    const tokenizer = await initializeTokenizer()
    const tokens = tokenizer.tokenize(text)

    const furigana = tokens.map(token => {
      const surface = token.surface_form
      const reading = token.reading || surface
      return [surface, reading !== surface ? reading : '']
    })

    return { furigana }

  } catch (error) {
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}) 