export default defineNuxtPlugin(() => {
  return {
    provide: {
      loadKuromoji: () => {
        return new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = '/js/kuromoji.js'
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })
      }
    }
  }
}) 