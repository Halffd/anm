<script setup lang="ts">
import { ref, watch, computed, onUnmounted, onMounted } from 'vue'
import type { Caption } from '~/types'
import { useCaptionsStore } from '~/stores/captions'
import { useSettingsStore } from '~/stores/settings'
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'
import { useVideoControls } from '~/composables/useVideoControls'

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
  videoUrl: string
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
}>()

const videoRef = ref<HTMLVideoElement>()
const store = useCaptionsStore()
const settings = useSettingsStore()
const videoControls = useVideoControls()

// Add SPACE_DELAY at top level
const SPACE_DELAY = 300 // Delay between space presses in ms

interface AudioTrack {
  enabled: boolean
  language?: string
  label?: string
}

const audioTracks = ref<AudioTrack[]>([])
const selectedAudioTrack = ref<number>(0)
const playbackRate = ref(1)
const showSubtitleInfo = ref(false)
const isHovering = ref(false)
const showSubtitleList = ref(true)

// Add new refs for video details
const videoDuration = ref(0)
const videoTitle = ref('')

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

// Add computed property for captions URL
const captionsUrl = computed(() => {
  if (!props.captions?.length) return ''
  
  // Create blob URL for captions
  const vttContent = generateWebVTT(props.captions)
  const blob = new Blob([vttContent], { type: 'text/vtt' })
  return URL.createObjectURL(blob)
})

// Convert video URL to streaming endpoint URL
const streamingUrl = computed(() => {
  if (!props.videoUrl) return ''
  return `/api/videos/stream/${encodeURIComponent(props.videoUrl)}`
})

// Helper function to generate WebVTT content
function generateWebVTT(captions: Caption[]): string {
  const vttParts = ['WEBVTT\n\n']
  
  captions.forEach((caption, index) => {
    const startTime = formatVTTTime(caption.startTime)
    const endTime = formatVTTTime(caption.endTime)
    
    vttParts.push(`${index + 1}
${startTime} --> ${endTime}
${caption.text}\n\n`)
  })
  
  return vttParts.join('')
}

function formatVTTTime(seconds: number): string {
  const date = new Date(seconds * 1000)
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const secs = date.getUTCSeconds().toString().padStart(2, '0')
  const ms = date.getUTCMilliseconds().toString().padStart(3, '0')
  
  return `${hours}:${minutes}:${secs}.${ms}`
}

// Handle video time updates
watch(() => props.currentTime, (newTime) => {
  if (videoRef.value && Math.abs(videoRef.value.currentTime - newTime) > 0.1) {
    videoRef.value.currentTime = newTime
  }
})

function onTimeUpdate(e: Event) {
  const video = e.target as HTMLVideoElement
  emit('timeupdate', video.currentTime)

  // Handle auto-pause - only if explicitly enabled
  if (store.isAutoPauseMode) {
    // Get active captions from the active track only
    const activeTrackCaptions = store.activeTrack?.captions.filter(caption => 
      caption.startTime <= video.currentTime && 
      video.currentTime <= caption.endTime
    ) || []
    
    // Only pause if we have active captions and the video time exceeds the end time
    if (activeTrackCaptions.length > 0) {
      const lastCaption = activeTrackCaptions[activeTrackCaptions.length - 1]
      
      // Only pause if we've just passed the end time (within 0.1 seconds)
      // Also check if we haven't just paused recently (within 1 second)
      const timeSinceLastPause = store.lastPauseTime ? video.currentTime - store.lastPauseTime : Infinity
      
      if (video.currentTime > lastCaption.endTime && 
          video.currentTime < lastCaption.endTime + 0.1 && 
          !video.paused &&
          timeSinceLastPause > 1.0) {
        console.log(`[Player] Auto-pausing at ${video.currentTime}, caption end: ${lastCaption.endTime}`)
        video.pause()
        store.lastPauseTime = video.currentTime
      }
    }
  }
}

function onError(e: Event) {
  const video = e.target as HTMLVideoElement
  emit('error', new Error(video.error?.message || 'Video error'))
}

function onLoad(e: Event) {
  const video = e.target as HTMLVideoElementWithAudioTracks
  if (!video.audioTracks || video.audioTracks.length === 0) {
    audioTracks.value = []
    selectedAudioTrack.value = -1
    return
  }

  audioTracks.value = Array.from({ 
    length: video.audioTracks.length 
  }, (_, i) => ({
    enabled: video.audioTracks?.[i]?.enabled || false,
    language: video.audioTracks?.[i]?.language,
    label: video.audioTracks?.[i]?.label
  }))
  selectedAudioTrack.value = 0
  enableAudioTrack(0)
}

function enableAudioTrack(index: number) {
  const video = videoRef.value as HTMLVideoElementWithAudioTracks | undefined
  if (!video?.audioTracks) return

  for (let i = 0; i < video.audioTracks.length; i++) {
    if (video.audioTracks[i]) {
      video.audioTracks[i].enabled = i === index
    }
  }
  selectedAudioTrack.value = index
}

function cycleAudioTrack() {
  if (!audioTracks.value.length) return
  
  const nextTrack = (selectedAudioTrack.value + 1) % audioTracks.value.length
  enableAudioTrack(nextTrack)
  
  const track = audioTracks.value[nextTrack]
  emit('notify', `Audio Track: ${nextTrack + 1}/${audioTracks.value.length}` +
    (track.language ? ` [${track.language}]` : '') +
    (track.label ? ` ${track.label}` : ''))
  
  emit('audio-track-change', nextTrack)
}

function adjustPlaybackRate(increase: boolean) {
  const video = videoRef.value
  if (!video) return

  let rate = video.playbackRate
  rate += increase ? 0.05 : -0.05
  rate = Math.max(0.25, Math.min(3, parseFloat(rate.toFixed(2))))
  
  video.playbackRate = rate
  playbackRate.value = rate
  emit('notify', `Playback speed: ${rate.toFixed(2)}x`)
}

// Toggle subtitle track info display
function toggleSubtitleInfo() {
  showSubtitleInfo.value = !showSubtitleInfo.value
  emit('notify', `Video info: ${showSubtitleInfo.value ? 'ON' : 'OFF'}`)
}

// Add ASS tag processing function
function processAssText(text: string): { text: string, position?: string } {
  // Extract ASS tags
  const assTagRegex = /\{([^}]+)\}/g
  let position = 'middle' // Default position
  
  // Process ASS tags
  text = text.replace(assTagRegex, (match, tags) => {
    // Handle \an tags
    const anMatch = tags.match(/\\an?(\d)/)
    if (anMatch) {
      const anValue = parseInt(anMatch[1])
      switch (anValue) {
        case 1: position = 'bottom-left'; break;
        case 2: position = 'bottom'; break;
        case 3: position = 'bottom-right'; break;
        case 4: position = 'middle-left'; break;
        case 5: position = 'middle'; break;
        case 6: position = 'middle-right'; break;
        case 7: position = 'top-left'; break;
        case 8: position = 'top'; break;
        case 9: position = 'top-right'; break;
      }
    }
    
    // Handle SVG tags
    if (tags.includes('\\p1')) {
      // Keep SVG drawing commands
      return match
    }
    
    // Remove other ASS tags
    return ''
  })
  
  return { text, position }
}

// Update processText function
function processText(text: string): { text: string, position?: string } {
  // First apply regex replacements if enabled
  let processed = text
  if (settings.regexReplacementsEnabled && settings.regexReplacements.length) {
    processed = settings.regexReplacements.reduce((processed, { regex, replaceText }) => {
      try {
        return processed.replace(new RegExp(regex, 'g'), replaceText)
      } catch (e) {
        return processed
      }
    }, processed)
  }
  
  // Process ASS tags and get positioning
  const { text: cleanText, position } = processAssText(processed)
  processed = cleanText
  
  // Remove SRT/ASS HTML tags that shouldn't be displayed
  processed = processed
    .replace(/<\/?font[^>]*>/gi, '')
    .replace(/<\/?b>/gi, '')
    .replace(/<\/?i>/gi, '')
    .replace(/<\/?u>/gi, '')
    .replace(/<\/?s>/gi, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
  
  // Check if text contains Japanese characters
  const japaneseMatches = processed.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/g)
  const japaneseCount = japaneseMatches ? japaneseMatches.length : 0
  const totalChars = processed.replace(/\s/g, '').length
  const isJapanese = totalChars > 0 && (japaneseCount / totalChars) >= 0.4
  
  if (!isJapanese) {
    processed = processed
      .replace(/\s+/g, ' ')
      .replace(/([.!?,:;])([a-zA-Z])/g, '$1 $2')
      .trim()
  }
  
  return { text: processed, position }
}

// Process tokens for colored display
function processTokens(tokens: any[]): any[] {
  if (!tokens || !Array.isArray(tokens)) return []
  
  return tokens.map(token => {
    // Ensure token has all required properties
    return {
      surface_form: token.surface_form || token[0] || '',
      reading: token.reading || token[1] || '',
      pos: token.pos || ''
    }
  })
}

// Add position saving
let savePositionInterval: number | null = null

onMounted(() => {
  // Restore saved position
  if (videoRef.value && props.videoUrl) {
    const savedPosition = settings.getVideoPosition(props.videoUrl)
    if (savedPosition > 0) {
      videoRef.value.currentTime = savedPosition
    }
  }

  // Save position periodically
  savePositionInterval = window.setInterval(() => {
    if (videoRef.value && props.videoUrl) {
      settings.saveVideoPosition(props.videoUrl, videoRef.value.currentTime)
    }
  }, 5000) // Save every 5 seconds

  // Update keyboard shortcuts
  useKeyboardShortcuts({
    ' ': (e) => {
      e.preventDefault() // Prevent page scroll
      togglePlay()
    },
    'ArrowLeft': () => skipTime(-3),
    'ArrowRight': () => skipTime(3),
    'a': () => store.previousCaption(),
    'd': () => store.nextCaption(),
    's': () => store.seekToSubtitleStart(),
    'ArrowDown': () => skipTime(-3), // Change to match left/right behavior
    'ArrowUp': () => skipTime(3), // Change to match left/right behavior
    'w': () => skipTime(3), // Match ArrowUp
    'l': () => openSubtitleFileDialog(),
    'j': () => togglePrimarySecondary(),
    'p': () => store.isAutoPauseMode = false,
    'c': () => store.toggleSecondarySubtitles(),
    'v': () => store.toggleSubtitles(),
    'V': () => store.toggleSubtitles(),
    'f': () => store.toggleFurigana(),
    'g': () => settings.colorizeWords = !settings.colorizeWords,
    'i': () => toggleSubtitleInfo(),
    'x': () => store.toggleSidebar(),
    't': () => cycleAudioTrack(),
    'y': () => store.cycleActiveTrack(),
    'h': () => settings.toggleRegexReplacements(),
    'e': () => exportCurrentCaption(),
    'PageUp': () => skipTime(87),
    'PageDown': () => skipTime(-87),
    'm': () => increasePlaybackRate(),
    'n': () => decreasePlaybackRate(),
    '=': () => settings.adjustFontSize(false, true),
    '-': () => settings.adjustFontSize(false, false),
    '+': () => settings.adjustFontSize(false, true),
    '_': () => settings.adjustFontSize(false, false),
    ']': () => settings.adjustFontSize(true, true),
    '[': () => settings.adjustFontSize(true, false),
    '}': () => settings.adjustFontSize(true, true),
    '{': () => settings.adjustFontSize(true, false),
  })

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    // Subtitle delay adjustments
    if (e.key === 'z' || e.key === 'x') {
      e.preventDefault()
      const isIncrease = e.key === 'x'
      if (e.shiftKey) {
        // Secondary subtitle delay
        store.adjustSubtitleDelay(true, isIncrease)
        videoControls.showNotification(`Secondary subtitle delay: ${store.secondarySubtitleDelay.toFixed(1)}s`)
      } else {
        // Primary subtitle delay
        store.adjustSubtitleDelay(false, isIncrease)
        videoControls.showNotification(`Primary subtitle delay: ${store.primarySubtitleDelay.toFixed(1)}s`)
      }
    }

    // Frame navigation
    if (e.key === ',' || e.key === '.') {
      e.preventDefault()
      if (e.key === ',') {
        previousFrame()
      } else {
        nextFrame()
      }
    }
  })
})

onUnmounted(() => {
  // Save final position
  if (videoRef.value && props.videoUrl) {
    settings.saveVideoPosition(props.videoUrl, videoRef.value.currentTime)
  }

  // Clear interval
  if (savePositionInterval) {
    clearInterval(savePositionInterval)
    savePositionInterval = null
  }

  if (captionsUrl.value) {
    URL.revokeObjectURL(captionsUrl.value)
  }
})

// Watch for video URL changes
watch(() => props.videoUrl, (newUrl) => {
  if (videoRef.value && newUrl) {
    const savedPosition = settings.getVideoPosition(newUrl)
    if (savedPosition > 0) {
      videoRef.value.currentTime = savedPosition
    }
  }
})

// Expose methods to parent
defineExpose({
  cycleAudioTrack,
  adjustPlaybackRate,
  toggleSubtitleInfo
})

// Video control functions
let lastSpaceTime = 0

function togglePlay() {
  const video = videoRef.value
  if (!video) return
  
  const now = Date.now()
  if (now - lastSpaceTime < SPACE_DELAY) {
    return // Ignore if pressed too recently
  }
  lastSpaceTime = now
  
  if (video.paused) {
    video.play()
  } else {
    video.pause()
  }
}

function skipTime(seconds: number) {
  const video = videoRef.value
  if (!video) return
  
  video.currentTime += seconds
}

function increasePlaybackRate() {
  adjustPlaybackRate(true)
}

function decreasePlaybackRate() {
  adjustPlaybackRate(false)
}

function exportCurrentCaption() {
  const activeCaptions = store.activeCaptions.filter(c => 
    c.startTime <= props.currentTime && props.currentTime <= c.endTime
  )
  
  if (activeCaptions.length > 0) {
    const caption = activeCaptions[0]
    navigator.clipboard.writeText(caption.text)
    emit('notify', 'Caption copied to clipboard')
  }
}

// Keyboard shortcuts
const FRAME_DURATION = 1/30 // Assuming 30fps video

// Add frame navigation functions
function nextFrame() {
  if (!videoRef.value) return
  skipTime(FRAME_DURATION)
}

function previousFrame() {
  if (!videoRef.value) return
  skipTime(-FRAME_DURATION)
}

const onPlay = () => {
  emit('playing')
}

const onPause = () => {
  emit('pause')
}

const onSeeking = () => {
  // Handle seeking state
}

const onSeeked = () => {
  // Handle seeked state
}

// Add helper function to detect Japanese text
function isJapaneseText(text: string): boolean {
  const japaneseMatches = text.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/g)
  const japaneseCount = japaneseMatches ? japaneseMatches.length : 0
  const totalChars = text.replace(/\s/g, '').length
  return totalChars > 0 && (japaneseCount / totalChars) >= 0.4
}

const isPlaying = ref(false)
const isMuted = ref(false)
const progress = ref(0)
const progressBar = ref<HTMLElement | null>(null)

function toggleMute() {
  if (!videoRef.value) return
  videoRef.value.muted = !videoRef.value.muted
  isMuted.value = videoRef.value.muted
}

function onProgressClick(event: MouseEvent) {
  if (!videoRef.value || !progressBar.value) return
  const rect = progressBar.value.getBoundingClientRect()
  const pos = (event.clientX - rect.left) / rect.width
  videoRef.value.currentTime = pos * videoRef.value.duration
}

// Add metadata loaded handler
function onMetadataLoaded() {
  if (!videoRef.value) return
  videoDuration.value = videoRef.value.duration
  // Extract title from path
  videoTitle.value = decodeURIComponent(props.videoUrl.split('/').pop() || '')
}

// Format duration helper
function formatDuration(seconds: number): string {
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
    // Create file input if it doesn't exist
    subtitleFileInput.value = document.createElement('input')
    subtitleFileInput.value.type = 'file'
    subtitleFileInput.value.accept = '.srt,.vtt,.ass'
    subtitleFileInput.value.style.display = 'none'
    subtitleFileInput.value.addEventListener('change', handleSubtitleFile)
    document.body.appendChild(subtitleFileInput.value)
  }
  subtitleFileInput.value.click()
}

async function handleSubtitleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    // Read file content
    const content = await file.text()
    
    // Extract language and title from filename
    const filenameParts = file.name.split('.')
    const extension = filenameParts.pop()?.toLowerCase()
    const nameParts = filenameParts.join('.').split('_')
    
    let language = 'unknown'
    let title = file.name
    
    if (nameParts.length >= 3) {
      // Assume format is filename_language_title
      language = nameParts[nameParts.length - 2]
      title = nameParts[nameParts.length - 1]
    } else if (filenameParts.length >= 2) {
      // Try format filename.language.ext
      language = filenameParts[filenameParts.length - 1]
      title = filenameParts[0]
    }
    
    // Load captions
    const trackIndex = await store.loadCaptions(content, language, title)
    
    if (trackIndex !== null) {
      emit('notify', `Added subtitle track: ${file.name}`)
    } else {
      emit('notify', 'Failed to parse subtitle file')
    }
  } catch (e) {
    emit('notify', `Failed to load subtitle: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }

  // Reset input
  input.value = ''
}

// Add function to toggle between primary and secondary subtitles
function togglePrimarySecondary() {
  if (store.subtitleTracks.length <= 1) {
    emit('notify', 'No secondary subtitles available')
    return
  }
  store.cycleActiveTrack()
  emit('notify', `Active subtitle: ${store.activeTrack?.metadata?.title || 'Unknown'}`)
}
</script>

<template>
  <div 
    class="video-container" 
    :class="{ 
      'center': settings.videoAlignment === 'center',
      'left': settings.videoAlignment === 'left',
      'right': settings.videoAlignment === 'right',
      'has-subtitles': store.allActiveCaptions.length > 0,
      'controls-hidden': settings.hidePlayerControls && !isHovering
    }"
  >
    <video
      ref="videoRef"
      :src="streamingUrl"
      :controls="false"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onMetadataLoaded"
      @play="onPlay"
      @pause="onPause"
      @seeking="onSeeking"
      @seeked="onSeeked"
      @mouseover="isHovering = true"
      @mouseleave="isHovering = false"
      class="video-element"
    >
      Your browser does not support the video tag.
    </video>

    <!-- Custom controls - always show -->
    <div class="custom-controls">
      <div class="flex items-center gap-2">
        <button class="control-button" @click="togglePlay">
          <span v-if="!videoRef?.paused">⏸</span>
          <span v-else>▶</span>
        </button>
        
        <div class="time-display text-white text-sm">
          {{ formatDuration(currentTime) }} / {{ formatDuration(videoDuration) }}
        </div>
        
        <div class="flex-1">
          <div class="progress-bar" ref="progressBar" @click="onProgressClick">
            <div class="progress-fill" :style="{ width: `${(currentTime / videoDuration) * 100}%` }"></div>
            <div class="progress-hover"></div>
          </div>
        </div>

        <button class="control-button" @click="toggleMute">
          <span v-if="isMuted">🔇</span>
          <span v-else>🔊</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Update video container styles */
.video-container {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: black;
  overflow: hidden;
}

/* Update subtitle container to not interfere with video */
.subtitles-container {
  position: fixed;
  bottom: 10vh;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  user-select: none;
  z-index: 30;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  outline: none;
  tabindex: -1;
}

/* Remove duplicate video-info class */
.video-info {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

/* Ensure video element takes full space */
.video-element {
  width: 100%;
  height: 100%;
  object-fit: contain;
  outline: none;
}

/* Update media query for mobile */
@media (max-width: 768px) {
  .video-container {
    height: calc(100vh - 120px); /* Adjust for smaller screens */
  }
  
  .subtitles-container {
    bottom: 5vh;
  }
}

.video-container.controls-hidden video::-webkit-media-controls {
  display: none !important;
}

.video-container.controls-hidden video::-webkit-media-controls-enclosure {
  display: none !important;
}

.video-container.controls-hidden video::-webkit-media-controls-panel {
  display: none !important;
}

.subtitles-container {
  position: fixed;
  bottom: 10vh;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  user-select: none;
  z-index: 30;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  outline: none;
  tabindex: -1;
}

.subtitle-stack {
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
}

.subtitle-track {
  width: 100%;
  margin: 0;
  padding: 0;
  position: relative;
}

.hidden-track {
  display: none;
}

.active-track .subtitle-line {
  color: white;
}

.subtitle-line {
  position: relative;
  display: block;
  padding: 0;
  margin: 0 auto;
  max-width: 80%;
  text-align: center;
  color: white;
  line-height: 1.2;
  word-wrap: break-word;
  word-break: normal;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  outline: none;
}

.primary-track {
  font-size: v-bind('`${settings.primarySubtitleFontSize}em`');
  font-family: v-bind('settings.subtitleFontFamily');
  font-weight: v-bind('settings.subtitleFontWeight');
  margin-bottom: 0.5em;
  --subtitle-shadow: v-bind('settings.primarySubtitleShadow');
  text-shadow: var(--subtitle-shadow);
}

.secondary-track {
  font-size: v-bind('`${settings.secondarySubtitleFontSize}em`');
  font-family: v-bind('settings.secondarySubtitleFontFamily');
  font-weight: v-bind('settings.secondarySubtitleFontWeight');
  opacity: 0.9;
  --subtitle-shadow: v-bind('settings.secondarySubtitleShadow');
  text-shadow: var(--subtitle-shadow);
}

/* Lane positioning */
.lane-0 { transform: translateY(0); }
.lane-1 { transform: translateY(-100%); }
.lane-2 { transform: translateY(-200%); }
.lane-3 { transform: translateY(-300%); }
.lane-4 { transform: translateY(-400%); }
.lane-5 { transform: translateY(-500%); }

.secondary-track.lane-0 { transform: translateY(0); }
.secondary-track.lane-1 { transform: translateY(-100%); }
.secondary-track.lane-2 { transform: translateY(-200%); }
.secondary-track.lane-3 { transform: translateY(-300%); }
.secondary-track.lane-4 { transform: translateY(-400%); }
.secondary-track.lane-5 { transform: translateY(-500%); }

/* Video alignment classes */
.video-container.left {
  justify-content: flex-start;
}

.video-container.center {
  justify-content: center;
}

.video-container.right {
  justify-content: flex-end;
}

.has-subtitles .video-element {
  margin-bottom: 20vh;
}

.furigana-container {
  line-height: 1.5;
  margin: 0;
  padding: 0;
}

.furigana-container ruby {
  ruby-align: center;
  display: inline;
  position: relative;
  margin: 0;
  padding: 0;
}
.video-container > div > div > div:nth-child(1) > div > span {
  /* styles will be inherited from .primary-track */
}
.video-container > div > div > div:nth-child(2) > div > span {
  /* styles will be inherited from .secondary-track */
}
.furigana-container rt {
  font-size: 0.5em;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
  text-align: center;
  white-space: nowrap;
}

.tokens-container {
  display: inline;
  white-space: normal;
  word-wrap: break-word;
  word-break: normal;
}

/* ASS positioning classes */
.top-left { text-align: left; transform: translateY(-200%); }
.top { text-align: center; transform: translateY(-200%); }
.top-right { text-align: right; transform: translateY(-200%); }
.middle-left { text-align: left; }
.middle { text-align: center; }
.middle-right { text-align: right; }
.bottom-left { text-align: left; transform: translateY(200%); }
.bottom { text-align: center; transform: translateY(200%); }
.bottom-right { text-align: right; transform: translateY(200%); }

/* Support for ASS SVG drawings */
.subtitle-line :deep(svg) {
  width: 100%;
  height: auto;
  max-height: 50vh;
}

/* Custom controls container */
.custom-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1rem;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  opacity: 1;
  pointer-events: auto;
}

/* Remove hover effect since controls are always visible */
.video-container:hover .custom-controls {
  opacity: 1;
}

/* Control buttons */
.control-button {
  background: transparent;
  border: none;
  color: white;
  padding: 0.5rem;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.control-button:hover {
  opacity: 1;
}

/* Progress bar */
.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(255,255,255,0.2);
  margin-top: 0.5rem;
  cursor: pointer;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  width: 0%;
  transition: width 0.1s linear;
}

.progress-hover {
  position: absolute;
  top: -8px;
  bottom: -8px;
  left: 0;
  right: 0;
}

/* Add time display styles */
.time-display {
  min-width: 120px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style> 