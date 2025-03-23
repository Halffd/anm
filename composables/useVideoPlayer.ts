import { ref, computed, watch } from 'vue'
import type { Caption } from '~/types'
import { useVideoUtils } from '~/composables/useVideoUtils'

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

export function useVideoPlayer(props: {
  videoUrl?: string | null,
  captions: Caption[],
  currentTime: number
}) {
  const { generateWebVTT } = useVideoUtils()
  
  const videoRef = ref<HTMLVideoElement>()
  const isPlaying = ref(false)
  const volume = ref(1)
  const isMuted = ref(false)
  const isFullscreen = ref(false)
  const videoDuration = ref(0)
  const playbackRate = ref(1)
  
  // Audio tracks
  interface AudioTrack {
    enabled: boolean
    language?: string
    label?: string
  }
  
  const audioTracks = ref<AudioTrack[]>([])
  const selectedAudioTrack = ref<number>(0)
  
  // Generate captions URL
  const captionsUrl = computed(() => {
    if (!props.captions?.length) return ''
    
    // Create blob URL for captions
    const vttContent = generateWebVTT(props.captions)
    const blob = new Blob([vttContent], { type: 'text/vtt' })
    return URL.createObjectURL(blob)
  })
  
  // Video player functions
  function togglePlayPause() {
    const video = videoRef.value
    if (!video) return
    
    if (video.paused) {
      return video.play()
        .then(() => {
          isPlaying.value = true
          return true
        })
        .catch(error => {
          throw error
        })
    } else {
      video.pause()
      isPlaying.value = false
      return Promise.resolve(false)
    }
  }
  
  function seek(time: number) {
    if (videoRef.value) {
      videoRef.value.currentTime = time
    }
  }
  
  function handleVolumeChange(newVolume: number) {
    volume.value = newVolume
    if (videoRef.value) {
      videoRef.value.volume = newVolume
    }
    
    // If volume is set to 0, mute the video
    // If volume is increased from 0, unmute the video
    if (newVolume === 0) {
      isMuted.value = true
      if (videoRef.value) {
        videoRef.value.muted = true
      }
    } else if (isMuted.value) {
      isMuted.value = false
      if (videoRef.value) {
        videoRef.value.muted = false
      }
    }
  }
  
  function toggleMute() {
    isMuted.value = !isMuted.value
    if (videoRef.value) {
      videoRef.value.muted = isMuted.value
    }
  }
  
  function toggleFullscreen() {
    if (!videoRef.value) return
    
    if (!document.fullscreenElement) {
      videoRef.value.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }
  
  function onFullscreenChange() {
    isFullscreen.value = !!document.fullscreenElement
  }
  
  function onTimeUpdate() {
    // This is handled by the parent component
  }
  
  function onDurationChange() {
    if (videoRef.value) {
      videoDuration.value = videoRef.value.duration
    }
  }
  
  function onVideoEnded() {
    isPlaying.value = false
  }
  
  function adjustPlaybackRate(increase: boolean) {
    const rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
    const currentIndex = rates.indexOf(playbackRate.value)
    
    let newIndex
    if (increase) {
      newIndex = Math.min(rates.length - 1, currentIndex + 1)
    } else {
      newIndex = Math.max(0, currentIndex - 1)
    }
    
    playbackRate.value = rates[newIndex]
    
    if (videoRef.value) {
      videoRef.value.playbackRate = playbackRate.value
    }
  }
  
  function cycleAudioTrack() {
    if (!audioTracks.value.length) return
    
    const newTrackIndex = (selectedAudioTrack.value + 1) % audioTracks.value.length
    selectedAudioTrack.value = newTrackIndex
    
    // Update the video's audio track
    const video = videoRef.value as HTMLVideoElementWithAudioTracks;
    if (video && video.audioTracks) {
      const tracks = video.audioTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].enabled = (i === newTrackIndex);
      }
    }
  }
  
  // Initialize video when URL changes
  watch(() => props.videoUrl, (newUrl) => {
    if (newUrl && videoRef.value) {
      // Reset state
      isPlaying.value = false
      audioTracks.value = []
      selectedAudioTrack.value = 0
      
      // Set initial volume
      videoRef.value.volume = volume.value
      videoRef.value.muted = isMuted.value
      
      // Check for audio tracks after the video has loaded
      videoRef.value.onloadedmetadata = () => {
        const video = videoRef.value as HTMLVideoElementWithAudioTracks;
        const tracks = video?.audioTracks;
        
        if (tracks && tracks.length > 0) {
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            audioTracks.value.push({
              enabled: track.enabled,
              language: track.language,
              label: track.label
            })
          }
        }
      }
    }
  })
  
  return {
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
    onTimeUpdate,
    onDurationChange,
    onVideoEnded,
    adjustPlaybackRate,
    cycleAudioTrack
  }
} 