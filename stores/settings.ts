import { defineStore } from 'pinia'
import { $fetch } from 'ofetch'

interface RegexReplacement {
  regex: string
  replaceText: string
}

interface Settings {
  videoAlignment: 'left' | 'center' | 'right'
  showVideoControls: boolean
  primarySubtitleFontSize: number
  secondarySubtitleFontSize: number
  subtitleFontFamily: string
  secondarySubtitleFontFamily: string
  subtitleFontWeight: number
  secondarySubtitleFontWeight: number
  primarySubtitleShadow: string
  secondarySubtitleShadow: string
  subtitleFontStyle: 'normal' | 'italic'
  secondarySubtitleFontStyle: 'normal' | 'italic'
  subtitleTextDecoration: 'none' | 'underline'
  secondarySubtitleTextDecoration: 'none' | 'underline'
  regexReplacements: RegexReplacement[]
  regexReplacementsEnabled: boolean
  tokenizationMethod: 'kuromoji' | 'sudachi'
  colorizeWords: boolean
  autoColorizeJapanese: boolean
  hideControlButtons: boolean
  hidePlayerControls: boolean
  videoPositions: Record<string, number>
  ankiEnabled: boolean
  showFurigana: boolean
}

export const useSettingsStore = defineStore('settings', {
  state: (): Settings => ({
    videoAlignment: 'center',
    showVideoControls: true,
    primarySubtitleFontSize: 1.5,
    secondarySubtitleFontSize: 1.2,
    subtitleFontFamily: 'Arial, sans-serif',
    secondarySubtitleFontFamily: 'Arial, sans-serif',
    subtitleFontWeight: 400,
    secondarySubtitleFontWeight: 400,
    primarySubtitleShadow: '2px 2px 3px rgba(0, 0, 0, 0.8)',
    secondarySubtitleShadow: '2px 2px 3px rgba(0, 0, 0, 0.8)',
    subtitleFontStyle: 'normal',
    secondarySubtitleFontStyle: 'normal',
    subtitleTextDecoration: 'none',
    secondarySubtitleTextDecoration: 'none',
    regexReplacements: [
      { regex: '\\(\\(.*?\\)\\)', replaceText: '' },
      { regex: '\\(.*?\\)', replaceText: '' },
      { regex: '（.*?）', replaceText: '' }
    ],
    regexReplacementsEnabled: true,
    tokenizationMethod: 'kuromoji',
    colorizeWords: true,
    autoColorizeJapanese: true,
    hideControlButtons: false,
    hidePlayerControls: false,
    videoPositions: {},
    ankiEnabled: true,
    showFurigana: true
  }),

  actions: {
    loadSettings() {
      try {
        const saved = localStorage.getItem('Anm-settings')
        if (saved) {
          const parsed = JSON.parse(saved)
          this.$patch(parsed)
        }
      } catch (e) {
        console.error('Failed to load settings:', e)
      }
    },

    saveSettings() {
      try {
        localStorage.setItem('Anm-settings', JSON.stringify(this.$state))
      } catch (e) {
        console.error('Failed to save settings:', e)
      }
    },

    addRegexReplacement() {
      this.regexReplacements.push({ regex: '', replaceText: '' })
      this.saveSettings()
    },

    removeRegexReplacement(index: number) {
      this.regexReplacements.splice(index, 1)
      this.saveSettings()
    },

    toggleRegexReplacements() {
      this.regexReplacementsEnabled = !this.regexReplacementsEnabled
      this.saveSettings()
    },

    async setTokenizationMethod(method: 'kuromoji' | 'sudachi') {
      try {
        await $fetch('/api/settings/tokenizer', {
          method: 'POST',
          body: { method }
        })
        this.tokenizationMethod = method
        this.saveSettings()
      } catch (e) {
        console.error('Failed to set tokenization method:', e)
      }
    },

    adjustFontSize(isSecondary: boolean, increase: boolean) {
      const step = 0.1
      const min = 0.5
      const max = 2.5
      
      if (isSecondary) {
        this.secondarySubtitleFontSize = Math.min(
          Math.max(this.secondarySubtitleFontSize + (increase ? step : -step), min),
          max
        )
      } else {
        this.primarySubtitleFontSize = Math.min(
          Math.max(this.primarySubtitleFontSize + (increase ? step : -step), min),
          max
        )
      }
      
      this.saveSettings()
    },

    adjustFontWeight(isSecondary: boolean, increase: boolean) {
      if (isSecondary) {
        this.secondarySubtitleFontWeight = increase ? 700 : 400;
      } else {
        this.subtitleFontWeight = increase ? 700 : 400;
      }
      this.saveSettings();
    },

    saveVideoPosition(videoPath: string, position: number) {
      this.videoPositions[videoPath] = position
      this.saveSettings()
    },

    getVideoPosition(videoPath: string): number {
      return this.videoPositions[videoPath] || 0
    },

    clearVideoPosition(videoPath: string) {
      delete this.videoPositions[videoPath]
      this.saveSettings()
    }
  }
}) 