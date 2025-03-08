import { onMounted, onUnmounted } from 'vue'

type KeyHandler = (e: KeyboardEvent) => void
type KeyHandlers = Record<string, KeyHandler>

export function useKeyboardShortcuts(handlers: KeyHandlers) {
  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement
    if (target && (
      /textarea|select/i.test(target.tagName) ||
      target.hasAttribute('contenteditable') ||
      target instanceof HTMLInputElement
    )) {
      return
    }

    const handler = handlers[e.key]
    if (handler) {
      e.preventDefault()
      handler(e)
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
} 