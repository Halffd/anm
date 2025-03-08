import { useSettingsStore } from '~/stores/settings'

export default defineEventHandler(async (event) => {
  const settings = useSettingsStore()
  if (event.method === 'GET') {
    return { method: settings.tokenizationMethod }
  }

  if (event.method === 'POST') {
    const { method } = await readBody(event)
    if (method !== 'kuromoji' && method !== 'sudachi') {
      throw createError({
        statusCode: 400,
        message: 'Invalid tokenization method'
      })
    }

    settings.tokenizationMethod = method
    return { method }
  }
}) 