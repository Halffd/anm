<script setup lang="ts">
import { ref, watch, computed, onUnmounted, onMounted } from 'vue'
import type { Caption } from '~/types'
import { useCaptionsStore } from '~/stores/captions'
import { useSettingsStore } from '~/stores/settings'
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'
import { useVideoControls } from '~/composables/useVideoControls'
import { useAnkiExtension } from '~/composables/useAnkiExtension'

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
}>()

const videoRef = ref<HTMLVideoElement>()
const store = useCaptionsStore()
const settings = useSettingsStore()
const videoControls = useVideoControls()
const ankiExtension = useAnkiExtension()

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

// Add a computed property for the video source
const videoSource = computed(() => {
  if (!props.videoUrl) return '';
  // Use the streaming URL for server-side videos, or direct URL for blob URLs
  if (props.videoUrl.startsWith('blob:') || props.videoUrl.startsWith('http')) {
    return props.videoUrl;
  }
  return streamingUrl.value;
})

// Add computed property for video alignment style
const videoAlignmentStyle = computed(() => {
  switch (props.videoAlignment || settings.videoAlignment) {
    case 'left': return 'left center';
    case 'right': return 'right center';
    default: return 'center center';
  }
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

function onMetadataLoaded(e: Event) {
  const video = e.target as HTMLVideoElementWithAudioTracks
  
  // Set video duration and title
  if (video) {
    videoDuration.value = video.duration
    // Extract title from path
    videoTitle.value = decodeURIComponent(props.videoUrl?.split('/').pop() || '')
  }
  
  // Process audio tracks
  if (!video.audioTracks || video.audioTracks.length === 0) {
    audioTracks.value = []
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

// Add word status tracking
const WORD_STATUS = {
  NEW: 'new',
  KNOWN: 'known',
  MATURE: 'mature'
}

// Add word status colors
const WORD_STATUS_COLORS = {
  [WORD_STATUS.NEW]: 'text-blue-400',
  [WORD_STATUS.KNOWN]: 'text-green-400',
  [WORD_STATUS.MATURE]: 'text-purple-400'
}

// Add word status tracking
const wordStatuses = ref<Record<string, string>>({})

// Add function to determine word status
function getWordStatus(token: any): string {
  if (!token) return WORD_STATUS.NEW
  
  // Check if token has word_type property (from Anki)
  if (token.token?.word_type) {
    switch (token.token.word_type) {
      case 'NEW': return WORD_STATUS.NEW
      case 'KNOWN': return WORD_STATUS.KNOWN
      case 'MATURE': return WORD_STATUS.MATURE
      default: return WORD_STATUS.NEW
    }
  }
  
  // Fallback to dictionary lookup in wordStatuses
  return wordStatuses.value[token.surface_form] || WORD_STATUS.NEW
}

// Add function to determine if text is non-English
function isNonEnglishText(text: string): boolean {
  // Check for non-Latin characters (covers Japanese, Chinese, Korean, etc.)
  const nonLatinRegex = /[^\u0000-\u007F\u0080-\u00FF\u0100-\u017F\u0180-\u024F]/;
  return nonLatinRegex.test(text);
}

// Update getWordStatusClass function
function getWordStatusClass(token: any): string {
  // Only apply word status highlighting for Japanese text
  if (!token || !token.surface_form) {
    return '';
  }
  
  // Use the existing Japanese detection logic
  const japaneseMatches = token.surface_form.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/g)
  const japaneseCount = japaneseMatches ? japaneseMatches.length : 0
  const totalChars = token.surface_form.replace(/\s/g, '').length
  const isJapanese = totalChars > 0 && (japaneseCount / totalChars) >= 0.4
  
  if (!isJapanese) {
    return '';
  }
  
  const status = getWordStatus(token);
  return `word-${status}`;
}

// Add function to handle word click for Anki integration
function handleWordClick(token: any) {
  if (!ankiExtension.isExtensionAvailable.value) return
  
  try {
    ankiExtension.sendToExtension({
      action: 'token',
      token: token.surface_form
    })
    
    // Update local status (optimistic update)
    wordStatuses.value[token.surface_form] = WORD_STATUS.KNOWN
    
    // Show notification
    emit('notify', `Added "${token.surface_form}" to Anki`)
  } catch (error) {
    console.error('Failed to send word to Anki:', error)
    emit('notify', `Failed to add word to Anki: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Add function to record current subtitle in Anki
function recordCurrentSubtitle() {
  if (!ankiExtension.isExtensionAvailable.value) return
  
  const activeCaptions = store.activeCaptions.filter(c => 
    c.startTime <= props.currentTime && props.currentTime <= c.endTime
  )
  
  if (activeCaptions.length > 0) {
    const caption = activeCaptions[0]
    try {
      ankiExtension.recordFlashcard(caption, props.currentTime, selectedAudioTrack.value)
      emit('notify', 'Recorded subtitle in Anki')
    } catch (error) {
      console.error('Failed to record subtitle in Anki:', error)
      emit('notify', `Failed to record in Anki: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  } else {
    emit('notify', 'No active subtitle to record')
  }
}

// Update processTokens function to include word status class
function processTokens(tokens: any[]): any[] {
  if (!tokens || !Array.isArray(tokens)) return []
  
  return tokens.map(token => {
    // Ensure token has all required properties
    const processedToken = {
      surface_form: token.surface_form || token[0] || '',
      reading: token.reading || token[1] || '',
      pos: token.pos || '',
      status: getWordStatus(token),
      statusClass: getWordStatusClass(token)
    }
    
    return processedToken
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
    ' ': (event) => {
      // Prevent default space behavior (scrolling)
      event.preventDefault();
      togglePlayPause();
      
      // Add debounce to prevent multiple toggles
      const now = Date.now();
      if (now - lastSpacePress < SPACE_DELAY) {
        return;
      }
      lastSpacePress = now;
    },
    'ArrowLeft': () => skipTime(-3),
    'ArrowRight': () => skipTime(3),
    'ArrowUp': () => adjustVolume(0.1),
    'ArrowDown': () => adjustVolume(-0.1),
    'm': () => toggleVideoMute(),
    'f': () => toggleFullscreen(),
    'n': () => toggleAnkiMode(),
    'a': () => store.previousCaption(),
    'd': () => store.nextCaption(),
    's': () => store.seekToSubtitleStart(),
    'l': () => openSubtitleFileDialog(),
    'j': () => togglePrimarySecondary(),
    'p': () => store.isAutoPauseMode = false,
    'c': () => store.toggleSecondarySubtitles(),
    'v': () => store.toggleSubtitles(),
    'V': () => store.toggleSubtitles(),
    'i': () => toggleSubtitleInfo(),
    'x': () => store.toggleSidebar(),
    't': () => cycleAudioTrack(),
    'y': () => store.cycleActiveTrack(),
    'h': () => settings.toggleRegexReplacements(),
    'e': () => exportCurrentCaption(),
    'PageUp': () => skipTime(87),
    'PageDown': () => skipTime(-87),
    '=': () => settings.adjustFontSize(false, true),
    '-': () => settings.adjustFontSize(false, false),
    '+': () => settings.adjustFontSize(false, true),
    '_': () => settings.adjustFontSize(false, false),
    ']': () => settings.adjustFontSize(true, true),
    '[': () => settings.adjustFontSize(true, false),
    '}': () => settings.adjustFontSize(true, true),
    '{': () => settings.adjustFontSize(true, false),
    'r': () => recordCurrentSubtitle(),
  })

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    // Number keys for percentage seeking
    if (e.key >= '0' && e.key <= '9' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault()
      const percent = e.key === '0' ? 0 : parseInt(e.key) * 10
      seekToPercentage(percent)
    }
    
    // Home/End keys for start/end seeking
    if (e.key === 'Home') {
      e.preventDefault()
      seekToStart()
    }
    
    if (e.key === 'End') {
      e.preventDefault()
      seekToEnd()
    }
    
    // Font size adjustment shortcuts
    if ((e.key === '=' || e.key === '+') && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      settings.adjustFontSize(false, true)
      emit('notify', `Primary font size: ${settings.primarySubtitleFontSize.toFixed(1)}`)
    }
    
    if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      settings.adjustFontSize(false, false)
      emit('notify', `Primary font size: ${settings.primarySubtitleFontSize.toFixed(1)}`)
    }
    
    if (e.key === ']' || e.key === '}') {
      e.preventDefault()
      settings.adjustFontSize(true, true)
      emit('notify', `Secondary font size: ${settings.secondarySubtitleFontSize.toFixed(1)}`)
    }
    
    if (e.key === '[' || e.key === '{') {
      e.preventDefault()
      settings.adjustFontSize(true, false)
      emit('notify', `Secondary font size: ${settings.secondarySubtitleFontSize.toFixed(1)}`)
    }
    
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

  // Add fullscreen change event listener
  document.addEventListener('fullscreenchange', onFullscreenChange)

  // Set up a watcher to process tokens when captions change
  watch(() => store.activeCaptions, () => {
    processTokensForDisplay();
  }, { immediate: true, deep: true });
  
  // Also process tokens when furigana data changes
  watch(() => store.activeCaptions.map(c => c.furigana), () => {
    processTokensForDisplay();
  }, { immediate: true, deep: true });
  
  // Set up keyboard shortcuts
  const cleanupKeyboardShortcuts = setupKeyboardShortcuts();
  
  // Clean up on unmount
  onUnmounted(() => {
    cleanupKeyboardShortcuts();
    window.removeEventListener('keydown', handleKeyDown);
  });
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

  // Remove fullscreen change event listener
  document.removeEventListener('fullscreenchange', onFullscreenChange)
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
let lastSpacePress = 0

function togglePlayPause(event?: MouseEvent) {
  // Don't toggle if clicking on controls or subtitle elements
  if (event && (
    event.target instanceof HTMLButtonElement || 
    event.target instanceof HTMLInputElement ||
    (event.target as HTMLElement).closest('.custom-controls') ||
    (event.target as HTMLElement).closest('.subtitles-container')
  )) {
    return;
  }
  
  const video = videoRef.value;
  if (!video) return;
  
  if (video.paused) {
    video.play().catch(err => {
      console.error('Failed to play video:', err);
      emit('error', new Error('Failed to play video'));
    });
  } else {
    video.pause();
  }
}

function skipTime(seconds: number) {
  const video = videoRef.value
  if (!video) return
  
  const newTime = video.currentTime + seconds;
  video.currentTime = Math.max(0, Math.min(newTime, video.duration));
  emit('timeupdate', video.currentTime);
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

const isPlaying = ref(false)
const isMuted = ref(false)
const progress = ref(0)
const progressBar = ref<HTMLElement | null>(null)

function toggleVideoMute() {
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

// Add function to clean and process HTML in subtitles
function processSubtitleHtml(html: string): string {
  if (!html) return '';
  
  // Remove ASS tags but preserve line breaks
  let cleaned = html.replace(/\\N/g, '<br>');
  
  // Keep font tags but remove other potentially unsafe tags
  cleaned = cleaned
    .replace(/<(?!\/?(font|b|i|u)[> ])[^>]+>/gi, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
    
  return cleaned;
}

// Add function to strip HTML for tokenization
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

// Add function to toggle Anki mode
function toggleAnkiMode() {
  settings.ankiEnabled = !settings.ankiEnabled;
  emit('notify', settings.ankiEnabled ? 'Anki mode enabled' : 'Anki mode disabled');
}

// Add volume control functions
function adjustVolume(amount: number) {
  const video = videoRef.value
  if (!video) return
  
  // Clamp volume between 0 and 1
  video.volume = Math.max(0, Math.min(1, video.volume + amount))
  emit('notify', `Volume: ${Math.round(video.volume * 100)}%`)
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      emit('error', new Error(`Error attempting to enable fullscreen: ${err.message}`))
    })
  } else {
    document.exitFullscreen()
  }
}

// Add new state variables
const volume = ref(1)
const previewTime = ref<number | null>(null)
const previewPosition = ref(0)
const isFullscreen = ref(false)

// Add new functions for seeking
function seekToPercentage(percent: number) {
  const video = videoRef.value
  if (!video) return
  
  const targetTime = (percent / 100) * video.duration
  video.currentTime = targetTime
  emit('notify', `Seeking to ${percent}%`)
}

function seekToStart() {
  const video = videoRef.value
  if (!video) return
  
  video.currentTime = 0
  emit('notify', 'Seeking to start')
}

function seekToEnd() {
  const video = videoRef.value
  if (!video) return
  
  video.currentTime = video.duration
  emit('notify', 'Seeking to end')
}

// Add function for volume slider
function onVolumeChange(event: Event) {
  const video = videoRef.value
  if (!video) return
  
  volume.value = parseFloat((event.target as HTMLInputElement).value)
  video.volume = volume.value
  video.muted = volume.value === 0
  isMuted.value = video.muted
}

// Add function for progress bar hover
function onProgressHover(event: MouseEvent) {
  const progressBar = event.currentTarget as HTMLElement
  const rect = progressBar.getBoundingClientRect()
  const position = (event.clientX - rect.left) / rect.width
  
  previewPosition.value = position * 100
  previewTime.value = position * videoDuration.value || null
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

// Add function to check if store exists and has the showFurigana property
function getShowFurigana() {
  // Access the property correctly from the settings store
  return settings?.showFurigana ?? true;
}

// Add a function to properly handle Japanese text tokenization
function processJapaneseText(text: string): Token[] {
  // This is a simple implementation - you might want to use a proper tokenizer
  // like kuromoji.js or TinySegmenter for better results
  
  // Remove any HTML tags that might be in the text
  const cleanText = text.replace(/<[^>]*>/g, '');
  
  // Use the browser's Intl.Segmenter if available for proper word segmentation
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
      const segments = segmenter.segment(cleanText);
      
      // Convert segments to tokens
      return Array.from(segments)
        .filter(segment => segment.segment.trim() !== '') // Filter out empty segments
        .map(segment => ({
          surface_form: segment.segment,
          surface: segment.segment,
          reading: '', // You would need a dictionary for readings
          pos: 'UNKNOWN',
          basic_form: segment.segment,
          isHighlighted: false,
          status: 'new' // Default status for new tokens
        }));
    } catch (e) {
      console.error('Error using Intl.Segmenter:', e);
    }
  }
  
  // Fallback to simple word-based tokenization
  // This regex tries to match Japanese words by common patterns
  const words = cleanText.match(/[一-龯ぁ-ゔァ-ヴー々〆〤]+|[a-zA-Z0-9]+|[.,!?;:'"()[\]{}]/g) || [];
  
  return words.map((word: string) => ({
    surface_form: word,
    surface: word,
    reading: '', // You would need a dictionary for readings
    pos: 'UNKNOWN',
    basic_form: word,
    isHighlighted: false,
    status: 'new' // Default status for new tokens
  }));
}

// Add a function to directly access the furigana data from the store
function getFuriganaForCaption(caption: Caption): Record<string, string> {
  // Check if the caption has furigana data
  if (caption.furigana && Array.isArray(caption.furigana)) {
    // Convert the furigana array to a map of surface_form -> reading
    const furiganaMap: Record<string, string> = {};
    caption.furigana.forEach(([surface, reading]) => {
      if (surface && reading) {
        furiganaMap[surface] = reading;
      }
    });
    return furiganaMap;
  }
  return {};
}

// Function to process tokens for display
function processTokensForDisplay() {
  // Get all active captions
  const activeCaptions = store.activeCaptions || [];
  
  // Process each caption
  activeCaptions.forEach(caption => {
    if (!caption.tokens || caption.tokens.length === 0 || 
        (caption.tokens.length > 0 && caption.tokens.every(t => t.surface_form.length === 1))) {
      // If no tokens or all tokens are single characters, apply our tokenization
      const processedTokens = processJapaneseText(caption.text);
      
      // Get furigana data for this caption
      const furiganaMap = getFuriganaForCaption(caption);
      
      // Apply furigana readings to tokens
      processedTokens.forEach(token => {
        if (furiganaMap[token.surface_form]) {
          token.reading = furiganaMap[token.surface_form];
        }
        
        // Also check if we have furigana for parts of this token
        Object.entries(furiganaMap).forEach(([surface, reading]) => {
          if (token.surface_form.includes(surface) && surface.length > 1) {
            // If this token contains a surface with furigana, apply it
            token.reading = reading;
          }
        });
      });
      
      // Instead of modifying the caption directly, we'll use a Map to store processed tokens
      processedTokensMap.set(caption.id, processedTokens);
      
      // Log for debugging
      console.log(`[Tokenizer] Processed ${processedTokens.length} tokens for caption: "${caption.text}"`);
      console.log(`[Tokenizer] Furigana data:`, furiganaMap);
    }
  });
}

// Create a Map to store processed tokens by caption ID
const processedTokensMap = new Map<string, Token[]>();

// Function to get processed tokens for a caption
function getProcessedTokens(caption: Caption): Token[] {
  const processedTokens = processedTokensMap.get(caption.id);
  if (processedTokens) return processedTokens;
  
  // If we don't have processed tokens, convert the existing tokens to our Token format
  if (caption.tokens && caption.tokens.length > 0) {
    return caption.tokens.map(t => ({
      surface_form: t.surface_form,
      surface: t.surface_form, // Use surface_form as surface
      reading: t.reading || '',
      pos: t.pos || 'UNKNOWN',
      basic_form: t.basic_form || t.surface_form,
      isHighlighted: false,
      status: t.status
    }));
  }
  
  // If no tokens at all, return empty array
  return [];
}

// Add a function to handle token clicks
function handleTokenClick(token: any) {
  console.log('Token clicked:', token);
  // Add your token click handling logic here
}

// Add keyboard shortcuts for subtitle font size adjustment
function setupKeyboardShortcuts() {
  const shortcuts: Record<string, () => void> = {
    // Existing shortcuts...
    
    // Add shortcuts for primary subtitle font size
    '=': () => {
      increasePrimarySubtitleFontSize();
    },
    '+': () => {
      increasePrimarySubtitleFontSize();
    },
    '-': () => {
      decreasePrimarySubtitleFontSize();
    },
    '_': () => {
      decreasePrimarySubtitleFontSize();
    },
    
    // Add shortcuts for secondary subtitle font size
    ']': () => {
      increaseSecondarySubtitleFontSize();
    },
    '}': () => {
      increaseSecondarySubtitleFontSize();
    },
    '[': () => {
      decreaseSecondarySubtitleFontSize();
    },
    '{': () => {
      decreaseSecondarySubtitleFontSize();
    },
  };
  
  // Register keyboard event listeners
  const handleKeyDown = (e: KeyboardEvent) => {
    // Prevent handling if user is typing in an input field
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    const key = e.key;
    if (key in shortcuts) {
      e.preventDefault();
      shortcuts[key]();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}

// Functions to adjust primary subtitle font size
function increasePrimarySubtitleFontSize() {
  if (settings.primarySubtitleFontSize < 3.0) {
    settings.primarySubtitleFontSize += 0.1;
    if (typeof settings.saveSettings === 'function') {
      settings.saveSettings();
    }
    emit('notify', `Primary subtitle size: ${settings.primarySubtitleFontSize.toFixed(1)}`);
  }
}

function decreasePrimarySubtitleFontSize() {
  if (settings.primarySubtitleFontSize > 0.5) {
    settings.primarySubtitleFontSize -= 0.1;
    if (typeof settings.saveSettings === 'function') {
      settings.saveSettings();
    }
    emit('notify', `Primary subtitle size: ${settings.primarySubtitleFontSize.toFixed(1)}`);
  }
}

// Functions to adjust secondary subtitle font size
function increaseSecondarySubtitleFontSize() {
  if (settings.secondarySubtitleFontSize < 3.0) {
    settings.secondarySubtitleFontSize += 0.1;
    if (typeof settings.saveSettings === 'function') {
      settings.saveSettings();
    }
    emit('notify', `Secondary subtitle size: ${settings.secondarySubtitleFontSize.toFixed(1)}`);
  }
}

function decreaseSecondarySubtitleFontSize() {
  if (settings.secondarySubtitleFontSize > 0.5) {
    settings.secondarySubtitleFontSize -= 0.1;
    if (typeof settings.saveSettings === 'function') {
      settings.saveSettings();
    }
    emit('notify', `Secondary subtitle size: ${settings.secondarySubtitleFontSize.toFixed(1)}`);
  }
}

// Add event listeners for keyboard shortcuts directly
const handleKeyDown = (e: KeyboardEvent) => {
  // Prevent handling if user is typing in an input field
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
  }
  
  switch (e.key) {
    case '=':
    case '+':
      e.preventDefault();
      increasePrimarySubtitleFontSize();
      break;
    case '-':
    case '_':
      e.preventDefault();
      decreasePrimarySubtitleFontSize();
      break;
    case ']':
    case '}':
      e.preventDefault();
      increaseSecondarySubtitleFontSize();
      break;
    case '[':
    case '{':
      e.preventDefault();
      decreaseSecondarySubtitleFontSize();
      break;
  }
};

window.addEventListener('keydown', handleKeyDown);

// Clean up on unmount
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

// Helper function to check if a string contains Japanese characters
function isJapaneseCharacter(text: string): boolean {
  // Check if the text contains Japanese characters
  return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(text);
}

// Add function to determine subtitle language
function getSubtitleLanguage(): string {
  // Get the active subtitle track
  const activeTrack = store.activeTrack;
  
  // Return the language code if available, otherwise default to Japanese
  if (activeTrack && 'language' in activeTrack) {
    return (activeTrack as any).language || 'ja';
  }
  
  // Default to Japanese if no language is specified
  return 'ja';
}
</script>

<template>
  <div 
    class="video-container" 
    :class="[props.videoAlignment || 'center', { 'has-subtitles': hasSubtitles, 'fullscreen': isFullscreen }]"
    @click="togglePlayPause"
  >
    <video
      ref="videoRef"
      :src="videoSource"
      :controls="false"
      @timeupdate="onTimeUpdate"
      @error="onError"
      @loadedmetadata="onMetadataLoaded"
      @play="onPlay"
      @pause="onPause"
      @ended="emit('ended')"
      @mousemove="isHovering = true"
      @mouseleave="isHovering = false"
      class="video-element"
      crossorigin="anonymous"
      preload="auto"
      playsinline
      :style="{ objectPosition: videoAlignment }"
    >
      Your browser does not support the video tag.
    </video>

    <!-- Subtitles container -->
    <div v-if="store.showSubtitles" class="subtitles-container" :class="{ 'no-controls': !settings.showVideoControls }" :lang="getSubtitleLanguage()" data-yomitan-enable="true">
      <!-- Primary subtitles -->
      <div v-for="caption in store.activeCaptions" :key="caption.id" class="subtitle-wrapper">
        <div class="subtitle-line">
          <!-- If caption has HTML formatting, use v-html -->
          <span v-if="caption.text.includes('<')" v-html="caption.text"></span>
          <!-- Otherwise use tokenized display with furigana -->
          <span v-else class="japanese-text">
            <template v-for="(token, index) in getProcessedTokens(caption)" :key="index">
              <span 
                :class="{ 
                  'word': true, 
                  'known': token.status === 'known', 
                  'new': token.status === 'new' || !token.status 
                }"
                @click.stop="handleTokenClick(token)"
              >{{ token.surface_form }}</span>
            </template>
          </span>
        </div>
      </div>
      
      <!-- Secondary subtitles if enabled -->
      <div v-if="store.showSecondarySubtitles && hasSecondarySubtitles" class="secondary-subtitles">
        <div v-for="(track, trackIndex) in store.subtitleTracks" :key="track.id">
          <template v-if="trackIndex !== store.activeTrackIndex">
            <div v-for="caption in track.captions" :key="caption.id" class="subtitle-wrapper">
              <div 
                v-if="caption.startTime <= props.currentTime && props.currentTime <= caption.endTime"
                class="subtitle-line secondary"
              >
                <!-- If caption has HTML formatting, use v-html -->
                <span v-if="caption.text.includes('<')" v-html="processSubtitleHtml(caption.text)"></span>
                <!-- Otherwise use plain text -->
                <span v-else>{{ caption.text }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Improved custom controls -->
    <div class="custom-controls" :class="{ 'visible': isHovering || !videoRef?.paused }">
      <!-- Progress bar with preview -->
      <div class="progress-container">
        <div class="progress-bar" ref="progressBar" @click="onProgressClick" @mousemove="onProgressHover">
          <div class="progress-fill" :style="{ width: `${(currentTime / videoDuration) * 100}%` }"></div>
          <div class="progress-handle" :style="{ left: `${(currentTime / videoDuration) * 100}%` }"></div>
          <div v-if="previewTime" class="time-preview" :style="{ left: `${previewPosition}%` }">
            {{ formatDuration(previewTime) }}
          </div>
        </div>
      </div>
      
      <!-- Control buttons -->
      <div class="controls-row">
        <div class="left-controls">
          <button class="control-button play-pause" @click.stop="togglePlayPause">
            <svg v-if="videoRef?.paused" viewBox="0 0 24 24" class="play-icon">
              <path d="M8 5v14l11-7z" />
            </svg>
            <svg v-else viewBox="0 0 24 24" class="pause-icon">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>
          
          <div class="volume-control">
            <button class="control-button" @click.stop="toggleVideoMute">
              <svg viewBox="0 0 24 24" class="volume-icon">
                <path v-if="isMuted" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                <path v-else-if="volume < 0.5" d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                <path v-else d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            </button>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              :value="volume" 
              @input="onVolumeChange" 
              @click.stop 
              class="volume-slider"
            />
          </div>
          
          <div class="time-display">
            {{ formatDuration(currentTime) }} / {{ formatDuration(videoDuration) }}
          </div>
        </div>
        
        <div class="right-controls">
          <!-- Add Anki button if extension is available -->
          <button 
            v-if="ankiExtension.isExtensionAvailable" 
            class="control-button" 
            @click.stop="recordCurrentSubtitle"
            title="Record current subtitle in Anki (R)"
          >
            <span class="anki-icon">A</span>
          </button>
          
          <button class="control-button" @click.stop="toggleFullscreen" title="Fullscreen (f)">
            <svg viewBox="0 0 24 24" class="fullscreen-icon">
              <path v-if="isFullscreen" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              <path v-else d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          </button>
        </div>
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
  font-size: v-bind('`${settings.primarySubtitleFontSize}rem`');
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
  display: inline-block;
  line-height: 1.5;
}

ruby {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
  text-align: center;
  margin: 0 1px;
  position: relative;
}

rt {
  font-size: 0.6em;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1;
  text-align: center;
  white-space: nowrap;
  position: absolute;
  top: -1em;
  left: 0;
  right: 0;
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

/* Improved control styles */
.custom-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  padding: 10px;
  transition: opacity 0.3s ease;
  opacity: 1;
  z-index: 100;
}

.custom-controls.visible {
  opacity: 1;
}

.progress-container {
  width: 100%;
  padding: 10px 0;
}

.progress-bar {
  position: relative;
  height: 5px;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 2.5px;
  cursor: pointer;
  transition: height 0.2s ease;
}

.progress-bar:hover {
  height: 8px;
}

.progress-fill {
  height: 100%;
  background-color: #3b82f6;
  border-radius: 2.5px;
  transition: width 0.1s linear;
}

.progress-handle {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background-color: #3b82f6;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.progress-bar:hover .progress-handle {
  opacity: 1;
}

.time-preview {
  position: absolute;
  bottom: 15px;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 5px;
}

.left-controls, .right-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.control-button {
  background: transparent;
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.control-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.control-button svg {
  width: 24px;
  height: 24px;
  fill: white;
}

.play-pause {
  width: 40px;
  height: 40px;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 5px;
}

.volume-slider {
  width: 60px;
  height: 5px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2.5px;
  outline: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  cursor: pointer;
  border: none;
}

.time-display {
  color: white;
  font-size: 14px;
  min-width: 100px;
  font-variant-numeric: tabular-nums;
}

.anki-icon {
  font-weight: bold;
  font-size: 16px;
}

/* Add styles for Japanese text to ensure it's selectable */
.japanese-text {
  user-select: text !important;
  cursor: text;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

/* Make sure ruby elements are properly styled for Yomitan */
ruby {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
  text-align: center;
  margin: 0 1px;
  position: relative;
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

rt {
  font-size: 0.6em;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1;
  text-align: center;
  white-space: nowrap;
  position: absolute;
  top: -1em;
  left: 0;
  right: 0;
  user-select: none;
  pointer-events: none;
}

/* Add styles for word tokens */
.word {
  display: inline-block;
  margin: 0 1px;
  padding: 0 1px;
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

.word:hover {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

/* Ensure subtitle font size changes are applied */
.secondary-subtitle-line {
  font-size: v-bind('`${settings.secondarySubtitleFontSize}rem`');
}

/* Update the custom controls container to show/hide based on hover */
.custom-controls-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  transition: opacity 0.3s ease;
  opacity: 1;
}

/* Show controls when hovering over the video container */
.video-container:hover .custom-controls-container {
  opacity: 1;
}

/* Hide controls after a delay when not hovering */
.video-container:not(:hover) .custom-controls-container {
  opacity: 0;
}

/* Add a delay before hiding controls */
.video-container .custom-controls-container {
  transition-delay: 0.5s;
}

.video-container:hover .custom-controls-container {
  transition-delay: 0s;
}
</style> 