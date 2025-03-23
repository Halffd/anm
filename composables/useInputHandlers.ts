import { ref } from 'vue'

export function useInputHandlers() {
  const lastKeyPressTime = ref(0)
  const keyPressDelay = 300 // ms
  
  // Debounce function to prevent rapid key presses
  function debounce(func: Function, delay: number = keyPressDelay) {
    const now = Date.now()
    if (now - lastKeyPressTime.value > delay) {
      lastKeyPressTime.value = now
      func()
    }
  }
  
  // Create a keyboard shortcut handler
  function createKeyboardHandler(shortcuts: Record<string, Function>) {
    return function handleKeyDown(event: KeyboardEvent) {
      // Don't trigger shortcuts when typing in input fields
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement) {
        return
      }
      
      // Check for modifier keys
      const hasCtrl = event.ctrlKey
      const hasShift = event.shiftKey
      const hasAlt = event.altKey
      
      // Create a key identifier that includes modifiers
      const keyWithModifiers = [
        hasCtrl ? 'Ctrl+' : '',
        hasShift ? 'Shift+' : '',
        hasAlt ? 'Alt+' : '',
        event.key
      ].join('')
      
      // Check if we have a handler for this key
      if (shortcuts[event.key]) {
        debounce(() => shortcuts[event.key]())
        return
      }
      
      // Check if we have a handler for this key with modifiers
      if (shortcuts[keyWithModifiers]) {
        debounce(() => shortcuts[keyWithModifiers]())
        return
      }
    }
  }
  
  return {
    debounce,
    createKeyboardHandler
  }
} 