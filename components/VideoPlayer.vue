<script setup lang="ts">
import { ref, watch, computed, onUnmounted, onMounted } from 'vue'
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

// Get utilities
const { createKeyboardHandler } = useInputHandlers()

// Define Token interface
interface Token {
  surface_form: string;
  surface: string;
  reading: string;
  pos: string;
  basic_form: string;
  isHighlighted: boolean;
  status?: 'new' | 'known' | 'mature';
}

// Define HTMLVideoElementWithAudioTracks interface
interface HTMLVideoElementWithAudioTracks extends HTMLVideoElement {
  audioTracks?: {
    length: number
    [index: number]: {
      enabled: boolean
      language?: string
      label?: string
    }
  }
}

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
}>()

const store = useCaptionsStore()
const settings = useSettingsStore()
const videoControls = useVideoControls()
const ankiExtension = useAnkiExtension()

// Add SPACE_DELAY at top level
const SPACE_DELAY = 300 // Delay between space presses in ms

const showSubtitleInfo = ref(false)
const isHovering = ref(false)
const lastMouseMoveTime = ref(Date.now())
const controlsHidden = ref(false)
const showSubtitleList = ref(true)
const showControls = ref(true)
const showSettingsMenu = ref(false)

// Use the video player composable
const {
  videoRef,
  isPlaying,
  volume,
  isMuted,
  isFullscreen,
  videoDuration,
  playbackRate,
  audioTracks,
  selectedAudioTrack,
  captionsUrl,
  togglePlayPause,
  seek,
  handleVolumeChange,
  toggleMute,
  toggleFullscreen,
  onFullscreenChange,
  onTimeUpdate: videoPlayerTimeUpdate,
  onDurationChange,
  onVideoEnded,
  adjustPlaybackRate: videoPlayerAdjustPlaybackRate,
  cycleAudioTrack
} = useVideoPlayer(props)

// Use the captions control composable
const {
  captionsVisible,
  captionsPanelVisible,
  toggleCaptions,
  toggleCaptionsPanel
} = useCaptionsControl()

// Use the video metadata composable
const {
  videoTitle,
  videoLanguage,
  videoSource,
  videoAlignmentStyle,
  updateMetadata,
  detectVideoLanguage
} = useVideoMetadata({
  videoUrl: props.videoUrl,
  videoAlignment: props.videoAlignment,
  settingsAlignment: settings.videoAlignment
})

// Update hasSubtitles to use allActiveCaptions instead of activeCaptions
const hasSubtitles = computed(() => store.showSubtitles && store.allActiveCaptions.length > 0)

// Add computed property to check if we have secondary subtitles
const hasSecondarySubtitles = computed(() => {
  // Check if we have any active captions from secondary tracks
  return store.subtitleTracks.some((track, index) => 
    index !== store.activeTrackIndex && 
    track.captions.some(caption => 
      caption.startTime <= props.currentTime && 
      props.currentTime <= caption.endTime
    )
  )
})

// Add function to handle time updates
function handleTimeUpdate() {
  if (videoRef.value) {
    emit('timeupdate', videoRef.value.currentTime)
  }
}

function onError(e: Event) {
  const video = e.target as HTMLVideoElement
  emit('error', new Error(video.error?.message || 'Video error'))
}

// Function to handle mouse movement
function handleMouseMove() {
  isHovering.value = true
  lastMouseMoveTime.value = Date.now()
  controlsHidden.value = false
}

// Function to toggle controls visibility
function toggleControlsVisibility() {
  controlsHidden.value = !controlsHidden.value
}

function onMetadataLoaded(e: Event) {
  const video = e.target as HTMLVideoElementWithAudioTracks
  
  // Set video duration and title
  if (video) {
    videoDuration.value = video.duration
  }
  
  // Check for audio tracks
  if (video?.audioTracks && video.audioTracks.length > 0) {
    for (let i = 0; i < video.audioTracks.length; i++) {
      audioTracks.value.push({
        enabled: video.audioTracks[i].enabled,
        language: video.audioTracks[i].language,
        label: video.audioTracks[i].label
      })
    }
  }
}

function enableAudioTrack(index: number) {
  const video = videoRef.value as HTMLVideoElementWithAudioTracks | undefined
  if (!video?.audioTracks) return
  
  for (let i = 0; i < video.audioTracks.length; i++) {
    video.audioTracks[i].enabled = (i === index)
  }
  
  selectedAudioTrack.value = index
  
  if (props.onAudioTrackChange) {
    props.onAudioTrackChange(index)
  }
}

// Format time in MM:SS or HH:MM:SS format
function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '00:00'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Add subtitle file input
const subtitleFileInput = ref<HTMLInputElement>()

function openSubtitleFileDialog() {
  if (!subtitleFileInput.value) {
    return
  }
  subtitleFileInput.value.click()
}

// Add function to toggle settings menu
function toggleSettingsMenu() {
  showSettingsMenu.value = !showSettingsMenu.value
}

// Add function to handle toggle captions
function handleToggleCaptions(visible: boolean) {
  toggleCaptions()
  emit('toggle-captions', visible)
}

// Add function to handle toggle captions panel
function handleToggleCaptionsPanel(visible: boolean) {
  toggleCaptionsPanel()
  emit('toggle-captions-panel', visible)
}

// Setup keyboard shortcuts
const keyboardShortcuts = {
  ' ': togglePlayPause,
  'ArrowLeft': () => seek(props.currentTime - 5),
  'ArrowRight': () => seek(props.currentTime + 5),
  'ArrowUp': () => handleVolumeChange(Math.min(1, volume.value + 0.1)),
  'ArrowDown': () => handleVolumeChange(Math.max(0, volume.value - 0.1)),
  'm': toggleMute,
  'f': toggleFullscreen,
  'c': handleToggleCaptions,
  'p': handleToggleCaptionsPanel,
  's': toggleSettingsMenu,
  'y': toggleControlsVisibility
}

// Register keyboard handler
onMounted(() => {
  const handleKeyDown = createKeyboardHandler(keyboardShortcuts)
  document.addEventListener('keydown', handleKeyDown)
  
  // Set up auto-hide timer for controls
  const autoHideInterval = setInterval(() => {
    if (isPlaying.value && Date.now() - lastMouseMoveTime.value > 3000) {
      isHovering.value = false
    }
  }, 1000)
  
  // Cleanup on unmount
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
    clearInterval(autoHideInterval)
  })
})

// Setup event listeners
onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})
</script>

<template>
  <div 
    class="video-container" 
    :class="[`align-${props.videoAlignment || settings.videoAlignment || 'center'}`]"
    @mousemove="handleMouseMove"
    @mouseleave="isHovering = false"
  >
    <video 
      ref="videoRef"
      :src="videoSource"
      class="video-element"
      @timeupdate="handleTimeUpdate"
      @durationchange="onDurationChange"
      @play="isPlaying = true; emit('playing')"
      @pause="isPlaying = false; emit('pause')"
      @ended="onVideoEnded; emit('ended')"
      @click="togglePlayPause"
      @error="(e) => emit('error', new Error('Video playback error'))"
      :style="{ objectPosition: videoAlignmentStyle }"
    >
      <track 
        v-if="captionsUrl" 
        kind="subtitles" 
        :src="captionsUrl" 
        label="Generated Subtitles" 
        :default="true"
      >
    </video>
    
    <!-- Use the VideoControls component -->
    <VideoControls 
      v-if="(showControls || isHovering) && !controlsHidden"
      :is-playing="isPlaying"
      :current-time="props.currentTime"
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
      @subtitle-upload="emit('subtitle-upload', $event)"
      @toggle-captions-panel="handleToggleCaptionsPanel($event)"
    />
    
    <!-- Use the SettingsMenu component -->
    <SettingsMenu 
      :show="showSettingsMenu"
      @close="showSettingsMenu = false"
    />
  </div>
</template>

<style scoped>
/* Import the shared styles */
@import '@/assets/css/video-player.css';
</style>