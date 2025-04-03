<template>
  <div 
    ref="subtitleContainerRef" 
    class="subtitle-container"
    :class="{ 'hidden': !isVisible }"
  >
    <!-- Primary subtitle track -->
    <div 
      v-if="primaryTrack && showPrimaryTrack" 
      class="subtitle-track primary"
      :style="primaryTrackStyle"
    >
      <template v-for="(line, index) in primaryTrack.lines" :key="`primary-${index}`">
        <div 
          class="subtitle-line"
          :class="[`align-${line.alignment || 'center'}`]"
          v-html="processLineWithTags(line.text)"
        ></div>
      </template>
    </div>
    
    <!-- Secondary subtitle track -->
    <div 
      v-if="secondaryTrack && showSecondaryTrack" 
      class="subtitle-track secondary"
      :style="secondaryTrackStyle"
    >
      <template v-for="(line, index) in secondaryTrack.lines" :key="`secondary-${index}`">
        <div 
          class="subtitle-line"
          :class="[`align-${line.alignment || 'center'}`]"
          v-html="processLineWithTags(line.text)"
        ></div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { parseAss, parseVtt, parseSrt } from '../utils/subtitleParsers';

interface SubtitleLine {
  startTime: number;
  endTime: number;
  text: string;
  alignment?: 'left' | 'center' | 'right';
  style?: string;
}

interface SubtitleTrack {
  id: string;
  language: string;
  lines: SubtitleLine[];
  format: 'ass' | 'vtt' | 'srt';
  delay: number;
}

const props = defineProps<{
  videoElement: HTMLVideoElement | null;
  subtitleTracks: SubtitleTrack[];
  primaryTrackIndex: number;
  secondaryTrackIndex: number;
  currentTime: number;
  showPrimaryTrack: boolean;
  showSecondaryTrack: boolean;
  primaryFontSize: number;
  secondaryFontSize: number;
  primaryFontFamily: string;
  secondaryFontFamily: string;
  primaryFontWeight: number | string;
  secondaryFontWeight: number | string;
  primaryTextColor: string;
  secondaryTextColor: string;
  primaryBackgroundColor: string;
  secondaryBackgroundColor: string;
  primaryTextShadow: string;
  secondaryTextShadow: string;
}>();

const emit = defineEmits<{
  'word-click': [word: string, trackId: string];
}>();

const subtitleContainerRef = ref<HTMLElement | null>(null);
const isVisible = ref(true);
const observer = ref<IntersectionObserver | null>(null);

// Computed properties for active tracks
const primaryTrack = computed(() => {
  return props.subtitleTracks[props.primaryTrackIndex] || null;
});

const secondaryTrack = computed(() => {
  return props.subtitleTracks[props.secondaryTrackIndex] || null;
});

// Get active lines based on current time
const primaryActiveLines = computed(() => {
  if (!primaryTrack.value) return [];
  
  const delay = primaryTrack.value.delay || 0;
  const adjustedTime = props.currentTime - delay;
  
  return primaryTrack.value.lines.filter(line => 
    line.startTime <= adjustedTime && adjustedTime <= line.endTime
  );
});

const secondaryActiveLines = computed(() => {
  if (!secondaryTrack.value) return [];
  
  const delay = secondaryTrack.value.delay || 0;
  const adjustedTime = props.currentTime - delay;
  
  return secondaryTrack.value.lines.filter(line => 
    line.startTime <= adjustedTime && adjustedTime <= line.endTime
  );
});

// Computed styles for tracks
const primaryTrackStyle = computed(() => ({
  fontSize: `${props.primaryFontSize}rem`,
  fontFamily: props.primaryFontFamily,
  fontWeight: props.primaryFontWeight,
  color: props.primaryTextColor,
  backgroundColor: props.primaryBackgroundColor,
  textShadow: props.primaryTextShadow
}));

const secondaryTrackStyle = computed(() => ({
  fontSize: `${props.secondaryFontSize}rem`,
  fontFamily: props.secondaryFontFamily,
  fontWeight: props.secondaryFontWeight,
  color: props.secondaryTextColor,
  backgroundColor: props.secondaryBackgroundColor,
  textShadow: props.secondaryTextShadow
}));

// Process ASS tags in subtitle text
function processLineWithTags(text: string): string {
  if (!text) return '';
  
  // Process ASS tags
  let processedText = text
    // Bold
    .replace(/\{\\b1\}(.*?)(\{\\b0\}|$)/g, '<strong>$1</strong>')
    // Italic
    .replace(/\{\\i1\}(.*?)(\{\\i0\}|$)/g, '<em>$1</em>')
    // Underline
    .replace(/\{\\u1\}(.*?)(\{\\u0\}|$)/g, '<u>$1</u>')
    // Font color
    .replace(/\{\\c&H([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})\}(.*?)(\{\\c\}|$)/g, 
      (_, r, g, b, content) => `<span style="color: #${b}${g}${r}">${content}</span>`)
    // Remove remaining ASS tags
    .replace(/\{\\[^}]*\}/g, '');
  
  // Make each word scannable by wrapping in spans
  processedText = processedText.replace(/(\p{L}+)/gu, '<span class="scannable-word">$1</span>');
  
  return processedText;
}

// Handle word click for dictionary lookup
function handleWordClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.classList.contains('scannable-word')) {
    const word = target.textContent || '';
    const trackId = target.closest('.subtitle-track')?.classList.contains('primary') 
      ? primaryTrack.value?.id || ''
      : secondaryTrack.value?.id || '';
    
    emit('word-click', word, trackId);
  }
}

// Set up intersection observer to hide subtitles when video is out of view
onMounted(() => {
  if (subtitleContainerRef.value) {
    // Add click event listener for word scanning
    subtitleContainerRef.value.addEventListener('click', handleWordClick);
    
    // Set up intersection observer
    observer.value = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          isVisible.value = entry.isIntersecting;
        });
      },
      { threshold: 0.1 }
    );
    
    // Start observing the video element if available
    if (props.videoElement) {
      observer.value.observe(props.videoElement);
    }
  }
});

// Update observer when video element changes
watch(() => props.videoElement, (newVideo) => {
  if (observer.value) {
    observer.value.disconnect();
    if (newVideo) {
      observer.value.observe(newVideo);
    }
  }
});

// Clean up on unmount
onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect();
  }
  
  if (subtitleContainerRef.value) {
    subtitleContainerRef.value.removeEventListener('click', handleWordClick);
  }
});
</script>

<style scoped>
.subtitle-container {
  position: absolute;
  bottom: 10%;
  left: 0;
  width: 100%;
  z-index: 10;
  pointer-events: none; /* Allow clicks to pass through to video by default */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  transition: opacity 0.2s ease;
}

.subtitle-container.hidden {
  opacity: 0;
  visibility: hidden;
}

.subtitle-track {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1rem;
}

.subtitle-track.primary {
  z-index: 2;
}

.subtitle-track.secondary {
  z-index: 1;
}

.subtitle-line {
  max-width: 80%;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.25rem;
  pointer-events: auto; /* Enable clicking on text */
  user-select: text; /* Allow text selection */
}

.subtitle-line.align-left {
  align-self: flex-start;
  margin-left: 10%;
  text-align: left;
}

.subtitle-line.align-center {
  text-align: center;
}

.subtitle-line.align-right {
  align-self: flex-end;
  margin-right: 10%;
  text-align: right;
}

/* Make words scannable by Yomichan */
:deep(.scannable-word) {
  cursor: pointer;
  display: inline-block;
}

:deep(.scannable-word:hover) {
  text-decoration: underline;
  opacity: 0.9;
}
</style> 