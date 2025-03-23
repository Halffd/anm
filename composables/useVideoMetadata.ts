import { ref, computed } from 'vue'
import { useVideoUtils } from '~/composables/useVideoUtils'

export function useVideoMetadata(props: {
  videoUrl?: string | null,
  videoAlignment?: 'left' | 'center' | 'right',
  settingsAlignment?: 'left' | 'center' | 'right'
}) {
  const { detectLanguage } = useVideoUtils()
  
  const videoTitle = ref('')
  const videoLanguage = ref('')
  const videoDescription = ref('')
  const videoThumbnail = ref('')
  
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
    switch (props.videoAlignment || props.settingsAlignment) {
      case 'left': return 'left center';
      case 'right': return 'right center';
      default: return 'center center';
    }
  })
  
  // Extract filename from path
  const extractFilename = (path: string): string => {
    if (!path) return '';
    
    // Remove query parameters
    const pathWithoutQuery = path.split('?')[0];
    
    // Get the filename from the path
    const parts = pathWithoutQuery.split('/');
    const filename = parts[parts.length - 1];
    
    // Remove extension
    return filename.split('.').slice(0, -1).join('.');
  }
  
  // Update metadata when video URL changes
  function updateMetadata(title?: string, language?: string, description?: string, thumbnail?: string) {
    if (title) {
      videoTitle.value = title;
    } else if (props.videoUrl) {
      // Extract title from filename if not provided
      videoTitle.value = extractFilename(props.videoUrl);
    }
    
    if (language) {
      videoLanguage.value = language;
    }
    
    if (description) {
      videoDescription.value = description;
    }
    
    if (thumbnail) {
      videoThumbnail.value = thumbnail;
    }
  }
  
  // Detect language from video content
  function detectVideoLanguage(text: string) {
    if (!text) return;
    
    const detectedLanguage = detectLanguage(text);
    if (detectedLanguage !== 'unknown') {
      videoLanguage.value = detectedLanguage;
    }
  }
  
  return {
    videoTitle,
    videoLanguage,
    videoDescription,
    videoThumbnail,
    streamingUrl,
    videoSource,
    videoAlignmentStyle,
    updateMetadata,
    detectVideoLanguage
  }
} 