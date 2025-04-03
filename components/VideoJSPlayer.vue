<template>
  <div 
    class="video-container" 
    ref="videoContainer"
    :class="{ 'sidebar-active': sidebarActive }"
  >
    <video
      ref="videoElement"
      class="video-js vjs-default-skin vjs-big-play-centered"
      controls
      preload="auto"
      :width="width"
      :height="height"
    ></video>
    
    <!-- Custom sidebar toggle button -->
    <button 
      v-if="showSidebarToggle"
      class="vjs-sidebar-toggle"
      @click="toggleSidebar"
      :title="sidebarActive ? 'Hide Sidebar' : 'Show Sidebar'"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <path v-if="sidebarActive" fill="currentColor" d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm0 16H5V5h14v14zM7 16h10v-2H7v2zm0-4h10v-2H7v2zm0-4h10V6H7v2z"/>
        <path v-else fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-ass';

// Define props
const props = defineProps({
  src: {
    type: String,
    required: true
  },
  subtitles: {
    type: Array,
    default: () => []
  },
  width: {
    type: Number,
    default: 640
  },
  height: {
    type: Number,
    default: 360
  },
  autoplay: {
    type: Boolean,
    default: false
  },
  controls: {
    type: Boolean,
    default: true
  },
  loop: {
    type: Boolean,
    default: false
  },
  muted: {
    type: Boolean,
    default: false
  },
  poster: {
    type: String,
    default: ''
  },
  startTime: {
    type: Number,
    default: 0
  },
  playbackRates: {
    type: Array,
    default: () => [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
  },
  responsive: {
    type: Boolean,
    default: true
  },
  fill: {
    type: Boolean,
    default: false
  },
  language: {
    type: String,
    default: 'en'
  },
  showSidebarToggle: {
    type: Boolean,
    default: true
  },
  sidebarActive: {
    type: Boolean,
    default: false
  }
});

// Define emits
const emit = defineEmits([
  'ready', 
  'play', 
  'pause', 
  'timeupdate', 
  'ended', 
  'error', 
  'word-click',
  'subtitle-change',
  'audio-track-change',
  'fullscreen-change',
  'volume-change',
  'toggle-sidebar'
]);

// Refs
const videoContainer = ref(null);
const videoElement = ref(null);
const player = ref(null);
const subtitleObserver = ref(null);

// Toggle sidebar
function toggleSidebar() {
  emit('toggle-sidebar', !props.sidebarActive);
}

// Methods exposed to parent
const playerMethods = {
  play: () => player.value?.play(),
  pause: () => player.value?.pause(),
  currentTime: (time) => {
    if (time !== undefined) {
      player.value?.currentTime(time);
    }
    return player.value?.currentTime();
  },
  volume: (level) => {
    if (level !== undefined) {
      player.value?.volume(level);
    }
    return player.value?.volume();
  },
  muted: (muted) => {
    if (muted !== undefined) {
      player.value?.muted(muted);
    }
    return player.value?.muted();
  },
  requestFullscreen: () => player.value?.requestFullscreen(),
  exitFullscreen: () => player.value?.exitFullscreen(),
  isFullscreen: () => player.value?.isFullscreen(),
  duration: () => player.value?.duration(),
  dispose: () => player.value?.dispose(),
  textTracks: () => player.value?.textTracks(),
  audioTracks: () => player.value?.audioTracks(),
  playbackRate: (rate) => {
    if (rate !== undefined) {
      player.value?.playbackRate(rate);
    }
    return player.value?.playbackRate();
  },
  showTextTrack: (trackId, show) => {
    const tracks = player.value?.textTracks();
    if (tracks) {
      for (let i = 0; i < tracks.length; i++) {
        if (i === trackId) {
          tracks[i].mode = show ? 'showing' : 'hidden';
        } else {
          tracks[i].mode = 'hidden';
        }
      }
    }
  },
  toggleSidebar
};

// Initialize Video.js player
onMounted(async () => {
  if (!videoElement.value) return;

  // Initialize player with options
  player.value = videojs(videoElement.value, {
    controls: props.controls,
    autoplay: props.autoplay,
    loop: props.loop,
    muted: props.muted,
    poster: props.poster,
    sources: [{ src: props.src }],
    playbackRates: props.playbackRates,
    fluid: props.responsive,
    fill: props.fill,
    language: props.language,
    controlBar: {
      children: [
        'playToggle',
        'volumePanel',
        'currentTimeDisplay',
        'timeDivider',
        'durationDisplay',
        'progressControl',
        'liveDisplay',
        'remainingTimeDisplay',
        'customControlSpacer',
        'playbackRateMenuButton',
        'chaptersButton',
        'descriptionsButton',
        'subsCapsButton',
        'audioTrackButton',
        'fullscreenToggle'
      ]
    },
    html5: {
      nativeTextTracks: false,
      nativeAudioTracks: true,
      nativeVideoTracks: false
    },
    userActions: {
      hotkeys: {
        volumeStep: 0.1,
        seekStep: 5,
        enableNumbers: true,
        enableVolumeScroll: true,
        customKeys: {
          toggleSidebar: {
            key: function(e) {
              // 'S' key
              return e.which === 83;
            },
            handler: function(player, options, e) {
              toggleSidebar();
            }
          }
        }
      }
    }
  });

  // Add event listeners
  player.value.on('ready', () => {
    emit('ready', playerMethods);
    
    // Set initial time if provided
    if (props.startTime > 0) {
      player.value.currentTime(props.startTime);
    }
    
    // Load subtitles
    loadSubtitles();
    
    // Setup subtitle observer for Yomichan compatibility
    setupSubtitleObserver();
  });

  // Standard events
  player.value.on('play', () => emit('play'));
  player.value.on('pause', () => emit('pause'));
  player.value.on('timeupdate', () => emit('timeupdate', player.value.currentTime()));
  player.value.on('ended', () => emit('ended'));
  player.value.on('error', (error) => emit('error', error));
  player.value.on('fullscreenchange', () => emit('fullscreen-change', player.value.isFullscreen()));
  player.value.on('volumechange', () => emit('volume-change', {
    volume: player.value.volume(),
    muted: player.value.muted()
  }));
  
  // Track change events
  player.value.textTracks().addEventListener('change', handleTextTrackChange);
  if (player.value.audioTracks) {
    player.value.audioTracks().addEventListener('change', handleAudioTrackChange);
  }
  
  // Setup word click handler for Yomichan compatibility
  await nextTick();
  setupWordClickHandler();
});

// Clean up on component unmount
onBeforeUnmount(() => {
  if (player.value) {
    // Remove event listeners
    player.value.textTracks().removeEventListener('change', handleTextTrackChange);
    if (player.value.audioTracks) {
      player.value.audioTracks().removeEventListener('change', handleAudioTrackChange);
    }
    
    // Disconnect observer
    if (subtitleObserver.value) {
      subtitleObserver.value.disconnect();
    }
    
    // Dispose player
    player.value.dispose();
  }
});

// Watch for changes in subtitles
watch(() => props.subtitles, () => {
  if (player.value) {
    loadSubtitles();
  }
}, { deep: true });

// Watch for source changes
watch(() => props.src, (newSrc) => {
  if (player.value && newSrc) {
    player.value.src({ src: newSrc });
    player.value.load();
  }
});

// Handle text track change
function handleTextTrackChange() {
  if (!player.value) return;
  
  const tracks = player.value.textTracks();
  let activeTrack = -1;
  
  for (let i = 0; i < tracks.length; i++) {
    if (tracks[i].mode === 'showing') {
      activeTrack = i;
      break;
    }
  }
  
  emit('subtitle-change', activeTrack);
}

// Handle audio track change
function handleAudioTrackChange() {
  if (!player.value || !player.value.audioTracks) return;
  
  const tracks = player.value.audioTracks();
  let activeTrack = -1;
  
  for (let i = 0; i < tracks.length; i++) {
    if (tracks[i].enabled) {
      activeTrack = i;
      break;
    }
  }
  
  emit('audio-track-change', activeTrack);
}

// Load subtitles
function loadSubtitles() {
  if (!player.value) return;

  // Remove existing text tracks
  for (let i = player.value.textTracks().length - 1; i >= 0; i--) {
    player.value.removeRemoteTextTrack(player.value.textTracks()[i]);
  }

  // Add new subtitle tracks
  props.subtitles.forEach((subtitle, index) => {
    if (subtitle.format === 'ass') {
      // Add ASS subtitles using videojs-ass plugin
      player.value.ass({
        src: subtitle.src,
        label: subtitle.label || subtitle.language,
        delay: subtitle.delay || 0,
        enableSvg: false, // Disable SVG for better Yomichan compatibility
        fontSize: '24px', // Larger default font size
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'normal',
        color: '#FFFFFF',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        textShadow: '2px 2px 2px rgba(0, 0, 0, 0.8)'
      });
    } else {
      // Add standard WebVTT or SRT subtitles
      player.value.addRemoteTextTrack({
        kind: 'subtitles',
        src: subtitle.src,
        srclang: subtitle.language,
        label: subtitle.label || subtitle.language,
        default: index === 0
      }, false);
    }
  });
  
  // Setup word click handler again after loading subtitles
  nextTick(() => {
    setupWordClickHandler();
  });
}

// Setup word click handler for Yomichan compatibility
function setupWordClickHandler() {
  if (!videoContainer.value) return;

  // Add click event listener to subtitle container
  const subtitleContainer = videoContainer.value.querySelector('.vjs-ass-subtitles');
  if (subtitleContainer) {
    subtitleContainer.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'SPAN' || target.tagName === 'DIV') {
        const word = target.textContent?.trim() || '';
        if (word) {
          emit('word-click', word);
        }
      }
    });
  }
}

// Setup MutationObserver to watch for subtitle changes
function setupSubtitleObserver() {
  if (!videoContainer.value) return;
  
  // Find or wait for the subtitle container
  const checkForSubtitleContainer = () => {
    const subtitleContainer = videoContainer.value.querySelector('.vjs-ass-subtitles, .vjs-text-track-display');
    
    if (subtitleContainer) {
      // Create observer to watch for changes to subtitles
      subtitleObserver.value = new MutationObserver((mutations) => {
        // Make sure all text is selectable for Yomichan
        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                makeNodeSelectable(node as HTMLElement);
              }
            });
          }
        });
      });
      
      // Start observing
      subtitleObserver.value.observe(subtitleContainer, {
        childList: true,
        subtree: true
      });
      
      // Make existing nodes selectable
      makeNodeSelectable(subtitleContainer);
    } else {
      // Try again in a moment
      setTimeout(checkForSubtitleContainer, 500);
    }
  };
  
  checkForSubtitleContainer();
}

// Make all text nodes in an element selectable for Yomichan
function makeNodeSelectable(element: HTMLElement) {
  // Add necessary styles
  element.style.userSelect = 'text';
  element.style.cursor = 'text';
  
  // Process child elements
  Array.from(element.children).forEach(child => {
    makeNodeSelectable(child as HTMLElement);
  });
}

// Expose player methods to parent
defineExpose(playerMethods);
</script>

<style>
.video-container {
  position: relative;
  width: 100%;
  height: 100%;
  transition: width 0.3s ease, margin-right 0.3s ease;
}

.video-container.sidebar-active {
  width: calc(100% - 350px);
  margin-right: 350px;
}

/* Sidebar toggle button */
.vjs-sidebar-toggle {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 40px;
  height: 40px;
  background: rgba(43, 51, 63, 0.7);
  border: none;
  border-radius: 4px;
  color: white;
  z-index: 100;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.vjs-sidebar-toggle:hover {
  background: rgba(43, 51, 63, 0.9);
}

/* Make subtitles scannable by Yomichan */
.vjs-ass-subtitles span,
.vjs-ass-subtitles div,
.vjs-text-track-display span,
.vjs-text-track-display div {
  cursor: text !important;
  user-select: text !important;
  pointer-events: auto !important;
}

.vjs-ass-subtitles span:hover,
.vjs-text-track-display span:hover {
  text-decoration: underline;
  opacity: 0.9;
}

/* Increase subtitle size and improve readability */
.vjs-ass-subtitles {
  font-size: 24px !important;
  line-height: 1.4 !important;
  text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.8) !important;
}

/* Ensure subtitles are visible and properly positioned */
.vjs-text-track-display {
  pointer-events: none;
  position: absolute;
  bottom: 10%;
  left: 0;
  right: 0;
  top: auto !important;
  transform: none !important;
}

/* Custom subtitle styling */
.vjs-text-track-cue {
  background-color: rgba(0, 0, 0, 0.7) !important;
  padding: 0.25em 0.5em !important;
  border-radius: 4px !important;
  max-width: 90% !important;
  margin: 0 auto !important;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .video-container.sidebar-active {
    width: 100%;
    margin-right: 0;
  }
}
</style> 