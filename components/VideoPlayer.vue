<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import type { Caption } from '~/types'
import { useCaptionsStore } from '~/stores/captions'
import { useSettingsStore } from '~/stores/settings'

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
}>()

const videoRef = ref<HTMLVideoElement>()
const store = useCaptionsStore()
const settings = useSettingsStore()

interface AudioTrack {
  enabled: boolean
  language?: string
  label?: string
}

const audioTracks = ref<AudioTrack[]>([])
const selectedAudioTrack = ref<number>(0)
const playbackRate = ref(1)

const hasSubtitles = computed(() => store.showSubtitles && store.activeCaptions.length > 0)

// Add computed property for captions URL
const captionsUrl = computed(() => {
  if (!props.captions?.length) return ''
  
  // Create blob URL for captions
  const vttContent = generateWebVTT(props.captions)
  const blob = new Blob([vttContent], { type: 'text/vtt' })
  return URL.createObjectURL(blob)
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

  // Handle auto-pause
  if (store.isAutoPauseMode && store.activeCaptions.length > 0) {
    const caption = store.activeCaptions[0]
    if (video.currentTime > caption.endTime && !video.paused) {
      video.pause()
      store.lastPauseTime = video.currentTime
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

// Apply regex replacements when showing subtitles
function processText(text: string): string {
  if (!settings.regexReplacementsEnabled || !settings.regexReplacements.length) {
    return text
  }
  
  return settings.regexReplacements.reduce((processed, { regex, replaceText }) => {
    try {
      return processed.replace(new RegExp(regex, 'g'), replaceText)
    } catch (e) {
      return processed
    }
  }, text)
}

// Clean up blob URLs when component is unmounted
onUnmounted(() => {
  if (captionsUrl.value) {
    URL.revokeObjectURL(captionsUrl.value)
  }
})

// Expose methods to parent
defineExpose({
  cycleAudioTrack,
  adjustPlaybackRate
})
</script>

<template>
  <div 
    class="video-container"
    :class="[
      videoAlignment || settings.videoAlignment,
      { 'has-subtitles': hasSubtitles }
    ]"
  >
    <video
      ref="videoRef"
      class="video-element"
      :src="videoUrl"
      :playbackRate="playbackRate"
      @timeupdate="onTimeUpdate"
      @error="onError"
      @loadeddata="onLoad"
      controls
      disablePictureInPicture
    >
      <track
        v-if="captions"
        kind="subtitles"
        :src="captionsUrl"
        default
      />
    </video>

    <!-- Audio track indicator -->
    <div 
      v-if="audioTracks.length > 1"
      class="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded text-white text-sm"
    >
      Audio: {{ selectedAudioTrack + 1 }}/{{ audioTracks.length }}
    </div>

    <!-- Current subtitle overlay -->
    <div 
      v-if="hasSubtitles"
      class="subtitles-container"
      :style="{
        fontSize: `calc(${settings.subtitleFontSize} * 2rem)`
      }"
    >
      <div
        v-for="caption in store.activeCaptions"
        :key="caption.id"
        :class="[
          'subtitle-line',
          `lane-${caption.lane}`
        ]"
      >
        <template v-if="caption.furigana">
          <Furigana
            v-for="[text, reading] in caption.furigana"
            :key="`${caption.id}-${text}`"
            :text="processText(text)"
            :reading="reading"
          />
        </template>
        <template v-else>
          {{ processText(caption.text) }}
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.subtitles-container {
  position: absolute;
  bottom: 8vh;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.subtitle-line {
  position: relative;
  text-align: center;
  color: white;
  font-size: 2rem;
  text-shadow: 
    0 0 5px rgba(0,0,0,0.8),
    0 0 10px rgba(0,0,0,0.5);
  padding: 0.2em;
}

.lane-0 { transform: translateY(0); }
.lane-1 { transform: translateY(-100%); }
.lane-2 { transform: translateY(-200%); }
.lane-3 { transform: translateY(-300%); }

.has-subtitles .video-element {
  margin-bottom: 20vh; /* Make room for subtitles */
}
</style> 