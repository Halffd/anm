<script setup lang="ts">
import { useSettingsStore } from '~/stores/settings'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'close': []
}>()

const settings = useSettingsStore()
</script>

<template>
  <div 
    v-if="show" 
    class="settings-menu-overlay"
    @click.self="emit('close')"
  >
    <div class="settings-menu">
      <div class="settings-header">
        <h3>Settings</h3>
        <button @click="emit('close')" class="close-button">×</button>
      </div>
      
      <div class="settings-section">
        <h4>Video</h4>
        <div class="setting-item">
          <label>Video Alignment</label>
          <div class="setting-controls">
            <select v-model="settings.videoAlignment" @change="settings.saveSettings()">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
        
        <div class="setting-item">
          <label>Show Video Controls</label>
          <div class="setting-controls">
            <input type="checkbox" v-model="settings.showVideoControls" @change="settings.saveSettings()">
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <h4>Primary Subtitles</h4>
        <div class="setting-item">
          <label>Font Size</label>
          <div class="setting-controls">
            <button @click="settings.adjustFontSize(false, false)">-</button>
            <span>{{ settings.primarySubtitleFontSize.toFixed(1) }}</span>
            <button @click="settings.adjustFontSize(false, true)">+</button>
          </div>
        </div>
        
        <div class="setting-item">
          <label>Font Family</label>
          <div class="setting-controls">
            <select v-model="settings.subtitleFontFamily" @change="settings.saveSettings()">
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Noto Sans JP', sans-serif">Noto Sans JP</option>
              <option value="'Hiragino Kaku Gothic Pro', sans-serif">Hiragino</option>
              <option value="'MS Gothic', sans-serif">MS Gothic</option>
            </select>
          </div>
        </div>
        
        <div class="setting-item">
          <label>Font Style</label>
          <div class="setting-controls font-style-controls">
            <button 
              class="font-style-btn" 
              :class="{ active: settings.subtitleFontWeight === 700 }"
              @click="settings.adjustFontWeight(false, settings.subtitleFontWeight !== 700)"
            >B</button>
            <button 
              class="font-style-btn" 
              :class="{ active: settings.subtitleFontStyle === 'italic' }"
              @click="settings.subtitleFontStyle = settings.subtitleFontStyle === 'italic' ? 'normal' : 'italic'; settings.saveSettings()"
            >I</button>
            <button 
              class="font-style-btn" 
              :class="{ active: settings.subtitleTextDecoration === 'underline' }"
              @click="settings.subtitleTextDecoration = settings.subtitleTextDecoration === 'underline' ? 'none' : 'underline'; settings.saveSettings()"
            >U</button>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <h4>Secondary Subtitles</h4>
        <div class="setting-item">
          <label>Font Size</label>
          <div class="setting-controls">
            <button @click="settings.adjustFontSize(true, false)">-</button>
            <span>{{ settings.secondarySubtitleFontSize.toFixed(1) }}</span>
            <button @click="settings.adjustFontSize(true, true)">+</button>
          </div>
        </div>
        
        <div class="setting-item">
          <label>Font Style</label>
          <div class="setting-controls font-style-controls">
            <button 
              class="font-style-btn" 
              :class="{ active: settings.secondarySubtitleFontWeight === 700 }"
              @click="settings.adjustFontWeight(true, settings.secondarySubtitleFontWeight !== 700)"
            >B</button>
            <button 
              class="font-style-btn" 
              :class="{ active: settings.secondarySubtitleFontStyle === 'italic' }"
              @click="settings.secondarySubtitleFontStyle = settings.secondarySubtitleFontStyle === 'italic' ? 'normal' : 'italic'; settings.saveSettings()"
            >I</button>
            <button 
              class="font-style-btn" 
              :class="{ active: settings.secondarySubtitleTextDecoration === 'underline' }"
              @click="settings.secondarySubtitleTextDecoration = settings.secondarySubtitleTextDecoration === 'underline' ? 'none' : 'underline'; settings.saveSettings()"
            >U</button>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <h4>Features</h4>
        <div class="setting-item">
          <label>Show Furigana</label>
          <div class="setting-controls">
            <input type="checkbox" v-model="settings.showFurigana" @change="settings.saveSettings()">
          </div>
        </div>
        
        <div class="setting-item">
          <label>Colorize Words</label>
          <div class="setting-controls">
            <input type="checkbox" v-model="settings.colorizeWords" @change="settings.saveSettings()">
          </div>
        </div>
        
        <div class="setting-item">
          <label>Anki Integration</label>
          <div class="setting-controls">
            <input type="checkbox" v-model="settings.ankiEnabled" @change="settings.saveSettings()">
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Import the shared styles */
@import '@/assets/css/video-player.css';

/* Component-specific styles */
.settings-menu {
  position: absolute;
  bottom: 60px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 16px;
  border-radius: 4px;
  width: 300px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 10;
}

.settings-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #374151;
}

.settings-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-button {
  background: transparent;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.close-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.settings-section {
  padding: 16px;
  border-bottom: 1px solid #374151;
}

.settings-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 500;
  color: #9ca3af;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-controls button {
  background-color: #4b5563;
  border: none;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.setting-controls button:hover {
  background-color: #6b7280;
}

.setting-controls select {
  background-color: #4b5563;
  border: none;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.setting-controls input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.font-style-controls {
  display: flex;
  gap: 4px;
}

.font-style-btn {
  width: 30px !important;
  height: 30px !important;
  font-weight: bold;
  font-family: serif;
}

.font-style-btn.active {
  background-color: #60a5fa !important;
  color: #fff;
}

.font-style-btn:nth-child(2) {
  font-style: italic;
}
</style> 