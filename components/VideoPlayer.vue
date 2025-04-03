<script setup lang="ts">
import { ref, watch, computed, onUnmounted, onMounted, nextTick, onBeforeUnmount } from 'vue'
import type { Caption } from '~/types'
import { useCaptionsStore } from '~/stores/captions'
import { useSettingsStore } from '~/stores/settings'
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'
import { useVideoControls } from '~/composables/useVideoControls'
import { useAnkiExtension } from '~/composables/useAnkiExtension'
import VideoControls from '~/components/video/VideoControls.vue'
import SettingsMenu from '~/components/video/SettingsMenu.vue'
import { useVideoUtils } from '~/composables/useVideoUtils'
import { useInputHandlers } from '~/composables/useInputHandlers'
import { useVideoPlayer } from '~/composables/useVideoPlayer'
import { useCaptionsControl } from '~/composables/useCaptionsControl'
import { useVideoMetadata } from '~/composables/useVideoMetadata'
import VideoJSPlayer from '~/components/VideoJSPlayer.vue'
import { loadSubtitleFile } from '~/utils/subtitleLoader'

// Get utilities
const { createKeyboardHandler } = useInputHandlers()

// Define props and emits
const props = defineProps<{
  videoUrl?: string | null
  captions: Caption[]
  currentTime: number
  onAudioTrackChange?: (track: number) => void
  videoAlignment?: 'left' | 'center' | 'right'
}>()

const emit = defineEmits<{
  'timeupdate': [time: number]
  'error': [error: Error]
  'notify': [message: string]
  'audio-track-change': [track: number]
  'playing': []
  'pause': []
  'ended': []
  'toggle-captions': [visible: boolean]
  'subtitle-upload': [file: File]
  'toggle-captions-panel': [visible: boolean]
  'toggle-sidebar': [value: boolean]
}>()

// Store and state
const store = useCaptionsStore()
const settings = useSettingsStore()
const videoControls = useVideoControls()
const ankiExtension = useAnkiExtension()

// Player state
const player = ref(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const videoDuration = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const isFullscreen = ref(false)
const subtitleTracks = ref([])
const showSubtitles = ref(true)

// UI state
const isHovering = ref(false)
const lastMouseMoveTime = ref(Date.now())
const controlsHidden = ref(false)
const showControls = ref(true)
const showSettingsMenu = ref(false)

// Video source
const videoSource = computed(() => {
  return props.videoUrl || ''
})

// Player event handlers
function onPlayerReady(player) {
  console.log('Player is ready')
}

function onPlay() {
  isPlaying.value = true
  emit('playing')
}

function onPause() {
  isPlaying.value = false
  emit('pause')
}

function onTimeUpdate(time) {
  currentTime.value = time
  emit('timeupdate', time)
}

function onEnded() {
  emit('ended')
}

function onError(error) {
  emit('error', new Error(error.message || 'Video playback error'))
}

// Player controls
function togglePlayPause() {
  if (player.value) {
    if (isPlaying.value) {
      player.value.pause()
    } else {
      player.value.play()
    }
  }
}

function seek(time) {
  if (player.value) {
    player.value.currentTime(time)
  }
}

function handleVolumeChange(newVolume) {
  volume.value = newVolume
  if (player.value) {
    player.value.volume(newVolume)
  }
}

function toggleMute() {
  isMuted.value = !isMuted.value
  if (player.value) {
    player.value.muted(isMuted.value)
  }
}

function toggleFullscreen() {
  if (player.value) {
    if (isFullscreen.value) {
      player.value.exitFullscreen()
    } else {
      player.value.requestFullscreen()
    }
    isFullscreen.value = !isFullscreen.value
  }
}

// Subtitle handling
async function handleSubtitleUpload(file) {
  try {
    const track = await loadSubtitleFile(file)
    subtitleTracks.value.push(track)
    emit('notify', `Loaded subtitle: ${file.name}`)
  } catch (error) {
    console.error('Error loading subtitle:', error)
    emit('error', new Error(`Failed to load subtitle: ${error.message}`))
  }
}

function handleToggleCaptions(visible) {
  showSubtitles.value = visible
  if (player.value) {
    const tracks = player.value.textTracks()
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = visible ? 'showing' : 'hidden'
    }
  }
  emit('toggle-captions', visible)
}

function handleToggleCaptionsPanel(visible) {
  emit('toggle-captions-panel', visible)
}

// Word click handler for dictionary lookup
function handleWordClick(word) {
  console.log(`Word clicked: ${word}`)
  // Implement dictionary lookup or Anki export
  if (ankiExtension.isExtensionAvailable) {
    ankiExtension.lookupWord(word)
  }
}

// Mouse movement handler
function handleMouseMove() {
  isHovering.value = true
  lastMouseMoveTime.value = Date.now()
  
  // Hide controls after inactivity
  setTimeout(() => {
    if (Date.now() - lastMouseMoveTime.value > 3000) {
      isHovering.value = false
    }
  }, 3000)
}

// Toggle settings menu
function toggleSettingsMenu() {
  showSettingsMenu.value = !showSettingsMenu.value
}

// Load initial subtitles
onMounted(() => {
  // Convert existing captions to subtitle tracks
  if (props.captions && props.captions.length > 0) {
    // Create a blob URL for the captions
    const captionsText = convertCaptionsToSrt(props.captions)
    const blob = new Blob([captionsText], { type: 'application/x-subrip' })
    const url = URL.createObjectURL(blob)
    
    subtitleTracks.value.push({
      src: url,
      language: 'Default',
      format: 'srt'
    })
  }
})

// Clean up blob URLs on unmount
onUnmounted(() => {
  subtitleTracks.value.forEach(track => {
    if (track.src.startsWith('blob:')) {
      URL.revokeObjectURL(track.src)
    }
  })
})

// Helper to convert captions to SRT format
function convertCaptionsToSrt(captions) {
  return captions.map((caption, index) => {
    const startTime = formatSrtTime(caption.startTime)
    const endTime = formatSrtTime(caption.endTime)
    return `${index + 1}\n${startTime} --> ${endTime}\n${caption.text}\n`
  }).join('\n')
}

// Format time for SRT
function formatSrtTime(seconds) {
  const date = new Date(seconds * 1000)
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const secs = date.getUTCSeconds().toString().padStart(2, '0')
  const ms = date.getUTCMilliseconds().toString().padStart(3, '0')
  return `${hours}:${minutes}:${secs},${ms}`
}

// Add these new state variables
const sidebarActive = ref(false);
const activeSubtitleTrack = ref(0);
const fontSize = ref(1.0);
const subtitleDelay = ref(0);

// Toggle sidebar
function toggleSidebar(value = null) {
  sidebarActive.value = value !== null ? value : !sidebarActive.value;
  
  // Resize player when sidebar state changes
  nextTick(() => {
    if (player.value) {
      player.value.play(); // Trigger resize
    }
  });
}

// Set active subtitle track
function setActiveSubtitleTrack(index) {
  activeSubtitleTrack.value = index;
  if (player.value) {
    player.value.showTextTrack(index, true);
  }
}

// Toggle subtitle track visibility
function toggleSubtitleTrack(index) {
  if (activeSubtitleTrack.value === index) {
    activeSubtitleTrack.value = -1; // Hide all
    if (player.value) {
      player.value.showTextTrack(index, false);
    }
  } else {
    setActiveSubtitleTrack(index);
  }
}

// Adjust font size
function adjustFontSize(increase) {
  fontSize.value = Math.max(0.5, Math.min(2.0, fontSize.value + (increase ? 0.1 : -0.1)));
  
  // Apply font size to subtitles
  const subtitleElements = document.querySelectorAll('.vjs-ass-subtitles, .vjs-text-track-display');
  subtitleElements.forEach(el => {
    (el as HTMLElement).style.fontSize = `${fontSize.value}em`;
  });
}

// Adjust subtitle delay
function adjustDelay(amount) {
  subtitleDelay.value = Math.max(-10, Math.min(10, subtitleDelay.value + amount));
  
  // Apply delay to current subtitle track
  if (player.value && activeSubtitleTrack.value >= 0) {
    // For ASS subtitles
    const assPlugin = player.value.player_.ass;
    if (assPlugin) {
      assPlugin.delay = subtitleDelay.value;
    }
    
    // For standard subtitles, we need to reload with the new delay
    // This is a simplified approach - a more complete solution would
    // need to modify the cue timing directly
  }
}

// Add keyboard shortcut for sidebar toggle
onMounted(() => {
  window.addEventListener('keydown', (e) => {
    // Toggle sidebar with 'S' key
    if (e.key === 's' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      toggleSidebar();
    }
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', (e) => {
    if (e.key === 's' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      toggleSidebar();
    }
  });
});
</script>

<template>
  <div 
    class="player-container" 
    :class="{ 'sidebar-active': sidebarActive }"
  >
    <div class="video-wrapper">
      <VideoJSPlayer
        ref="player"
        :src="videoSource"
        :subtitles="subtitleTracks"
        :width="1280"
        :height="720"
        :autoplay="false"
        :controls="true"
        :sidebar-active="sidebarActive"
        :show-sidebar-toggle="true"
        @ready="onPlayerReady"
        @play="onPlay"
        @pause="onPause"
        @timeupdate="onTimeUpdate"
        @ended="onEnded"
        @error="onError"
        @word-click="handleWordClick"
        @toggle-sidebar="toggleSidebar"
      />
      
      <!-- Use the VideoControls component -->
      <VideoControls 
        v-if="(showControls || isHovering) && !controlsHidden"
        :is-playing="isPlaying"
        :current-time="currentTime"
        :duration="videoDuration"
        :volume="volume"
        :is-muted="isMuted"
        :is-fullscreen="isFullscreen"
        :show-settings="showSettingsMenu"
        @play="togglePlayPause()?.then(() => emit('playing'))"
        @pause="togglePlayPause()?.then(() => emit('pause'))"
        @seek="seek"
        @volume-change="handleVolumeChange"
        @toggle-mute="toggleMute"
        @toggle-fullscreen="toggleFullscreen"
        @toggle-settings="toggleSettingsMenu"
        @toggle-captions="handleToggleCaptions($event)"
        @subtitle-upload="handleSubtitleUpload"
        @toggle-captions-panel="handleToggleCaptionsPanel($event)"
      />
    </div>
    
    <!-- Sidebar -->
    <div v-if="sidebarActive" class="sidebar">
      <div class="sidebar-header">
        <h3>Subtitles</h3>
        <button class="close-button" @click="toggleSidebar(false)">×</button>
      </div>
      
      <div class="sidebar-content">
        <!-- Subtitle tracks list -->
        <div class="subtitle-tracks">
          <h4>Available Tracks</h4>
          <div 
            v-for="(track, index) in subtitleTracks" 
            :key="index"
            class="subtitle-track-item"
            :class="{ 'active': activeSubtitleTrack === index }"
            @click="setActiveSubtitleTrack(index)"
          >
            <div class="track-info">
              <div class="track-name">{{ track.label || track.language }}</div>
              <div class="track-language">{{ track.language }}</div>
            </div>
            <div class="track-actions">
              <button 
                class="track-toggle" 
                :class="{ 'active': activeSubtitleTrack === index }"
                @click.stop="toggleSubtitleTrack(index)"
              >
                {{ activeSubtitleTrack === index ? 'Hide' : 'Show' }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- Upload new subtitle -->
        <div class="upload-subtitle">
          <h4>Add Subtitle</h4>
          <div class="upload-controls">
            <label class="upload-button">
              Browse
              <input 
                type="file" 
                accept=".srt,.vtt,.ass,.ssa" 
                @change="handleSubtitleUpload($event.target.files[0])" 
                hidden
              >
            </label>
            <span class="upload-info">Supports SRT, VTT, ASS/SSA</span>
          </div>
        </div>
        
        <!-- Subtitle settings -->
        <div class="subtitle-settings">
          <h4>Settings</h4>
          
          <div class="setting-item">
            <label>Font Size</label>
            <div class="setting-controls">
              <button @click="adjustFontSize(false)">-</button>
              <span>{{ fontSize.toFixed(1) }}</span>
              <button @click="adjustFontSize(true)">+</button>
            </div>
          </div>
          
          <div class="setting-item">
            <label>Delay (seconds)</label>
            <div class="setting-controls">
              <button @click="adjustDelay(-0.1)">-</button>
              <span>{{ subtitleDelay.toFixed(1) }}</span>
              <button @click="adjustDelay(0.1)">+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Settings Menu component -->
    <SettingsMenu 
      :show="showSettingsMenu"
      @close="showSettingsMenu = false"
    />
  </div>
</template>

<style scoped>
/* Import the shared styles */
@import '@/assets/css/video-player.css';

.player-container {
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
  background-color: #000;
}

.video-wrapper {
  flex: 1;
  position: relative;
  transition: width 0.3s ease;
}

/* Sidebar styles */
.sidebar {
  width: 350px;
  background-color: #1a1a1a;
  color: #fff;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #333;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #333;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-button {
  background: none;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
}

.sidebar-content {
  padding: 15px;
  flex: 1;
  overflow-y: auto;
}

.subtitle-tracks, .upload-subtitle, .subtitle-settings {
  margin-bottom: 20px;
}

h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #ccc;
}

.subtitle-track-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 5px;
  background-color: #2a2a2a;
  cursor: pointer;
}

.subtitle-track-item:hover {
  background-color: #333;
}

.subtitle-track-item.active {
  background-color: #3a3a3a;
  border-left: 3px solid #60a5fa;
}

.track-info {
  flex: 1;
}

.track-name {
  font-weight: 500;
}

.track-language {
  font-size: 12px;
  color: #aaa;
}

.track-actions {
  display: flex;
  gap: 5px;
}

.track-toggle {
  background-color: #444;
  border: none;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.track-toggle:hover {
  background-color: #555;
}

.track-toggle.active {
  background-color: #60a5fa;
}

.upload-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-button {
  background-color: #60a5fa;
  color: #fff;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: inline-block;
}

.upload-button:hover {
  background-color: #3b82f6;
}

.upload-info {
  font-size: 12px;
  color: #aaa;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.setting-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.setting-controls button {
  width: 30px;
  height: 30px;
  background-color: #444;
  border: none;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.setting-controls button:hover {
  background-color: #555;
}

/* Responsive styles */
@media (max-width: 768px) {
  .player-container {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    height: 300px;
    border-left: none;
    border-top: 1px solid #333;
  }
}
</style>