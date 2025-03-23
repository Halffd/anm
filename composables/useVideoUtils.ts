import { ref } from 'vue'

export function useVideoUtils() {
  // Format time in MM:SS format
  function formatTime(seconds: number): string {
    if (isNaN(seconds)) return '00:00'
    
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  
  // Generate WebVTT content from captions
  function generateWebVTT(captions: any[]): string {
    if (!captions || !captions.length) return 'WEBVTT\n\n'
    
    let vttContent = 'WEBVTT\n\n'
    
    captions.forEach((caption, index) => {
      const startTime = formatVTTTime(caption.startTime)
      const endTime = formatVTTTime(caption.endTime)
      
      vttContent += `${index + 1}\n`
      vttContent += `${startTime} --> ${endTime}\n`
      vttContent += `${caption.text}\n\n`
    })
    
    return vttContent
  }
  
  // Format time for VTT format (HH:MM:SS.mmm)
  function formatVTTTime(seconds: number): string {
    if (isNaN(seconds)) return '00:00:00.000'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const milliseconds = Math.floor((seconds % 1) * 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
  }
  
  // Detect language from text
  function detectLanguage(text: string): string {
    if (!text) return 'unknown'
    
    // Check for Japanese characters
    const japaneseRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/
    if (japaneseRegex.test(text)) return 'ja'
    
    // Check for Korean characters
    const koreanRegex = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/
    if (koreanRegex.test(text)) return 'ko'
    
    // Check for Chinese characters (simplified and traditional)
    const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\u{2b820}-\u{2ceaf}\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f\uf900-\ufaff\u{2f800}-\u{2fa1f}]/u
    if (chineseRegex.test(text)) return 'zh'
    
    // Default to English
    return 'en'
  }
  
  return {
    formatTime,
    generateWebVTT,
    formatVTTTime,
    detectLanguage
  }
} 